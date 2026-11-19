/**
 * @jest-environment jsdom
 */

'use strict';

// Every check, run on a clean email and on one full of faults, says something
// a reader can read in each language: no rule throws, and no message, found
// or passed, keeps a `__param__` its params do not fill.

const _ = require('lodash');
const {
  runQualityChecks,
  DEFAULT_RULES,
  REMOTE_RULES,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const {
  messageText,
} = require('../../../packages/editor/src/js/ext/quality/message-params.js');
const {
  CHECKS,
  defaultQualitySettings,
} = require('../../../packages/shared/quality/checks.js');
const { copyViewModel, exportOf, fakeViewModel } = require('./fake-view-model');
const { remoteOf } = require('./remote-fixtures');

const STRINGS = {
  en: require('../../../public/lang/badsender-en.js'),
  fr: require('../../../public/lang/badsender-fr.js'),
};

const RULES = DEFAULT_RULES.concat(REMOTE_RULES);
const KB = 1024;

// The editor's translation (app.js): the language's string, then the params.
const translator = (strings) => (key, params = {}) =>
  Object.keys(params).reduce(
    (text, name) =>
      text.replace(new RegExp(`__${name}__`, 'g'), () => params[name]),
    strings[key] === undefined ? key : strings[key]
  );

// What the drawer shows (quality-items.js).
const readable = (lang, key, params) =>
  messageText(translator(STRINGS[lang]), key, params, { locale: lang });

// A translation with no strings that pastes each value as it gets it, as
// viewModel.tt does: whatever shows a message through messageText with it
// must still get text, never "[object Object]".
const naiveT = fakeViewModel().t;

const FAULTY_TEXT = [
  '<p style="text-align:justify;line-height:0.9;font-size:9px">',
  'BUY THIS AMAZING OFFER RIGHT NOW TODAY 🔥🔥 Hello {{firstname</p>',
  '<p style="line-height:1.2">Tight but not overlapping</p>',
  '<p style="display:none">Hidden text</p>',
  `<p style="text-align:center">${'word '.repeat(60)}</p>`,
  '<p style="color:#eeeeee">Low contrast</p>',
  '<h2>Offer</h2><h4>Details</h4><h3></h3>',
  '<p style="color:#333333">Read <a href="https://brand.test/terms" style="color:#333333;text-decoration:none">our terms</a> first.</p>',
  '<a href="https://bit.ly/abc">Short</a>',
  '<a href="#toreplace">Click here</a>',
  '<a href="http://brand.test/a b">www.other.test</a>',
  '<a href="https://www.shady.co.uk/offer">Offer</a>',
  '<a href="https://bad.test/login">Log in</a>',
  '<a href="https://gone.test/">Gone</a>',
  '<a href="https://slow.test/">Slow</a>',
].join('');

const FAULTY_IMAGES = [
  '<a href="https://brand.test/"><img src="https://cdn.test/a.jpg" width="300" alt=""></a>',
  '<img src="https://cdn.test/b.gif" width="600" alt="image of the offer">',
  `<img src="https://cdn.test/c.bmp" width="600" alt="${'long '.repeat(60)}">`,
  '<img src="https://cdn.test/gone.png" width="600">',
  '<img src="https://cdn.test/d.jpg" alt="New serum"><p>New serum</p>',
  '<a href="#toreplace"><img src="https://cdn.test/x.png"></a>',
  '<img src="http://localhost:3000/api/images/placeholder/300x360.png" width="300">',
  '<img src="https://cdn.test/hero.webp">',
].join('');

const FAULTY_CODE = [
  '<script>alert(1)</script>',
  '<div><span>Hello</div>',
  '<style>.a { display: flex }</style>',
  '<a href="/offer">Go</a>',
].join('');

const FAULTY_REMOTE = {
  ...remoteOf({
    links: {
      'https://gone.test/': { state: 'broken', httpStatus: 404 },
      'https://slow.test/': { state: 'unverifiable', reason: 'timeout' },
    },
    images: {
      'https://cdn.test/a.jpg': {
        state: 'ok',
        bytes: 800 * KB,
        type: 'jpg',
        width: 1200,
      },
      'https://cdn.test/b.gif': {
        state: 'ok',
        bytes: 1500 * KB,
        type: 'gif',
        width: 600,
        atLeast: true,
      },
      'https://cdn.test/c.bmp': { state: 'ok', bytes: 10 * KB, width: 600 },
      'https://cdn.test/gone.png': { state: 'unreachable' },
    },
    blocklists: {
      enabled: true,
      listed: { 'shady.co.uk': ['Spamhaus DBL'] },
      unchecked: ['brand.test'],
    },
  }),
  webRisk: {
    enabled: true,
    threats: { 'https://bad.test/login': ['SOCIAL_ENGINEERING'] },
    unchecked: ['https://slow.test/'],
  },
};

const textDef = { type: 'textBlock', longText: '<p>Sample</p>' };
const heroDef = {
  type: 'heroBlock',
  bgOptions: {
    bgimage: 'https://cdn.test/bg-placeholder.png',
    outlookBgImage: '',
    mobileBgimage: '',
  },
};

const EMAILS = {
  clean: {
    subjectValue: 'Our new collection',
    preheaderValue: 'Discover what is new this season, in store and online',
    blocks: [{ id: 'b1', type: 'textBlock', longText: '<p>Hello</p>' }],
    blockDefs: [textDef],
    html: exportOf({
      b1: `<p>${'Our new collection is here. '.repeat(
        10
      )}</p><a href="https://brand.test/">Shop the collection</a>`,
    }),
    remote: remoteOf({
      links: { 'https://brand.test/': { state: 'ok', httpStatus: 200 } },
    }),
  },
  faulty: {
    subjectValue: `RE: HUGE SALE!!! 🔥🔥 ${'on everything '.repeat(6)}`,
    preheaderValue: 'x'.repeat(200),
    blocks: [
      { id: 'b1', type: 'textBlock', longText: FAULTY_TEXT },
      { id: 'b2', type: 'imageBlock' },
      { id: 'b3', type: 'textBlock', longText: '' },
      { id: 'b4', type: 'htmlCodeBlock', htmlCode: FAULTY_CODE },
      {
        id: 'b5',
        type: 'heroBlock',
        bgOptions: { outlookBgImageVisible: true, outlookBgImage: '' },
      },
    ],
    blockDefs: [textDef, { type: 'imageBlock' }, heroDef],
    html: exportOf({
      b1: FAULTY_TEXT,
      b2: FAULTY_IMAGES,
      b3: '',
      b4: FAULTY_CODE,
      b5: '',
    }),
    trackingConfig: {
      enabled: true,
      params: [{ key: 'utm_source', required: true }],
    },
    remote: FAULTY_REMOTE,
  },
  'images only': {
    subjectValue: 'Our new collection',
    blocks: [{ id: 'b1', type: 'imageBlock' }],
    html: exportOf({ b1: '<img src="https://cdn.test/a.jpg" alt="">' }),
    remote: remoteOf({
      images: {
        'https://cdn.test/a.jpg': { state: 'ok', bytes: 80 * KB, width: 600 },
      },
    }),
  },
  heavy: {
    subjectValue: 'Our new collection',
    blocks: [{ id: 'b1', type: 'textBlock', longText: '<p>Hello</p>' }],
    blockDefs: [textDef],
    html: exportOf({ b1: `<p>${'a'.repeat(160 * KB)}</p>` }),
    remote: remoteOf(),
  },
};

// Every threshold of the catalogue at one of its bounds, or its default.
function settingsAt(bound) {
  const settings = defaultQualitySettings();
  if (bound === 'default') return settings;
  Object.entries(CHECKS).forEach(([id, check]) => {
    settings.checks[id].thresholds = _.mapValues(
      check.thresholds,
      (threshold) => threshold[bound]
    );
  });
  return settings;
}

function contextOf({ remote, ...email }, settings) {
  const vm = copyViewModel(email);
  vm.metadata.qualitySettings = settings;
  const { ctx } = runQualityChecks(vm, { rules: [] });
  ctx.remote = remote;
  return ctx;
}

const UNREPLACED = /__\w+__/;

const CASES = _.flatMap(['default', 'min', 'max'], (bound) =>
  Object.keys(EMAILS).map((email) => [email, bound])
);

describe.each(CASES)(
  'every check on the %s email, thresholds at %s',
  (email, bound) => {
    let ctx;
    beforeAll(() => {
      ctx = contextOf(EMAILS[email], settingsAt(bound));
    });

    it.each(RULES.map((rule) => [rule.id, rule]))(
      '%s runs and says something readable',
      (id, rule) => {
        // As the engine does: a check that cannot apply here is not run.
        if (rule.enabled && !rule.enabled(ctx)) return;
        const findings = rule.run(ctx) || [];
        const passParams = rule.passParams ? rule.passParams(ctx) : {};
        // As the engine does: the pass a rule picks for this email.
        const passKey = (rule.passKeyOf && rule.passKeyOf(ctx)) || rule.passKey;
        const messages = findings
          .map((finding) => [finding.messageKey, finding.params])
          .concat([[passKey, passParams]]);
        Object.keys(STRINGS).forEach((lang) => {
          messages.forEach(([key, params]) => {
            expect(STRINGS[lang]).toHaveProperty([key]);
            const text = readable(lang, key, params);
            expect(text).not.toMatch(UNREPLACED);
            expect(text).not.toContain('[object Object]');
            expect(text).not.toContain('undefined');
          });
        });
        messages.forEach(([key, params]) => {
          const text = messageText(naiveT, key, params, { locale: 'en' });
          expect(text).not.toMatch(UNREPLACED);
          expect(text).not.toContain('[object Object]');
        });
      }
    );
  }
);

// The emails have to keep finding faults, or the test above proves little:
// every check reports something on one of them.
it('finds a fault for every check on one email or another', () => {
  const silent = RULES.filter((rule) =>
    Object.values(EMAILS).every((email) => {
      const ctx = contextOf(email, settingsAt('default'));
      return (rule.enabled && !rule.enabled(ctx)) || !rule.run(ctx).length;
    })
  ).map((rule) => rule.id);
  expect(silent).toEqual([]);
});
