'use strict';

const authentication = require('./authentication');
const createLink = require('./creates/create_link');
const updateLink = require('./creates/update_link');
const { handleErrors, includeApiKey } = require('./lib/http');
const findLink = require('./searches/find_link');
const linkClicks = require('./searches/link_clicks');
const linksDropdown = require('./triggers/links_dropdown');
const newLink = require('./triggers/new_link');

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,
  // Every operation treats empty values as unset itself.
  flags: { cleanInputData: false },

  authentication,
  beforeRequest: [includeApiKey],
  afterResponse: [handleErrors],

  triggers: {
    [newLink.key]: newLink,
    [linksDropdown.key]: linksDropdown,
  },
  creates: {
    [createLink.key]: createLink,
    [updateLink.key]: updateLink,
  },
  searches: {
    [findLink.key]: findLink,
    [linkClicks.key]: linkClicks,
  },
  searchOrCreates: {
    [findLink.key]: {
      key: findLink.key,
      display: {
        label: 'Find or Create Link',
        description: 'Finds a link by short URL or alias, or creates it if none exists.',
      },
      search: findLink.key,
      create: createLink.key,
    },
  },
};
