'use strict';

function setCommonResponseHeaders(reply, requestId, effectiveModel, config) {
  reply.header('x-request-id', requestId);

  if (config.responseHeaderEffectiveModel && effectiveModel) {
    reply.header('x-effective-model', effectiveModel);
  }
}

module.exports = {
  setCommonResponseHeaders,
};
