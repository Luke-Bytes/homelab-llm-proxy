'use strict';

class ProxyError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ProxyError';
    this.statusCode = options.statusCode || 500;
    this.type = options.type || 'internal_error';
    this.code = options.code || 'internal_error';
    this.details = options.details;
    this.expose = options.expose !== false;
  }
}

function createErrorEnvelope(error) {
  return {
    error: {
      message: error.message || 'Internal server error',
      type: error.type || 'internal_error',
      code: error.code || 'internal_error',
    },
  };
}

function badRequest(message, code = 'invalid_request') {
  return new ProxyError(message, {
    statusCode: 400,
    type: 'invalid_request_error',
    code,
  });
}

function unauthorized(message = 'Invalid API key') {
  return new ProxyError(message, {
    statusCode: 401,
    type: 'authentication_error',
    code: 'invalid_api_key',
  });
}

function upstreamError(message, statusCode, code) {
  return new ProxyError(message, {
    statusCode,
    type: 'upstream_error',
    code,
  });
}

function internalError(message = 'Internal proxy error', code = 'proxy_internal_error') {
  return new ProxyError(message, {
    statusCode: 500,
    type: 'internal_error',
    code,
    expose: false,
  });
}

module.exports = {
  ProxyError,
  badRequest,
  unauthorized,
  upstreamError,
  internalError,
  createErrorEnvelope,
};
