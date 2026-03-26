'use strict';

const { ProxyError, upstreamError } = require('../lib/errors');

function withTimeoutSignal(timeoutMs, extraSignals = []) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

  const cleanup = () => clearTimeout(timeout);

  const onAbort = () => {
    controller.abort(new Error('aborted'));
  };

  for (const signal of extraSignals) {
    if (!signal) {
      continue;
    }

    if (signal.aborted) {
      cleanup();
      controller.abort(signal.reason || new Error('aborted'));
      break;
    }

    signal.addEventListener('abort', onAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup() {
      cleanup();
      for (const signal of extraSignals) {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      }
    },
  };
}

async function parseJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw upstreamError('Upstream returned invalid JSON', 502, 'ollama_bad_response');
  }
}

function buildUrl(baseUrl, pathName) {
  return new URL(pathName, `${baseUrl}/`).toString();
}

function mapFetchError(error) {
  if (error instanceof ProxyError) {
    return error;
  }

  if (error && error.name === 'AbortError') {
    return upstreamError('Upstream request timed out', 504, 'ollama_timeout');
  }

  return upstreamError('Upstream is unreachable', 502, 'ollama_unreachable');
}

function createOllamaClient(config) {
  async function requestJson(pathName, options = {}) {
    const timeout = withTimeoutSignal(config.upstream.timeoutMs, [options.signal]);

    try {
      const response = await fetch(buildUrl(config.upstream.baseUrl, pathName), {
        method: options.method || 'GET',
        headers: {
          'content-type': 'application/json',
          ...(options.headers || {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: timeout.signal,
      });
      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        const message = payload && payload.error && payload.error.message
          ? payload.error.message
          : `Upstream request failed with status ${response.status}`;

        throw upstreamError(message, 502, 'ollama_bad_response');
      }

      return {
        status: response.status,
        payload,
      };
    } catch (error) {
      throw mapFetchError(error);
    } finally {
      timeout.cleanup();
    }
  }

  return {
    async chatCompletions(payload, options = {}) {
      return requestJson(config.upstream.chatPath, {
        method: 'POST',
        body: payload,
        signal: options.signal,
      });
    },
    async listModels(options = {}) {
      return requestJson(config.upstream.modelsPath, {
        method: 'GET',
        signal: options.signal,
      });
    },
  };
}

module.exports = {
  createOllamaClient,
};
