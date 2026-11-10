/**
 * @jest-environment jsdom
 */
'use strict';

// The report of an import of a skills export (ADR 0018), mounted: how many
// items each outcome holds, each draft to publish with what to know before
// publishing it, and why an item was skipped or failed. It is announced as it
// comes.

const Vue = require('vue');
const { get } = require('lodash');
const { mountSfc } = require('../../helpers/mount-sfc.js');
const skillsImport = require('~/helpers/skills-import.js');

const FILE = 'packages/ui/components/ai-skill/bs-ai-skills-import-report.vue';

// The words the application has, as `$te` finds them.
const fr = require('~/helpers/locales/fr.js').default;

const KNOWN = { 'aiSkills.natures.task': 'Task skill' };
// The words of a failure are the application's own, filled as vue-i18n
// fills them; any other key shows what it is filled with.
const REAL = ['aiSkills.errors.', 'skillsImport.report.failedItem'];
const interpolated = (text, params = {}) =>
  text.replace(/\{(\w+)\}/g, (all, name) =>
    name in params ? String(params[name]) : all
  );
const t = (key, params) => {
  if (key in KNOWN) return KNOWN[key];
  if (REAL.some((prefix) => key.startsWith(prefix))) {
    return interpolated(get(fr, key), params);
  }
  return params && Object.keys(params).length
    ? `${key} ${JSON.stringify(params)}`
    : key;
};
const te = (key) => key in KNOWN || get(fr, key) !== undefined;

Vue.component('NuxtLink', {
  props: { to: { type: String, default: '' } },
  render(h) {
    return h('a', { attrs: { href: this.to } }, this.$slots.default);
  },
});

const REPORT = {
  created: [
    {
      kind: 'skill',
      id: 'redaction.write',
      version: '1.0',
      warnings: [{ code: 'missing_expertises', expertiseIds: ['tone'] }],
    },
  ],
  updated: [
    {
      kind: 'skill',
      id: 'qc.review',
      version: '2.0',
      warnings: [
        { code: 'nature_differs', nature: 'task', current: 'feature' },
      ],
    },
    { kind: 'expertise', id: 'brand', version: '1.1' },
  ],
  skipped: [
    { kind: 'skill', id: 'gone', reason: 'not_in_file' },
    { kind: 'expertise', id: 'same', version: '1.0', reason: 'up_to_date' },
  ],
  failed: [
    {
      kind: 'skill',
      id: 'qc.draft',
      version: '1.0',
      message: 'SKILLS_IMPORT_DRAFT_OPEN',
    },
    { kind: 'skill', id: 'broken', version: '1.0', message: 'Some error' },
  ],
};

function mountReport(report = REPORT) {
  return mountSfc(FILE, {
    props: { report },
    mocks: { $t: t, $tc: (key, n) => `${key} (${n})`, $te: te },
    imports: {
      'lucide-vue': {},
      '~/helpers/skills-import.js': skillsImport,
    },
  });
}

const texts = (vm, selector) =>
  [...vm.$el.querySelectorAll(selector)].map((el) =>
    el.textContent.replace(/\s+/g, ' ').trim()
  );

describe('the report of an import', () => {
  it('is announced as it comes', () => {
    const vm = mountReport();
    expect(vm.$el.getAttribute('role')).toBe('status');
    expect(vm.$el.getAttribute('aria-live')).toBe('polite');
  });

  it('counts only the outcomes that happened', () => {
    const vm = mountReport({ ...REPORT, failed: [] });
    expect(texts(vm, '.bs-ai-skills-import-report__counts span')).toEqual([
      'skillsImport.report.created (1)',
      'skillsImport.report.updated (2)',
      'skillsImport.report.skipped (2)',
    ]);
  });

  it('gives each draft what to know before publishing it', () => {
    const vm = mountReport();
    const items = [
      ...vm.$el.querySelectorAll('.bs-ai-skills-import-report__item'),
    ];

    expect(
      items.map((li) => li.querySelector('a').getAttribute('href'))
    ).toEqual([
      '/ai-skills/redaction.write',
      '/ai-skills/qc.review',
      '/ai-expertise/brand',
    ]);
    expect(
      items.map((li) =>
        [
          ...li.querySelectorAll('.bs-ai-skills-import-report__warning'),
        ].map((el) => el.textContent.trim())
      )
    ).toEqual([
      ['skillsImport.warnings.missing_expertises {"ids":"tone","nature":""}'],
      ['skillsImport.warnings.nature_differs {"ids":"","nature":"Task skill"}'],
      [],
    ]);
  });

  it('says why an item was skipped, an item missing from the file too', () => {
    const vm = mountReport();
    expect(texts(vm, '.bs-ai-skills-import-report__skipped')).toEqual([
      'skillsImport.report.skippedItem {"id":"gone","reason":"skillsImport.reasons.not_in_file"}',
      'skillsImport.report.skippedItem {"id":"same","reason":"skillsImport.states.up_to_date"}',
    ]);
  });

  it('says why an item failed, in words filled with the item when the server gives a code', () => {
    const vm = mountReport();
    const failed = texts(vm, '.bs-ai-skills-import-report__failed');

    expect(failed).toEqual([
      'qc.draft : Un brouillon est ouvert sur qc.draft : publiez-le ou supprimez-le, puis importez de nouveau la version 1.0.',
      'broken : Some error',
    ]);
    failed.forEach((text) => expect(text).not.toContain('{'));
  });

  it('closes the modal when a draft is opened', () => {
    const vm = mountReport();
    const leave = jest.fn();
    vm.$on('leave', leave);

    vm.$el.querySelector('a').dispatchEvent(new Event('click'));

    expect(leave).toHaveBeenCalled();
  });
});
