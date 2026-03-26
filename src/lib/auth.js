'use strict';

const { unauthorized } = require('./errors');

function createAuthPreHandler(config) {
  return function authPreHandler(request) {
    const header = request.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw unauthorized('Missing bearer token');
    }

    const token = header.slice('Bearer '.length).trim();

    if (!token || token !== config.apiKey) {
      throw unauthorized('Invalid bearer token');
    }
  };
}

module.exports = {
  createAuthPreHandler,
};
