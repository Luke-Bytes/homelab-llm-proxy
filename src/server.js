'use strict';

const { buildApp } = require('./app');
const { createConfig, getSanitizedConfigSummary } = require('./config');

async function start() {
  const config = createConfig();
  const app = await buildApp(config);

  app.log.info({ config: getSanitizedConfigSummary(config) }, 'Starting local-llm-proxy');

  await app.listen({
    host: config.bindHost,
    port: config.port,
  });
}

start().catch((error) => {
  console.error('[local-llm-proxy] startup failed:', error.message);
  process.exit(1);
});
