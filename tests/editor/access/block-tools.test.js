/**
 * @jest-environment jsdom
 */

'use strict';

// The tools of a block in the canvas, for each role: what a role may not do
// is not offered, rendered from the template the editor ships.

const fs = require('fs');
const path = require('path');
const ko = require('knockout');
const { userCan } = require('../../../packages/editor/src/js/ext/user-can.js');
const { ROLES } = require('../../../packages/shared/access/roles.js');
const { userOfRole } = require('../helpers/current-user.js');

const TEMPLATE = fs.readFileSync(
  path.join(
    __dirname,
    '../../../packages/editor/src/tmpl/block-wysiwyg.tmpl.html'
  ),
  'utf8'
);

// The block's tool bar, up to the block's content.
const TOOLS = /<div class="tools"[\s\S]*?(?=\n\s*<!-- `inert`)/.exec(
  TEMPLATE
)[0];

// The first block: it moves down, not up.
const STRUCTURE = ['handle', 'movedown', 'clone', 'variant', 'delete'];
const TOOLS_BY_ROLE = {
  [ROLES.SUPER_ADMIN]: [...STRUCTURE, 'save', 'comment', 'content-feed'],
  [ROLES.GROUP_ADMIN_TECH]: [...STRUCTURE, 'save', 'comment', 'content-feed'],
  [ROLES.GROUP_ADMIN]: [...STRUCTURE, 'save', 'comment', 'content-feed'],
  [ROLES.REGULAR_USER]: [...STRUCTURE, 'save', 'comment', 'content-feed'],
  [ROLES.WRITER]: ['comment', 'content-feed'],
  [ROLES.REVIEWER]: ['comment'],
};

function toolsOf(role) {
  const vm = { currentUser: userOfRole(role) };
  const root = {
    blocks: ko.observableArray([
      { id: 'b1', _nextVariant: () => {} },
      { id: 'b2', _nextVariant: () => {} },
    ]),
    t: (key) => key,
    userCan: (capability) => userCan(vm, capability),
    metadata: { hasTranslationFeature: false },
    moveBlock: () => {},
    duplicateBlock: () => {},
    saveBlock: () => {},
    commentBlock: () => {},
    removeBlock: () => {},
    translateBlock: () => {},
    openContentFeedModal: () => {},
    isFeedMappableBlock: () => true,
  };
  const host = document.createElement('div');
  host.innerHTML = `<div data-bind="foreach: blocks">${TOOLS}</div>`;
  document.body.appendChild(host);
  ko.applyBindings(root, host);
  const firstBlock = host.querySelector('.tools');
  return Array.from(firstBlock.querySelectorAll('.tool')).map(
    (tool) => tool.className.replace('tool ', '').split(' ')[0]
  );
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the tools of a block', () => {
  it('covers every role of the product', () => {
    expect(Object.keys(TOOLS_BY_ROLE).sort()).toEqual(
      Object.values(ROLES).slice().sort()
    );
  });

  it.each(Object.entries(TOOLS_BY_ROLE))('for a %s', (role, expected) => {
    expect(toolsOf(role).sort()).toEqual(expected.slice().sort());
  });
});
