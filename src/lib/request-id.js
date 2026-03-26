'use strict';

const crypto = require('node:crypto');

function resolveRequestId(request) {
  const providedId = request.headers['x-request-id'];
  return typeof providedId === 'string' && providedId.trim() !== ''
    ? providedId.trim()
    : crypto.randomUUID();
}

module.exports = {
  resolveRequestId,
};
