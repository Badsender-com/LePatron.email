'use strict';

// The app is white-labelled: the screens of the MCP take their colors from
// the theme and the design tokens (docs/UX_GUIDELINES.md), never by hand.
// A shadow keeps its own.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../..');
const SCREENS = [
  'packages/ui/routes/groups/_groupId/settings/mcp-clients.vue',
  'packages/ui/components/mcp-clients/mcp-client-settings.vue',
  'packages/ui/routes/oauth/consent/_uid.vue',
];

const colorLinesOf = (file) =>
  fs
    .readFileSync(path.join(ROOT, file), 'utf8')
    .split('\n')
    .filter((line) => !/box-shadow/.test(line))
    .filter((line) => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(line));

describe.each(SCREENS)('%s', (file) => {
  it('writes no color by hand', () => {
    expect(colorLinesOf(file)).toEqual([]);
  });
});
