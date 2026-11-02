/**
 * @jest-environment jsdom
 */

'use strict';

// A comment stored before the approval decision existed has no `decision`
// field: the comments are read with `.lean()`, which does not apply the
// schema's default. Read as a bare name, Knockout threw on such a comment and
// the whole list broke. Rendered from the template the editor ships.

const fs = require('fs');
const path = require('path');
const ko = require('knockout');

const TOOLBOX = fs.readFileSync(
  path.join(
    __dirname,
    '../../../packages/editor/src/tmpl-badsender/toolbox.tmpl.html'
  ),
  'utf8'
);

// From the approval badge's `ko if` to the end of the changes-requested one,
// however the field is read.
const BADGES = /<!-- ko if: [^>]*decision === 'approved' -->[\s\S]*?<!-- ko if: [^>]*decision === 'changes_requested' -->[\s\S]*?<!-- \/ko -->/.exec(
  TOOLBOX
)[0];

function render(comments) {
  const host = document.createElement('div');
  host.innerHTML = `<div data-bind="foreach: comments"><div class="item">${BADGES}</div></div>`;
  document.body.appendChild(host);
  ko.applyBindings(
    { comments, getDecisionLabel: (decision) => decision },
    host
  );
  return Array.from(host.querySelectorAll('.item')).map((item) =>
    Array.from(item.querySelectorAll('.comment-badge-decision')).map(
      (badge) => badge.className.match(/comment-badge-(approved|changes)/)[1]
    )
  );
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the decision badge of a comment', () => {
  it('renders a comment stored without a decision, and the ones after it', () => {
    expect(
      render([{ text: 'old' }, { decision: 'approved' }, { decision: null }])
    ).toEqual([[], ['approved'], []]);
  });

  it('shows a request for changes', () => {
    expect(render([{ decision: 'changes_requested' }])).toEqual([['changes']]);
  });
});
