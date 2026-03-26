'use strict';

const { badRequest } = require('../lib/errors');
const { setCommonResponseHeaders } = require('../lib/response-headers');
const { chatCompletionsSchema } = require('../schemas/chat-completions');

const ALLOWED_FIELDS = [
  'temperature',
  'top_p',
  'max_tokens',
  'stop',
  'tools',
  'tool_choice',
  'response_format',
  'user',
];

function pickForwardFields(body) {
  const payload = {};

  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      payload[field] = body[field];
    }
  }

  return payload;
}

async function registerChatCompletionRoutes(app) {
  app.post('/v1/chat/completions', {
    schema: chatCompletionsSchema,
    preHandler: app.authPreHandler,
  }, async function chatCompletionsHandler(request, reply) {
    const body = request.body || {};
    const streaming = body.stream === true;

    if (!Array.isArray(body.messages)) {
      throw badRequest('messages must be an array', 'invalid_messages');
    }

    if (streaming && !app.proxyConfig.enableStreaming) {
      throw badRequest('stream=true is not implemented in this proxy', 'streaming_not_supported');
    }

    const modelSelection = app.modelResolver.resolve(body.model);
    const outgoingMessages = app.promptInjector.inject(body.messages);
    const upstreamPayload = {
      model: modelSelection.resolvedModel,
      messages: outgoingMessages,
      stream: false,
      ...pickForwardFields(body),
    };

    request.requestedModel = body.model || null;
    request.selectedModel = modelSelection.selectedModel;
    request.resolvedModel = modelSelection.resolvedModel;
    request.promptProfile = app.proxyConfig.prompts.profile;
    request.streaming = streaming;

    if (app.proxyConfig.logPrompts) {
      request.log.debug({
        requestId: request.id,
        upstreamMessages: outgoingMessages,
      }, 'Forwarding prompts to upstream');
    }

    const upstream = await app.ollamaClient.chatCompletions(upstreamPayload, {
      signal: request.raw.signal,
    });

    request.upstreamStatus = upstream.status;
    setCommonResponseHeaders(reply, request.id, modelSelection.resolvedModel, app.proxyConfig);

    if (app.proxyConfig.logResponses) {
      request.log.debug({
        requestId: request.id,
        upstreamPayload: upstream.payload,
      }, 'Upstream response');
    }

    return reply.code(200).send(upstream.payload);
  });
}

module.exports = registerChatCompletionRoutes;
