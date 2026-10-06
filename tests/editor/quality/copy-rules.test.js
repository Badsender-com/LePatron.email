/**
 * @jest-environment jsdom
 */

'use strict';

const ko = require('knockout');
const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const { fakeViewModel, exportOf } = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const subject = require(`${RULES}/subject`);
const preheader = require(`${RULES}/preheader`);
const mergeTags = require(`${RULES}/merge-tags`);
const emptyBlocks = require(`${RULES}/empty-blocks`);
const uppercaseText = require(`${RULES}/uppercase-text`);

// A view model with a subject (email metadata on) and a preheader.
function copyViewModel({
  subjectValue,
  preheaderValue,
  preheaderDefault = '',
  ...rest
} = {}) {
  const vm = fakeViewModel(rest);
  const content = vm.content;
  vm.content = () => ({
    ...content(),
    ...(preheaderValue !== undefined && {
      preheaderText: ko.observable(preheaderValue),
    }),
  });
  vm.templateDefaults = { preheaderText: preheaderDefault };
  if (subjectValue !== undefined) {
    vm.emailMetadataStore = {
      isActive: () => true,
      snapshot: () => ({ subject: subjectValue }),
    };
  }
  return vm;
}

const findingsOf = (rule, options) =>
  runQualityChecks(copyViewModel(options), { rules: [rule] }).findings;
const keysOf = (rule, options) =>
  findingsOf(rule, options).map((f) => f.messageKey);

describe('subject', () => {
  it('says nothing when the editor does not hold the subject', () => {
    expect(findingsOf(subject, {})).toEqual([]);
  });

  it.each([
    ['', ['No subject']],
    ['a'.repeat(40), []],
    [
      'a'.repeat(41),
      [
        'Long subject (__count__ characters): ideally under 40, it may be cut on mobile',
      ],
    ],
    [
      'a'.repeat(61),
      [
        'Subject too long (__count__ characters): inboxes cut it, keep it under 60',
      ],
    ],
    [
      'RE: your order',
      [
        'Subject starts like a reply or a forward (__prefix__) without being one',
      ],
    ],
    [
      'TR : notre offre',
      [
        'Subject starts like a reply or a forward (__prefix__) without being one',
      ],
    ],
    ['HUGE SALE THIS WEEKEND', ['Subject mostly in capital letters']],
    ['Last chance!!', ['Subject repeats punctuation (!!, ??, $$)']],
    ['Sale 🔥🔥 today', ['Subject has more than one emoji']],
    ['Our nurses 👩‍⚕️ thank you', []],
    ['Sale in 🇫🇷🇧🇪', ['Subject has more than one emoji']],
    ['Brand® Line™ is back', []],
    ['Our spring collection is here', []],
  ])('judges "%s"', (subjectValue, keys) => {
    expect(keysOf(subject, { subjectValue })).toEqual(keys);
  });

  it('counts an emoji as one character', () => {
    const [finding] = findingsOf(subject, {
      subjectValue: `${'a'.repeat(40)}🔥`,
    });
    expect(finding.params.count).toBe(41);
  });
});

describe('preheader', () => {
  it('says nothing for a template without preheader', () => {
    expect(findingsOf(preheader, {})).toEqual([]);
  });

  it.each([
    ['', 'No preheader: inboxes show the first words of the body instead'],
    [
      'View it online',
      'Preheader still the sample text of the template: __text__',
    ],
    [
      'a'.repeat(101),
      'Long preheader (__count__ characters): its end will rarely be seen',
    ],
    [
      'a'.repeat(141),
      'Preheader too long (__count__ characters): inboxes cut it well before',
    ],
  ])('judges "%s"', (preheaderValue, key) => {
    expect(
      keysOf(preheader, { preheaderValue, preheaderDefault: 'View it online' })
    ).toEqual([key]);
  });

  it('never reports a short preheader', () => {
    expect(findingsOf(preheader, { preheaderValue: 'Hi there' })).toEqual([]);
  });

  it.each([
    ['Spring sale', 'Spring sale!'],
    ['Spring sale', 'spring  sale, up to 50% off'],
  ])(
    'warns when the preheader repeats the subject "%s"',
    (subjectValue, preheaderValue) => {
      expect(keysOf(preheader, { subjectValue, preheaderValue })).toEqual([
        'The preheader repeats the subject: inboxes show the same words twice',
      ]);
    }
  );

  it('reports a repeated subject and a preheader too long, both', () => {
    expect(
      keysOf(preheader, {
        subjectValue: 'Spring sale',
        preheaderValue: `Spring sale ${'a'.repeat(140)}`,
      })
    ).toEqual([
      'The preheader repeats the subject: inboxes show the same words twice',
      'Preheader too long (__count__ characters): inboxes cut it well before',
    ]);
  });

  it.each([
    ['New', 'New arrivals in store'],
    ['{{first_name}}', '{{first_name}}, discover our spring sale'],
    ['{{first_name}}, hello', 'Discover our spring sale'],
  ])(
    'leaves a preheader alone after the subject "%s"',
    (subjectValue, preheaderValue) => {
      expect(findingsOf(preheader, { subjectValue, preheaderValue })).toEqual(
        []
      );
    }
  );

  it('accepts a preheader that only shares words with the subject', () => {
    expect(
      findingsOf(preheader, {
        subjectValue: 'Spring sale',
        preheaderValue: 'Up to 50% off our spring sale',
      })
    ).toEqual([]);
  });

  it('accepts a preheader of the right length, merge tags aside', () => {
    const value =
      '{{first_name}}, discover our new spring collection before anyone else';
    expect(findingsOf(preheader, { preheaderValue: value })).toEqual([]);
  });
});

