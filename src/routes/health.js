'use strict';

async function registerHealthRoutes(app) {
  app.get('/healthz', async function healthzHandler() {
    return {
      ok: true,
      service: app.proxyConfig.serviceName,
    };
  });

  app.get('/readyz', async function readyzHandler(request, reply) {
    const aliasEntries = app.modelResolver.listAliases();
    const upstream = await app.ollamaClient.listModels();
    const upstreamModels = Array.isArray(upstream.payload && upstream.payload.data)
      ? upstream.payload.data.map((entry) => entry.id).filter(Boolean)
      : [];
    const resolvedDefault = app.modelResolver.resolve(app.proxyConfig.models.defaultModel);
    const requiredModels = [
      resolvedDefault.resolvedModel,
      ...aliasEntries.map((entry) => entry.metadata.backing_model),
    ];
    const missingBackingModels = requiredModels
      .filter((modelId, index, list) => list.indexOf(modelId) === index)
      .filter((modelId) => !upstreamModels.includes(modelId));

    if (missingBackingModels.length > 0) {
      reply.code(503);
      return {
        ok: false,
        service: app.proxyConfig.serviceName,
        upstream: 'reachable',
        default_model: resolvedDefault.resolvedModel,
        missing_models: missingBackingModels,
      };
    }

    return {
      ok: true,
      service: app.proxyConfig.serviceName,
      upstream: 'reachable',
      default_model: resolvedDefault.resolvedModel,
      models: {
        aliases: aliasEntries.map((entry) => ({
          id: entry.id,
          backing_model: entry.metadata.backing_model,
        })),
        upstream_count: upstreamModels.length,
      },
    };
  });
}

module.exports = registerHealthRoutes;
