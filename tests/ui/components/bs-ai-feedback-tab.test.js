/**
 * @jest-environment jsdom
 */
'use strict';

// The feedbacks of a skill or an expertise (ADR 0012), read by the platform's
// operators a page at a time. Mounted, with the server simulated: the pages
// shown in turn, a feedback never shown twice, an error on a next page told
// under what is shown. The app is white-labelled: its colors come from the
// theme.

const fs = require('fs');
const path = require('path');
const { mountSfc, settle } = require('../../helpers/mount-sfc.js');

const FILE = 'packages/ui/components/ai-skill/bs-ai-feedback-tab.vue';
const source = fs.readFileSync(path.join(__dirname, '../../..', FILE), 'utf8');

const feedback = (id, comment) => ({
  id,
  rating: 'up',
  comment,
  group: { id: 'g1', name: 'A client' },
  references: [{ kind: 'skill', id: 'qc.review', version: '1.0' }],
  retex: null,
  createdAt: '2026-11-01T10:00:00Z',
});

function mountWith(pages) {
  const $get = jest.fn((url, { params }) => pages[params.page - 1]());
  const vm = mountSfc(FILE, {
    props: { kind: 'skill', referenceId: 'qc.review' },
    mocks: {
      $axios: { $get },
      $t: (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
    },
    imports: {
      '~/components/bs-timestamp.vue': {},
      'lucide-vue': { ThumbsUp: {}, ThumbsDown: {} },
    },
  });
  return { vm, $get };
}

const comments = (vm) =>
  [...vm.$el.querySelectorAll('.feedback-row v-list-item-title')].map((el) =>
    el.textContent.trim()
  );
const moreButton = (vm) =>
  [...vm.$el.querySelectorAll('v-btn')].find((el) =>
    el.textContent.includes('aiSkills.feedback.more')
  );
const errorShown = (vm) =>
  vm.$el.textContent.includes('global.errors.errorOccured');

describe('the feedback tab', () => {
  it('shows the pages in turn, each feedback once, and an error on a next page under them', async () => {
    const { vm, $get } = mountWith([
      async () => ({
        items: [feedback('a', 'First'), feedback('b', 'Second')],
        total: 4,
      }),
      // A feedback sent since shifted the page: "Second" comes again.
      async () => ({
        items: [feedback('b', 'Second'), feedback('c', 'Third')],
        total: 4,
      }),
      async () => {
        throw new Error('Network Error');
      },
    ]);
    await settle(vm);

    expect(comments(vm)).toEqual(['First', 'Second']);
    expect(errorShown(vm)).toBe(false);

    moreButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);

    expect(comments(vm)).toEqual(['First', 'Second', 'Third']);

    moreButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);

    expect($get.mock.calls.map(([, { params }]) => params.page)).toEqual([
      1,
      2,
      3,
    ]);
    expect(comments(vm)).toEqual(['First', 'Second', 'Third']);
    expect(errorShown(vm)).toBe(true);
    expect(moreButton(vm)).toBeDefined();
  });

  it('offers no next page once every feedback is shown', async () => {
    const { vm } = mountWith([
      async () => ({ items: [feedback('a', 'Only')], total: 1 }),
    ]);
    await settle(vm);

    expect(comments(vm)).toEqual(['Only']);
    expect(moreButton(vm)).toBeUndefined();
  });

  it('writes no color by hand', () => {
    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toMatch(/\bcolor="(?!accent)/);
  });

  it('colors the ratings with the theme', () => {
    expect(source).toMatch(/color: var\(--v-success-base\)/);
    expect(source).toMatch(/color: var\(--v-error-base\)/);
  });
});
