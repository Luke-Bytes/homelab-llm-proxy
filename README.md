# local-llm-proxy

`local-llm-proxy` is a small OpenAI-compatible proxy for local Ollama use on a homelab network. It is meant to stay boring: one Node.js process, Fastify, PM2 fork mode, no database, no admin UI, and a narrow API surface that is easy to run over SSH on a Raspberry Pi.

## What it does

- Accepts `POST /v1/chat/completions` and a filtered `GET /v1/models`.
- Requires bearer-token auth for API requests.
- Resolves stable aliases like `default`, `fast`, and `smart` to allowlisted Ollama models.
- Optionally injects one global system prompt from a prompt file.
- Proxies only to the configured Ollama host.
- Exposes `GET /healthz` and `GET /readyz` for local monitoring.

## Runtime

- Bind to `127.0.0.1` by default.
- Run a single PM2 process in fork mode.
- Keep the Node port private and let NGINX or local clients reach it only when needed.
- Use environment variables for all runtime behavior.
- Store longer prompt text in files under `./prompts`.

## Setup

1. Copy `.env.example` to `.env` and set `PROXY_API_KEY`.
2. Point `OLLAMA_BASE_URL` at the Windows Ollama host on the LAN.
3. Choose `PROMPT_PROFILE=general` or `PROMPT_PROFILE=grist`.
4. Start the service with PM2 using `ecosystem.config.cjs`.
5. Run PM2 from the repository root so `./prompts` resolves as expected.

If you are wiring this into Grist, use the same bearer token and point Grist at:

```text
http://127.0.0.1:3331/v1/chat/completions
```

## Environment

The default operator profile is intended to be explicit and low-risk:

- `PROXY_BIND_HOST=127.0.0.1`
- `PROXY_PORT=3331`
- `PROXY_API_KEY=change-me-long-random-string`
- `OLLAMA_BASE_URL=http://192.168.0.100:11434`
- `MODEL_DEFAULT=default`
- `MODEL_ALLOWLIST=qwen3:8b,gpt-oss:20b,default,fast,smart,grist-default`
- `MODEL_ALIASES=default:gpt-oss:20b,fast:qwen3:8b,smart:gpt-oss:20b,grist-default:gpt-oss:20b`
- `PROMPT_INJECTION_ENABLED=true`
- `PROMPT_PROFILE=grist`
- `PROMPT_DIR=./prompts`
- `PROMPT_VERSION=2026-03-26-v1`
- `ENABLE_STREAMING=false`

The proxy is designed to reject unknown models, reject `stream=true` in v1, and fail fast when the active prompt profile file is missing.

## Model Aliases

The stable client-facing aliases are:

- `default` -> `gpt-oss:20b`
- `fast` -> `qwen3:8b`
- `smart` -> `gpt-oss:20b`
- `grist-default` -> `gpt-oss:20b`

The proxy only resolves models that are either explicit aliases or are otherwise allowlisted in configuration. That keeps the client surface predictable and avoids accidental passthrough to arbitrary upstream model IDs.

## Prompt Profiles

Prompt text lives in `./prompts` and is loaded at startup.

- `general.txt` is the default local assistant profile for non-Grist use.
- `grist.txt` is the spreadsheet-oriented profile for Grist-assisted work.

Set `PROMPT_PROFILE` to choose which file is injected. Set `PROMPT_INJECTION_ENABLED=false` to disable prompt injection entirely for troubleshooting.

## Health Checks

- `GET /healthz` reports process health only.
- `GET /readyz` verifies Ollama reachability, model discovery, and required model resolution.

Example:

```bash
curl http://127.0.0.1:3331/healthz
curl http://127.0.0.1:3331/readyz
```

## API Examples

All protected endpoints require:

```text
Authorization: Bearer $PROXY_API_KEY
```

### List models

```bash
curl -s \
  -H "Authorization: Bearer $PROXY_API_KEY" \
  http://127.0.0.1:3331/v1/models
```

### Chat completion with the default model

```bash
curl -s \
  -H "Authorization: Bearer $PROXY_API_KEY" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3331/v1/chat/completions \
  -d '{
    "model": "default",
    "messages": [
      {"role": "user", "content": "Write a one-line summary of the service."}
    ]
  }'
```

### Chat completion with the fast alias

```bash
curl -s \
  -H "Authorization: Bearer $PROXY_API_KEY" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3331/v1/chat/completions \
  -d '{
    "model": "fast",
    "messages": [
      {"role": "user", "content": "Give me a concise implementation note."}
    ],
    "temperature": 0.2
  }'
```

### Invalid token

```bash
curl -i \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3331/v1/chat/completions \
  -d '{
    "model": "default",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

### Invalid model

```bash
curl -i \
  -H "Authorization: Bearer $PROXY_API_KEY" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3331/v1/chat/completions \
  -d '{
    "model": "not-allowed",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

## Error Behavior

Errors use a simple OpenAI-style envelope:

```json
{
  "error": {
    "message": "Human-readable message",
    "type": "upstream_error",
    "code": "ollama_timeout"
  }
}
```

Common failure cases are handled explicitly:

- Missing or invalid bearer token returns `401`.
- Missing or malformed chat input returns `400`.
- Unknown model alias or disallowed model returns `400`.
- Ollama reachability or timeout failures return `502` or `504`.

## PM2

The included PM2 config runs one forked process with restart enabled and watch disabled.

```bash
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs local-llm-proxy
pm2 restart local-llm-proxy
pm2 save
pm2 startup
```

## Optional NGINX Note

The simplest deployment is to keep the proxy on localhost and let local clients call it directly. If you do place NGINX in front of it, keep the configuration explicit and simple:

- Proxy a single location to `127.0.0.1:3331`.
- Forward the `Authorization` header untouched.
- Avoid complex path rewriting.
- Disable proxy buffering only if you later enable streaming.
