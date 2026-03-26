'use strict';

const { setCommonResponseHeaders } = require('../lib/response-headers');

async function registerModelsRoutes(app) {
  app.get('/v1/models', {
    preHandler: app.authPreHandler,
  }, async function modelsHandler(request, reply) {
    setCommonResponseHeaders(reply, request.id, null, app.proxyConfig);

    return {
      object: 'list',
      data: app.modelResolver.listAliases(),
    };
  });
}

module.exports = registerModelsRoutes;
