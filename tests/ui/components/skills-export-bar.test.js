/**
 * @jest-environment jsdom
 */
'use strict';

// The export bar of the skills (ADR 0018), mounted: the expertises the
// selected task skills consume, read from the list without asking the server
// for each skill, each one that can be taken out of the file and back in, and
// an export the server refuses says why.

const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const vuex = require('vuex');
const download = require('~/helpers/skills-export-download.js');
const constants = require('../../../packages/shared/ai-skill/constants.js');

const FILE = 'packages/ui/components/ai-skill/bs-ai-skills-export-bar.vue';

const skill = (skillId, nature, consumedExpertiseIds) => ({
  skillId,
  activeVersion: { major: 1, minor: 0, nature, consumedExpertiseIds },
});
const WRITE = skill('redaction.write', 'task', ['tone', 'brand']);
const REVIEW = skill('qc.review', 'task', ['brand', 'spam']);
const SUBJECT = skill('redaction.subject', 'feature', ['ignored']);

function mountBar({ skills = [], expertiseIds = [], post } = {}) {
  const commit = jest.fn();
  const $axios = {
    $get: jest.fn(),
    post: post || jest.fn().mockResolvedValue({ data: '{}', headers: {} }),
  };
  const vm = mountSfc(FILE, {
    props: { skills, expertiseIds },
    mocks: {
      $axios,
      $t: (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
      $tc: (key) => key,
      $store: {
        commit,
        _modulesNamespaceMap: { 'page/': { context: { commit } } },
      },
    },
    imports: {
      vuex,
      'lucide-vue': { Download: {} },
      '~/store/page.js': { PAGE: 'page', SHOW_SNACKBAR: 'SHOW_SNACKBAR' },
      '~/helpers/skills-export-download.js': download,
      '../../../shared/ai-skill/constants.js': constants,
    },
  });
  return { vm, $axios, commit };
}

const chips = (vm) =>
  [...vm.$el.querySelectorAll('v-chip')].map((el) => el.textContent.trim());
const chip = (vm, id) =>
  [...vm.$el.querySelectorAll('v-chip')].find(
    (el) => el.textContent.trim() === id
  );
const exportButton = (vm) => vm.$el.querySelector('v-btn');

beforeAll(() => {
  window.URL.createObjectURL = jest.fn(() => 'blob:file');
  window.URL.revokeObjectURL = jest.fn();
  // The download link is clicked: jsdom does not navigate.
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

describe('the expertises a selection brings', () => {
  it('are read from the list, never from each skill', async () => {
    const { vm, $axios } = mountBar({ skills: [WRITE, REVIEW, SUBJECT] });
    await settle(vm);

    expect(chips(vm)).toEqual(['tone', 'brand', 'spam']);
    expect($axios.$get).not.toHaveBeenCalled();
  });

  it('leave out those already selected', async () => {
    const { vm } = mountBar({ skills: [WRITE], expertiseIds: ['tone'] });
    await settle(vm);

    expect(chips(vm)).toEqual(['brand']);
  });

  it('are left out of the file one by one', async () => {
    const { vm, $axios } = mountBar({ skills: [WRITE] });
    await settle(vm);

    chip(vm, 'tone').dispatchEvent(new Event('click:close'));
    await settle(vm);
    expect(chips(vm)).toEqual(['brand']);

    exportButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);
    expect($axios.post.mock.calls[0][1]).toEqual({
      skillIds: ['redaction.write'],
      expertiseIds: [],
      withoutExpertiseIds: ['tone'],
    });
  });
});

describe('an expertise taken out', () => {
  it('is back when its skill is unselected then selected again', async () => {
    const { vm, $axios } = mountBar({ skills: [WRITE] });
    await settle(vm);
    chip(vm, 'tone').dispatchEvent(new Event('click:close'));
    await settle(vm);

    vm._props.skills = [];
    await settle(vm);
    vm._props.skills = [WRITE];
    await settle(vm);

    expect(chips(vm)).toEqual(['tone', 'brand']);
    exportButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);
    expect($axios.post.mock.calls[0][1].withoutExpertiseIds).toEqual([]);
  });

  it('stays out while another selected skill still brings it', async () => {
    const { vm } = mountBar({ skills: [WRITE, REVIEW] });
    await settle(vm);
    chip(vm, 'brand').dispatchEvent(new Event('click:close'));
    await settle(vm);

    vm._props.skills = [REVIEW];
    await settle(vm);

    expect(chips(vm)).toEqual(['spam']);
  });
});

describe('an export the server refuses', () => {
  it('says the reason the server gives', async () => {
    const refused = Object.assign(new Error('Request failed'), {
      response: {
        status: 400,
        data: new Blob([
          JSON.stringify({ message: '"qc.review" is archived.' }),
        ]),
      },
    });
    const { vm, commit } = mountBar({
      skills: [REVIEW],
      post: jest.fn().mockRejectedValue(refused),
    });
    await settle(vm);

    exportButton(vm).dispatchEvent(new Event('click'));
    await settle(vm);

    expect(commit).toHaveBeenCalledWith('SHOW_SNACKBAR', {
      text: expect.stringContaining('is archived'),
      color: 'error',
    });
    expect(commit.mock.calls[0][1].text).toMatch(
      /^aiSkills\.export\.failedBecause /
    );
  });
});
