'use strict';

const { errorEnvelopeSchema } = require('./common');

const chatCompletionsSchema = {
  body: {
    type: 'object',
    required: ['messages'],
    additionalProperties: true,
    properties: {
      model: { type: 'string' },
      messages: { type: 'array' },
      stream: { type: 'boolean' },
      temperature: { type: 'number' },
      top_p: { type: 'number' },
      max_tokens: { type: 'integer' },
      stop: {
        anyOf: [
          { type: 'string' },
          {
            type: 'array',
            items: { type: 'string' },
          },
        ],
      },
      tools: { type: 'array' },
      tool_choice: {},
      response_format: { type: 'object' },
      user: { type: 'string' },
    },
  },
  response: {
    400: errorEnvelopeSchema,
    401: errorEnvelopeSchema,
    500: errorEnvelopeSchema,
    502: errorEnvelopeSchema,
    504: errorEnvelopeSchema,
  },
};

module.exports = {
  chatCompletionsSchema,
};
