'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createModelResolver } = require('../../src/services/model-resolver');
const { createPromptInjector } = require('../../src/services/prompt-injector');

function buildConfig() {
  return {
    serviceName: 'local-llm-proxy',
    models: {
      aliases: {
        default: 'gpt-oss:20b',
        fast: 'qwen3:8b',
        smart: 'gpt-oss:20b',
        'grist-default': 'gpt-oss:20b',
      },
      allowlist: [
        'default',
        'fast',
        'smart',
        'grist-default',
        'gpt-oss:20b',
        'qwen3:8b',
      ],
      defaultModel: 'default',
      allowRequestOverride: true,
      strictResolution: true,
    },
    prompts: {
      enabled: true,
      text: 'System prompt',
    },
  };
}

test('model resolver resolves aliases and backing models', () => {
  const resolver = createModelResolver(buildConfig());

  assert.deepEqual(resolver.resolve('fast'), {
    requestedModel: 'fast',
    selectedModel: 'fast',
    resolvedModel: 'qwen3:8b',
    isAlias: true,
  });
});

test('prompt injector prepends configured system prompt', () => {
  const injector = createPromptInjector(buildConfig());
  const messages = [{ role: 'user', content: 'hello' }];

  assert.deepEqual(injector.inject(messages), [
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'hello' },
  ]);
});

test('model resolver exposes stable alias model list with backing metadata', () => {
  const resolver = createModelResolver(buildConfig());
  const models = resolver.listAliases();

  assert.equal(models[0].id, 'default');
  assert.equal(models[0].metadata.backing_model, 'gpt-oss:20b');
  assert.equal(models[1].id, 'fast');
  assert.equal(models[1].metadata.backing_model, 'qwen3:8b');
});
