'use strict';

// Acceptance tests of the template options a dimension feeds (epic #1514,
// ADR-0024). When a dimension in the email's scope feeds a root property of the
// template, the template's own option for that property is hidden: the
// dimension decides, and two selects for one property can only disagree.
//
// `dimensions` is what the server sends the editor: the dimensions in the email's
// scope only. `templateProperties` are the root properties the template declares.

const SILO = { name: 'silo', values: [] };
const SILO_BRAND = { name: 'siloBrand', parentName: 'silo', values: [] };
const AUDIENCE = { name: 'audience', values: [] };

const TEMPLATE_PROPERTIES = [
  'headerVisible',
  'footerVisible',
  'preheaderText',
  'silo',
  'siloBrand',
];

// Turned on by #1522 (a template option fed by a dimension is hidden)
describe.skip('template options fed by a dimension', () => {
  let hiddenTemplateOptions;

  beforeAll(() => {
    // Required here: the module doesn't exist until #1522.
    ({
      hiddenTemplateOptions,
    } = require('../../packages/editor/src/js/utils/template-options.js'));
  });

  it('hides the template options of the properties the dimensions feed', () => {
    expect(
      hiddenTemplateOptions({
        dimensions: [SILO, SILO_BRAND, AUDIENCE],
        templateProperties: TEMPLATE_PROPERTIES,
      }).sort()
    ).toEqual(['silo', 'siloBrand']);
  });

  it('keeps every option of a template no dimension feeds', () => {
    expect(
      hiddenTemplateOptions({
        dimensions: [AUDIENCE],
        templateProperties: TEMPLATE_PROPERTIES,
      })
    ).toEqual([]);
  });

  it('hides nothing for a dimension out of the email scope, the server not sending it', () => {
    expect(
      hiddenTemplateOptions({
        dimensions: [],
        templateProperties: TEMPLATE_PROPERTIES,
      })
    ).toEqual([]);
  });

  it('keeps the option of a deactivated dimension, which no longer decides', () => {
    expect(
      hiddenTemplateOptions({
        dimensions: [{ ...SILO, isActive: false }, SILO_BRAND],
        templateProperties: TEMPLATE_PROPERTIES,
      })
    ).toEqual(['siloBrand']);
  });
});
