'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config();

const SERVICE_NAME = 'local-llm-proxy';
const ROOT_DIR = path.resolve(__dirname, '..');

function parseBoolean(name, fallback) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid boolean value for ${name}`);
}

function parseInteger(name, fallback) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer value for ${name}`);
  }

  return parsed;
}

function parseCsvList(name, fallback) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === '') {
    return fallback.slice();
  }

  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAliasMap(name, fallback) {
  const entries = parseCsvList(name, fallback);
  const aliases = {};

  for (const entry of entries) {
    const separatorIndex = entry.indexOf(':');

    if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
      throw new Error(`Invalid alias entry for ${name}: ${entry}`);
    }

    const alias = entry.slice(0, separatorIndex).trim();
    const target = entry.slice(separatorIndex + 1).trim();

    if (!alias || !target) {
      throw new Error(`Invalid alias entry for ${name}: ${entry}`);
    }

    aliases[alias] = target;
  }

  return aliases;
}

function requireString(name) {
  const value = process.env[name];

  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return value.trim();
}

function readPromptFile(promptDir, profileName) {
  const promptPath = path.resolve(promptDir, `${profileName}.txt`);

  if (!fs.existsSync(promptPath)) {
    throw new Error(`Prompt profile file not found: ${promptPath}`);
  }

  return {
    path: promptPath,
    text: fs.readFileSync(promptPath, 'utf8').trim(),
  };
}

function createConfig() {
  const bindHost = process.env.PROXY_BIND_HOST || '127.0.0.1';
  const port = parseInteger('PROXY_PORT', 3331);
  const upstreamBaseUrl = requireString('OLLAMA_BASE_URL').replace(/\/+$/, '');
  const promptDir = path.resolve(ROOT_DIR, process.env.PROMPT_DIR || './prompts');
  const promptProfile = process.env.PROMPT_PROFILE || 'grist';
  const promptInjectionEnabled = parseBoolean('PROMPT_INJECTION_ENABLED', true);
  const aliases = parseAliasMap('MODEL_ALIASES', [
    'default:gpt-oss:20b',
    'fast:qwen3:8b',
    'smart:gpt-oss:20b',
    'grist-default:gpt-oss:20b',
  ]);
  const allowlist = parseCsvList('MODEL_ALLOWLIST', [
    'qwen3:8b',
    'gpt-oss:20b',
    'default',
    'fast',
    'smart',
    'grist-default',
  ]);
  const defaultModel = process.env.MODEL_DEFAULT || 'default';
  const promptFile = promptInjectionEnabled ? readPromptFile(promptDir, promptProfile) : null;

  if (!allowlist.length) {
    throw new Error('MODEL_ALLOWLIST must contain at least one entry');
  }

  if (!allowlist.includes(defaultModel)) {
    throw new Error(`MODEL_DEFAULT must be included in MODEL_ALLOWLIST: ${defaultModel}`);
  }

  for (const [alias, target] of Object.entries(aliases)) {
    if (!allowlist.includes(alias)) {
      throw new Error(`Alias ${alias} must be included in MODEL_ALLOWLIST`);
    }

    if (!allowlist.includes(target) && !Object.hasOwn(aliases, target)) {
      throw new Error(`Alias target ${target} for ${alias} must be allowlisted or another alias`);
    }
  }

  return {
    serviceName: SERVICE_NAME,
    rootDir: ROOT_DIR,
    env: process.env.NODE_ENV || 'development',
    bindHost,
    port,
    apiKey: requireString('PROXY_API_KEY'),
    bodyLimitBytes: parseInteger('MAX_BODY_BYTES', 1024 * 1024),
    logLevel: process.env.LOG_LEVEL || 'info',
    disableHealthLogs: parseBoolean('DISABLE_HEALTH_LOGS', true),
    logPrompts: parseBoolean('LOG_PROMPTS', false),
    logResponses: parseBoolean('LOG_RESPONSES', false),
    responseHeaderEffectiveModel: parseBoolean('RESPONSE_HEADER_EFFECTIVE_MODEL', true),
    enableStreaming: parseBoolean('ENABLE_STREAMING', false),
    upstream: {
      baseUrl: upstreamBaseUrl,
      chatPath: process.env.OLLAMA_CHAT_PATH || '/v1/chat/completions',
      modelsPath: process.env.OLLAMA_MODELS_PATH || '/v1/models',
      timeoutMs: parseInteger('UPSTREAM_TIMEOUT_MS', 180000),
      connectTimeoutMs: parseInteger('UPSTREAM_CONNECT_TIMEOUT_MS', 5000),
    },
    models: {
      defaultModel,
      allowlist,
      aliases,
      allowRequestOverride: parseBoolean('ALLOW_REQUEST_MODEL_OVERRIDE', true),
      strictResolution: parseBoolean('STRICT_MODEL_RESOLUTION', true),
    },
    prompts: {
      enabled: promptInjectionEnabled,
      dir: promptDir,
      profile: promptProfile,
      version: process.env.PROMPT_VERSION || '2026-03-26-v1',
      text: promptFile ? promptFile.text : '',
      path: promptFile ? promptFile.path : null,
    },
  };
}

function getSanitizedConfigSummary(config) {
  return {
    serviceName: config.serviceName,
    env: config.env,
    bindHost: config.bindHost,
    port: config.port,
    upstreamBaseUrl: config.upstream.baseUrl,
    upstreamChatPath: config.upstream.chatPath,
    upstreamModelsPath: config.upstream.modelsPath,
    promptProfile: config.prompts.profile,
    promptInjectionEnabled: config.prompts.enabled,
    promptVersion: config.prompts.version,
    modelDefault: config.models.defaultModel,
    allowRequestOverride: config.models.allowRequestOverride,
    strictResolution: config.models.strictResolution,
    allowlistedModels: config.models.allowlist,
    aliases: config.models.aliases,
  };
}

module.exports = {
  createConfig,
  getSanitizedConfigSummary,
};
