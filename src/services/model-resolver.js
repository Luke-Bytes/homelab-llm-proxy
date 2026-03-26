'use strict';

const { badRequest } = require('../lib/errors');

function resolveAlias(aliasMap, modelName) {
  let current = modelName;
  const seen = new Set();

  while (Object.hasOwn(aliasMap, current)) {
    if (seen.has(current)) {
      throw badRequest(`Model alias cycle detected for ${modelName}`, 'invalid_model');
    }

    seen.add(current);
    current = aliasMap[current];
  }

  return current;
}

function createModelResolver(config) {
  const { aliases, allowlist, defaultModel, allowRequestOverride, strictResolution } = config.models;
  const allowlistSet = new Set(allowlist);

  function resolve(requestedModel) {
    if (requestedModel && !allowRequestOverride) {
      throw badRequest('Request model override is disabled', 'model_override_disabled');
    }

    const selectedModel = requestedModel || defaultModel;

    if (!allowlistSet.has(selectedModel)) {
      throw badRequest(`Model is not allowed: ${selectedModel}`, 'invalid_model');
    }

    const resolvedModel = resolveAlias(aliases, selectedModel);

    if (!allowlistSet.has(resolvedModel) && strictResolution) {
      throw badRequest(`Resolved model is not allowed: ${resolvedModel}`, 'invalid_model');
    }

    return {
      requestedModel: requestedModel || null,
      selectedModel,
      resolvedModel,
      isAlias: Object.hasOwn(aliases, selectedModel),
    };
  }

  function listAliases() {
    return Object.entries(aliases)
      .filter(([alias]) => allowlistSet.has(alias))
      .map(([alias, target]) => ({
        id: alias,
        object: 'model',
        owned_by: config.serviceName,
        created: 0,
        metadata: {
          backing_model: resolveAlias(aliases, target),
          alias_target: target,
        },
      }));
  }

  return {
    resolve,
    listAliases,
  };
}

module.exports = {
  createModelResolver,
};
