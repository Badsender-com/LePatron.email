/**
 * @jest-environment jsdom
 */

'use strict';

const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const { fakeViewModel, exportOf } = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const forbiddenCode = require(`${RULES}/forbidden-code`);
const malformedHtml = require(`${RULES}/malformed-html`);
const unsupportedCode = require(`${RULES}/unsupported-code`);
const looseCode = require(`${RULES}/loose-code`);

const { nestingProblem } = malformedHtml;

// An HTML code block holding `htmlCode`, as the editor keeps it.
function codeFindings(rule, htmlCode) {
  const blocks = [{ id: 'b1', type: 'htmlCodeBlock', htmlCode }];
  const html = exportOf({ b1: htmlCode });
  return runQualityChecks(fakeViewModel({ blocks, html }), { rules: [rule] })
    .findings;
}

describe('forbidden-code', () => {
  it.each([
    ['<script>alert(1)</script><p>Hi</p>', '<script>'],
    ['<iframe src="https://brand.com"></iframe>', '<iframe>'],
    ['<form action="/x"><input></form>', '<form>'],
    ['<link rel="stylesheet" href="a.css">', '<link rel="stylesheet">'],
    ['<img src="a.jpg" onerror="x()">', 'onerror'],
    ['<a href="javascript:go()">Go</a>', 'javascript:'],
  ])('reports %s', (htmlCode, code) => {
    const [finding] = codeFindings(forbiddenCode, htmlCode);
    expect(finding.severity).toBe('error');
    expect(finding.params.code).toContain(code);
  });

  it('also reads the rich texts the client edited', () => {
    const def = { type: 'textBlock', longText: '<p>Sample</p>' };
    const blocks = [
      {
        id: 'b1',
        type: 'textBlock',
        longText: '<p>Mine<iframe src="x"></iframe></p>',
      },
    ];
    const html = exportOf({ b1: '<p>Mine</p>' });
    const findings = runQualityChecks(
      fakeViewModel({ blocks, blockDefs: [def], html }),
      {
        rules: [forbiddenCode],
      }
    ).findings;
    expect(findings).toHaveLength(1);
  });

  it('leaves email-safe code alone', () => {
    expect(
      codeFindings(
        forbiddenCode,
        '<table role="presentation"><tr><td>Hi</td></tr></table>'
      )
    ).toEqual([]);
  });
});

describe('malformed-html', () => {
  it.each([
    ['<div><p>Hello</div>', null],
    ['<table><tr><td>A</td></tr></table>', null],
    ['<ul><li>One<li>Two</ul>', null],
    ['<p>Hello<br>world</p><img src="a.jpg">', null],
    ['<!--[if mso]><table><tr><td><![endif]--><div>Hi</div>', null],
    ['<% if (x) { %><div>Hi</div><% } %>', null],
    ['<div><span>Hello</div>', { kind: 'unclosed', tag: 'span' }],
    ['<div>Hello', { kind: 'unclosed', tag: 'div' }],
    ['<p>Hello</p></span>', { kind: 'unexpected', tag: 'span' }],
  ])('judges %s', (html, problem) => {
    expect(nestingProblem(html)).toEqual(problem);
  });

  it('reports the block of the problem', () => {
    const [finding] = codeFindings(malformedHtml, '<div><b>Bold</div>');
    expect(finding).toMatchObject({ blockId: 'b1', params: { tag: 'b' } });
  });
});

describe('unsupported-code', () => {
  it('lists what some clients ignore', () => {
    const [finding] = codeFindings(
      unsupportedCode,
      '<style>@import url(x.css); .a { display: flex }</style><div style="position:absolute;color:var(--brand)"><svg></svg></div>'
    );
    expect(finding.params.features.split(', ')).toEqual([
      'flexbox',
      'position: absolute/fixed/sticky',
      'CSS variables',
      '@import',
      '<svg>',
    ]);
  });

  it('leaves table-based code alone', () => {
    expect(
      codeFindings(
        unsupportedCode,
        '<table><tr><td style="display:block;position:relative">Hi</td></tr></table>'
      )
    ).toEqual([]);
  });
});

describe('loose-code', () => {
  it('reports relative addresses and unreadable colours', () => {
    const findings = codeFindings(
      looseCode,
      '<a href="/offer">Go</a><img src="img/a.png"><table><tr><td bgcolor="#ff00f" style="color:#11223344">x</td></tr></table>'
    );
    expect(findings.map((f) => f.params)).toEqual([
      { urls: '/offer, img/a.png' },
      { colors: '#11223344, #ff00f' },
    ]);
  });

  it('leaves full addresses, merge tags, anchors and id selectors alone', () => {
    expect(
      codeFindings(
        looseCode,
        '<style>#fade-in { color: #fff }</style><a href="https://brand.com">a</a><a href="{{url}}">b</a><a href="#top">c</a><table><tr><td bgcolor="#093040">x</td></tr></table>'
      )
    ).toEqual([]);
  });
});
