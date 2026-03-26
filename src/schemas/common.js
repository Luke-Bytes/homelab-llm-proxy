'use strict';

const errorEnvelopeSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['message', 'type', 'code'],
      properties: {
        message: { type: 'string' },
        type: { type: 'string' },
        code: { type: 'string' },
      },
    },
  },
};

module.exports = {
  errorEnvelopeSchema,
};
