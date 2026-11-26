'use strict';

// The template options a company dimension feeds (ADR-0015). When a dimension
// sent to the editor feeds a root property of the template, the template's own
// option for that property is hidden: the dimension decides, and two selects
// for one property can only disagree.
//
// `dimensions` is what the server sends the editor: the company's active
// dimensions. `templateProperties` are the root properties the template
// declares.

const ko = require('knockout');
const {
  hiddenTemplateOptions,
  rootPropertiesOf,
} = require('../../packages/editor/src/js/utils/template-options.js');

const COUNTRY = {
  name: 'country',
  values: [{ id: '64a0000000000000000000d1', canonicalType: 'be' }],
};
const AUDIENCE = {
  name: 'audience',
  values: [{ id: '64a0000000000000000000a1', canonicalType: 'vip' }],
};

const TEMPLATE_PROPERTIES = [
  'headerVisible',
  'footerVisible',
  'preheaderText',
  'country',
];

describe('template options fed by a dimension', () => {
  it('hides the template option of the property a dimension feeds', () => {
    expect(
      hiddenTemplateOptions({
        dimensions: [COUNTRY, AUDIENCE],
        templateProperties: TEMPLATE_PROPERTIES,
      })
    ).toEqual(['country']);
  });

  it('gives the option back once the dimension is deactivated and no longer sent', () => {
    expect(
      hiddenTemplateOptions({
        dimensions: [AUDIENCE],
        templateProperties: TEMPLATE_PROPERTIES,
      })
    ).toEqual([]);
  });

  it('gives the option back to a dimension sent deactivated', () => {
    expect(
      hiddenTemplateOptions({
        dimensions: [{ ...COUNTRY, isActive: false }],
        templateProperties: TEMPLATE_PROPERTIES,
      })
    ).toEqual([]);
  });

  // Hidden, the option would leave the writer nothing to set the property
  // with.
  it('keeps the option of a dimension declared before its values', () => {
    expect(
      hiddenTemplateOptions({
        dimensions: [{ ...COUNTRY, values: [] }],
        templateProperties: TEMPLATE_PROPERTIES,
      })
    ).toEqual([]);
  });

  it('keeps the option of a dimension whose values are all deactivated', () => {
    expect(
      hiddenTemplateOptions({
        dimensions: [
          {
            ...COUNTRY,
            // Sent because the email carries it, not offered.
            values: [{ ...COUNTRY.values[0], isActive: false }],
          },
        ],
        templateProperties: TEMPLATE_PROPERTIES,
      })
    ).toEqual([]);
  });
});

describe('the root properties of an email content', () => {
  const observable = (value) => ko.observable(value);

  it('are the writable observables at its root holding a plain value', () => {
    expect(
      rootPropertiesOf({
        country: observable('be'),
        bodyWidth: observable(600),
        headerVisible: observable(true),
        preheaderText: observable(null),
        notAnObservable: 'template',
        _nextVariant: () => 'next',
        readOnly: ko.pureComputed(() => 'be'),
      })
    ).toEqual(['country', 'bodyWidth', 'headerVisible', 'preheaderText']);
  });

  // The editor's own structure, which no dimension feeds.
  it('leave out those holding an object or a list', () => {
    expect(
      rootPropertiesOf({
        country: observable('be'),
        theme: observable({ bodyTheme: observable('#fff') }),
        mainBlocks: observable([]),
      })
    ).toEqual(['country']);
  });

  it('are none before the content is loaded', () => {
    expect(rootPropertiesOf(null)).toEqual([]);
  });
});
