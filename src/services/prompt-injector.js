'use strict';

function createPromptInjector(config) {
  function inject(messages) {
    if (!config.prompts.enabled) {
      return messages.slice();
    }

    return [
      {
        role: 'system',
        content: config.prompts.text,
      },
      ...messages,
    ];
  }

  return {
    inject,
  };
}

module.exports = {
  createPromptInjector,
};
