'use strict';

// A profile the user does not reach answers 404, like one that does not
// exist. The export modal falls back from editing a campaign to creating one
// on a 404 of the campaign; a 404 of the profile itself, in creation, is an
// error to show, not a reason to ask again.
//
// The project has no @vue/test-utils: the condition is read off the source.

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(
    __dirname,
    '../../packages/editor/src/js/vue/components/esp/esp-send-mail.js'
  ),
  'utf8'
);

it('falls back to a creation only from an edition', () => {
  expect(source).toMatch(
    /error\.response\?\.status === 404 &&\s*this\.type !== SEND_MODE\.CREATION/
  );
});
