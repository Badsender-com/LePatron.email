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
  exposeHiddenTemplateOptions,
  hideTemplateOptionsFedBy,
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

// The email type and trigger selects of the email settings feed the
// `emailType` and `trigger` properties: the same rule.
describe('template options fed by the email type and the trigger', () => {
  const PROPERTIES = ['emailType', 'trigger', 'country'];

  it('hides the options the email type and trigger selects feed', () => {
    expect(
      hiddenTemplateOptions({
        dimensions: [],
        emailTypes: [{ id: '64a0000000000000000000c1' }],
        triggers: ['adhoc', 'automated'],
        templateProperties: PROPERTIES,
      })
    ).toEqual(['emailType', 'trigger']);
  });

  it('keeps the email type option while the company offers no email type', () => {
    expect(
      hiddenTemplateOptions({
        dimensions: [],
        emailTypes: [],
        triggers: ['adhoc', 'automated'],
        templateProperties: PROPERTIES,
      })
    ).toEqual(['trigger']);
  });

  it('keeps both while the editor was sent neither', () => {
    expect(
      hiddenTemplateOptions({ dimensions: [], templateProperties: PROPERTIES })
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

// What the template's option editors read on the viewModel
// (converter/editor.js): `$root.isHiddenTemplateOption('country')`.
describe('the hidden template options on the viewModel', () => {
  function makeViewModel() {
    const vm = {
      content: ko.observable({
        country: ko.observable('be'),
        trigger: ko.observable(''),
        headerVisible: ko.observable(true),
      }),
    };
    exposeHiddenTemplateOptions(vm);
    return vm;
  }

  it('hide nothing until the email settings say what they feed', () => {
    const vm = makeViewModel();

    expect(vm.isHiddenTemplateOption('country')).toBe(false);
  });

  it('hide what the email settings feed, read from the content', () => {
    const vm = makeViewModel();

    hideTemplateOptionsFedBy(vm, {
      dimensions: [COUNTRY, AUDIENCE],
      emailTypes: [],
      triggers: ['adhoc', 'automated'],
    });

    expect(vm.isHiddenTemplateOption('country')).toBe(true);
    expect(vm.isHiddenTemplateOption('trigger')).toBe(true);
    expect(vm.isHiddenTemplateOption('headerVisible')).toBe(false);
    expect(vm.isHiddenTemplateOption('audience')).toBe(false);
  });
});

// A design token feeds the property of its name while a chosen value carries
// it (ADR-0015): its option is hidden then, and given back once no chosen
// value carries it, the writer then setting the property themselves.
describe('template options fed by a design token', () => {
  const PROPERTIES = ['mainColorVar', 'textColorVar', 'country'];

  it('hides the option of a token a chosen value carries', () => {
    expect(
      hiddenTemplateOptions({
        dimensions: [],
        tokens: ['mainColorVar'],
        templateProperties: PROPERTIES,
      })
    ).toEqual(['mainColorVar']);
  });

  it('keeps the options of the tokens no chosen value carries', () => {
    expect(
      hiddenTemplateOptions({
        dimensions: [COUNTRY],
        tokens: [],
        templateProperties: PROPERTIES,
      })
    ).toEqual(['country']);
  });

  it('ignores a token the template has no option for', () => {
    expect(
      hiddenTemplateOptions({
        dimensions: [],
        tokens: ['accentColorVar'],
        templateProperties: PROPERTIES,
      })
    ).toEqual([]);
  });
});

// The editor publishes and hides from one result of governanceValues: the
// option and the content never disagree on who decides a token's property.
describe('a design token, its option and the content', () => {
  const {
    governanceValues,
  } = require('../../packages/editor/src/js/utils/governance-values.js');
  const {
    createTemplatePublisher,
  } = require('../../packages/editor/src/js/utils/publish-to-template.js');

  const BRAND = {
    name: 'brand',
    precedence: 0,
    values: [
      {
        id: '64a0000000000000000000b1',
        canonicalType: 'brand_a',
        tokens: { mainColorVar: '#ffd845' },
      },
      // No `mainColorVar`: the writer sets the colour.
      { id: '64a0000000000000000000b2', canonicalType: 'brand_b', tokens: {} },
    ],
  };
  const config = { dimensions: [BRAND], emailTypes: [], triggers: [] };

  function openEmail(mainColor) {
    const vm = {
      content: ko.observable({
        brand: ko.observable(''),
        mainColorVar: ko.observable(mainColor),
      }),
    };
    exposeHiddenTemplateOptions(vm);
    const publisher = createTemplatePublisher();
    const choose = (brandId) => {
      const { values, sources } = governanceValues({
        dimensions: config.dimensions,
        selections: { brand: brandId },
      });
      publisher.publish(vm.content(), values);
      hideTemplateOptionsFedBy(vm, config, Object.keys(sources));
    };
    return { vm, choose, mainColorVar: vm.content().mainColorVar };
  }

  it('hides the option and writes the token while the brand carries it', () => {
    const { vm, choose, mainColorVar } = openEmail('#cc0000');

    choose('64a0000000000000000000b1');

    expect(mainColorVar()).toBe('#ffd845');
    expect(vm.isHiddenTemplateOption('mainColorVar')).toBe(true);
  });

  it("gives the option and the writer's value back on a brand without the token", () => {
    const { vm, choose, mainColorVar } = openEmail('#cc0000');

    choose('64a0000000000000000000b1');
    choose('64a0000000000000000000b2');

    expect(vm.isHiddenTemplateOption('mainColorVar')).toBe(false);
    expect(mainColorVar()).toBe('#cc0000');
  });

  it('lets the value the writer sets on that brand stand, and come back after', () => {
    const { vm, choose, mainColorVar } = openEmail('#cc0000');

    choose('64a0000000000000000000b2');
    mainColorVar('#00aa00');
    choose('64a0000000000000000000b2');

    expect(mainColorVar()).toBe('#00aa00');

    choose('64a0000000000000000000b1');
    expect(mainColorVar()).toBe('#ffd845');
    expect(vm.isHiddenTemplateOption('mainColorVar')).toBe(true);

    choose('64a0000000000000000000b2');
    expect(mainColorVar()).toBe('#00aa00');
    expect(vm.isHiddenTemplateOption('mainColorVar')).toBe(false);
  });

  it('keeps the dimension option hidden whatever the tokens', () => {
    const { vm, choose } = openEmail('#cc0000');

    choose('64a0000000000000000000b2');

    expect(vm.isHiddenTemplateOption('brand')).toBe(true);
  });

  it('writes the hidden list only when it changes', () => {
    const { vm, choose } = openEmail('#cc0000');
    choose('64a0000000000000000000b1');
    const writes = jest.fn();
    vm.hiddenTemplateOptions.subscribe(writes);

    choose('64a0000000000000000000b1');

    expect(writes).not.toHaveBeenCalled();
  });
});
