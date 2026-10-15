/**
 * @jest-environment jsdom
 */

'use strict';

const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const { copyViewModel } = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const subject = require(`${RULES}/subject`);
const preheader = require(`${RULES}/preheader`);

const findingsOf = (rule, options) =>
  runQualityChecks(copyViewModel(options), { rules: [rule] }).findings;
const checksOf = (rule, options) =>
  runQualityChecks(copyViewModel(options), { rules: [rule] }).checks;
const keysOf = (rule, options) =>
  findingsOf(rule, options).map((f) => f.messageKey);

const LONG_SUBJECT =
  'Long subject (__count__ characters): ideally under 40, it may be cut on mobile';
const TOO_LONG_SUBJECT =
  'Subject too long (__count__ characters): inboxes cut it, keep it under 60';
const FAKE_REPLY =
  'Subject starts like a reply or a forward (__prefix__) without being one';

describe('subject', () => {
  it('is not listed when the editor does not hold the subject', () => {
    expect(checksOf(subject, {})).toEqual([]);
  });

  it('is listed, with its length, when it holds it', () => {
    expect(
      checksOf(subject, { subjectValue: 'Our spring collection' })
    ).toEqual([
      expect.objectContaining({ status: 'passed', passParams: { count: 21 } }),
    ]);
  });

  it.each([
    ['', ['No subject']],
    ['a'.repeat(40), []],
    ['a'.repeat(41), [LONG_SUBJECT]],
    ['a'.repeat(60), [LONG_SUBJECT]],
    ['a'.repeat(61), [TOO_LONG_SUBJECT]],
    ['RE: your order', [FAKE_REPLY]],
    ['TR : notre offre', [FAKE_REPLY]],
    ['FWD:Important', [FAKE_REPLY]],
    ['Re:Think different', []],
    ['re:boot your routine', []],
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

  it('counts as an inbox shows: one emoji is one character, a merge tag none', () => {
    const base = 'a'.repeat(38);
    expect(
      keysOf(subject, { subjectValue: `${base} 👩‍⚕️ {{first_name}}` })
    ).toEqual([]);
    expect(keysOf(subject, { subjectValue: `${base}a ☝🏽` })).toEqual([
      LONG_SUBJECT,
    ]);
    expect(
      checksOf(subject, { subjectValue: `${base} 👩‍⚕️ {{first_name}}` })[0]
        .passParams
    ).toEqual({ count: 40 });
  });

  it('counts an accent typed as two code points as one character', () => {
    const [finding] = findingsOf(subject, { subjectValue: 'é'.repeat(60) });
    expect(finding).toMatchObject({
      messageKey: LONG_SUBJECT,
      params: { count: 60 },
    });
  });
});

describe('preheader', () => {
  it('is not listed for a template without preheader', () => {
    expect(checksOf(preheader, {})).toEqual([]);
  });

  it('is not listed when the template declares one preheader per market', () => {
    expect(
      checksOf(preheader, {
        preheaderValue: 'Generic',
        rootContent: {
          autPreheaderText: 'Servus',
          bel_frPreheaderText: 'Salut',
        },
      })
    ).toEqual([]);
  });

  it('is listed, with its length, otherwise', () => {
    expect(
      checksOf(preheader, { preheaderValue: 'Hi {{first_name}}' })
    ).toEqual([
      expect.objectContaining({ status: 'passed', passParams: { count: 2 } }),
    ]);
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

  it('reads 100 characters as fine, and 140 as long only', () => {
    expect(keysOf(preheader, { preheaderValue: 'a'.repeat(100) })).toEqual([]);
    expect(keysOf(preheader, { preheaderValue: 'a'.repeat(140) })).toEqual([
      'Long preheader (__count__ characters): its end will rarely be seen',
    ]);
  });

  it('never reports a short preheader', () => {
    expect(findingsOf(preheader, { preheaderValue: 'Hi there' })).toEqual([]);
  });

  it.each([
    ['Spring sale', 'Spring sale!'],
    ['Spring sale', 'spring  sale, up to 50% off'],
    ['Spring sale', '« Spring sale ! »'],
    ['Spring sale 🔥', 'Spring sale'],
    ['Été indien', 'Été indien'],
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

  it('keeps "too long" findable once "repeats the subject" was ignored', () => {
    const preheaderValue = `Spring sale ${'a'.repeat(140)}`;
    const [repeats, tooLong] = findingsOf(preheader, {
      subjectValue: 'Spring sale',
      preheaderValue,
    });
    expect(repeats.fingerprint).not.toBe(tooLong.fingerprint);

    // The subject changes: "repeats" goes, "too long" keeps its fingerprint.
    const [stillTooLong] = findingsOf(preheader, {
      subjectValue: 'Summer sale',
      preheaderValue,
    });
    expect(stillTooLong.fingerprint).toBe(tooLong.fingerprint);
  });

  it.each([
    ['New', 'New arrivals in store'],
    ['{{first_name}}', '{{first_name}}, discover our spring sale'],
    ['{{first_name}}, new', 'New arrivals in store'],
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