describe('merge-tags', () => {
  const blocks = [{ id: 'b1', type: 'textBlock' }];

  it.each([
    '<p>Hello {{first_name,</p>',
    '<p>Hello %%FIRSTNAME, welcome</p>',
    '<p>Hi *|FNAME, welcome</p>',
    '<a href="https://brand.com/?u={{id">Go</a>',
  ])('reports an unclosed tag in %s', (blockHtml) => {
    const html = exportOf({ b1: blockHtml });
    const [finding] = findingsOf(mergeTags, { blocks, html });
    expect(finding).toMatchObject({ severity: 'error', blockId: 'b1' });
  });

  it('reports one in the subject and the preheader', () => {
    const findings = findingsOf(mergeTags, {
      subjectValue: 'Hello {{name',
      preheaderValue: 'Welcome %%NAME',
    });
    expect(findings.map((f) => f.propertyPath)).toEqual([
      'subject',
      'preheader',
    ]);
  });

  it('leaves balanced tags alone', () => {
    const html = exportOf({
      b1: '<p>Hello {{first_name}}, %%CITY%% *|FNAME|*</p>',
    });
    expect(
      findingsOf(mergeTags, { blocks, html, subjectValue: 'Hi {{name}}' })
    ).toEqual([]);
  });
});

describe('empty-blocks', () => {
  const textDef = { type: 'textBlock', longText: '<p>Write here</p>' };
  const spacerDef = { type: 'spacerBlock', height: '20' };

  it('warns about a text block emptied by the client', () => {
    const html = exportOf({ b1: '<p> </p>' });
    const findings = findingsOf(emptyBlocks, {
      blocks: [{ id: 'b1', type: 'textBlock', longText: '' }],
      blockDefs: [textDef],
      html,
    });
    expect(findings).toHaveLength(1);
  });

  it('leaves spacers, blocks with an image and blocks with text alone', () => {
    const html = exportOf({ b1: '', b2: '<img src="a.jpg">', b3: '<p>Hi</p>' });
    const findings = findingsOf(emptyBlocks, {
      blocks: [
        { id: 'b1', type: 'spacerBlock' },
        { id: 'b2', type: 'textBlock' },
        { id: 'b3', type: 'textBlock' },
      ],
      blockDefs: [textDef, spacerDef],
      html,
    });
    expect(findings).toEqual([]);
  });

  it('never counts hidden text as shown', () => {
    const html = exportOf({ b1: '<p style="display:none">Hidden</p>' });
    const findings = findingsOf(emptyBlocks, {
      blocks: [{ id: 'b1', type: 'textBlock' }],
      blockDefs: [textDef],
      html,
    });
    expect(findings).toHaveLength(1);
  });
});

describe('uppercase-text', () => {
  const blocks = [{ id: 'b1', type: 'textBlock' }];

  it('notes a long passage in capital letters', () => {
    const html = exportOf({
      b1: '<p>Please NOTE THAT ALL ORDERS SHIP WITHIN TWO DAYS.</p>',
    });
    const [finding] = findingsOf(uppercaseText, { blocks, html });
    expect(finding.params.count).toBe(8);
  });

  it('leaves short acronyms and sentence case alone', () => {
    const html = exportOf({
      b1: '<p>Free shipping in the EU and UK, see FAQ.</p>',
    });
    expect(findingsOf(uppercaseText, { blocks, html })).toEqual([]);
  });
});
