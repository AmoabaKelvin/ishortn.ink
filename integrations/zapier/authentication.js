'use strict';

const { BASE_URL } = require('./lib/http');

// GET /me answers with { id, email, name, plan, defaultDomain }.
const test = async (z) => {
  const response = await z.request({ url: `${BASE_URL}/me` });
  return response.data;
};

module.exports = {
  // "custom" is the catch-all auth type; the schema has no dedicated API-key type.
  type: 'custom',
  fields: [
    {
      key: 'api_key',
      label: 'API key',
      required: true,
      type: 'password',
      helpText:
        'Create a key in iShortn under [Settings → API Keys](https://ishortn.ink/dashboard/settings#api-keys). API keys need a Pro or Ultra plan.',
    },
  ],
  test,
  connectionLabel: '{{email}}',
};
