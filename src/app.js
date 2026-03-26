'use strict';

const Fastify = require('fastify');
const registerChatCompletionRoutes = require('./routes/chat-completions');
const registerHealthRoutes = require('./routes/health');
const registerModelsRoutes = require('./routes/models');
const { createAuthPreHandler } = require('./lib/auth');
const { createErrorEnvelope, internalError, ProxyError } = require('./lib/errors');
const { resolveRequestId } = require('./lib/request-id');
const { createModelResolver } = require('./services/model-resolver');
const { createOllamaClient } = require('./services/ollama-client');
const { createPromptInjector } = require('./services/prompt-injector');

function createLoggerConfig(config) {
  return {
    level: config.logLevel,
    redact: {
      paths: [
        'req.headers.authorization',
        'request.headers.authorization',
        'config.apiKey',
      ],
      censor: '[redacted]',
    },
  };
}

function shouldLogRequest(config, req) {
  if (!config.disableHealthLogs) {
    return true;
  }

  return req.url !== '/healthz' && req.url !== '/readyz';
}

function formatValidationError(error) {
  const detail = Array.isArray(error.validation) && error.validation[0]
    ? error.validation[0].message
    : 'Invalid request body';

  return new ProxyError(detail, {
    statusCode: 400,
    type: 'invalid_request_error',
    code: 'invalid_request',
  });
}

async function buildApp(config) {
  const app = Fastify({
    logger: createLoggerConfig(config),
    bodyLimit: config.bodyLimitBytes,
    disableRequestLogging: true,
    requestIdHeader: 'x-request-id',
    genReqId: resolveRequestId,
  });

  app.decorate('proxyConfig', config);
  app.decorate('authPreHandler', createAuthPreHandler(config));
  app.decorate('modelResolver', createModelResolver(config));
  app.decorate('promptInjector', createPromptInjector(config));
  app.decorate('ollamaClient', createOllamaClient(config));

  app.addHook('onRequest', async (request) => {
    request.startTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (request, reply) => {
    if (!shouldLogRequest(config, request.raw)) {
      return;
    }

    const elapsedNs = process.hrtime.bigint() - request.startTime;
    const durationMs = Number(elapsedNs) / 1e6;

    request.log.info({
      requestId: request.id,
      method: request.method,
      path: request.routerPath || request.url,
      statusCode: reply.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      requestedModel: request.requestedModel || null,
      selectedModel: request.selectedModel || null,
      resolvedModel: request.resolvedModel || null,
      promptProfile: request.promptProfile || null,
      streaming: request.streaming || false,
      upstreamStatus: request.upstreamStatus || null,
      errorCode: request.proxyErrorCode || null,
    }, 'request complete');
  });

  app.setErrorHandler((error, request, reply) => {
    const normalizedError = error.validation ? formatValidationError(error) : error;
    const proxyError = normalizedError instanceof ProxyError
      ? normalizedError
      : internalError();

    request.proxyErrorCode = proxyError.code;

    request.log.error({
      requestId: request.id,
      code: proxyError.code,
      statusCode: proxyError.statusCode,
      message: proxyError.message,
    }, 'request failed');

    reply.code(proxyError.statusCode).send(createErrorEnvelope(proxyError));
  });

  await registerHealthRoutes(app);
  await registerModelsRoutes(app);
  await registerChatCompletionRoutes(app);

  return app;
}

module.exports = {
  buildApp,
};
