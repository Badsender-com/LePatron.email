'use strict';

// The super admin's template list links each template to its group. A
// template whose group no longer exists comes with a null group (#1338): the
// row and the group column's sort must not read through it.
//
// The project has no @vue/test-utils, so this reads the component source.

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '../../../packages/ui/components/templates/table.vue'),
  'utf8'
);
const template = /<template>([\s\S]*)<\/template>/.exec(source)[1];

describe('templates table', () => {
  it('links to the group only when the template has one', () => {
    expect(template).toMatch(
      /<nuxt-link\s+v-if="item\.group"\s+:to="`\/groups\/\$\{item\.group\.id\}`"/
    );
  });

  it('sorts the group column without reading a null group', () => {
    const sort = /sort: (\(a, b\) =>[\s\S]*?\)),\n/.exec(source);
    // eslint-disable-next-line no-new-func
    const compare = new Function(`return ${sort[1]}`)();

    expect(() => compare(null, { name: 'Acme' })).not.toThrow();
    expect(compare({ name: 'Acme' }, { name: 'Zeta' })).toBeGreaterThan(0);
  });
});
