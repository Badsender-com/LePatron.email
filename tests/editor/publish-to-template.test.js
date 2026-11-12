'use strict';

// Writing the published values where a template reads them: the root of the
// email's content, one observable per property the template declares.

const {
  publishToTemplate,
} = require('../../packages/editor/src/js/utils/publish-to-template.js');

// A Knockout observable as the content model holds one: read with no argument,
// written with one. Counts its writes, so a test sees an untouched property.
function observable(initial) {
  let value = initial;
  const read = (...args) => {
    if (args.length === 0) return value;
    value = args[0];
    read.writes += 1;
    return undefined;
  };
  read.writes = 0;
  return read;
}

describe('publishing values to the template', () => {
  it('writes each value to the property of the same name', () => {
    const content = { audience: observable('prospects') };

    publishToTemplate(content, { audience: 'vip' });

    expect(content.audience()).toBe('vip');
  });

  it('leaves a template that does not declare the property untouched', () => {
    const content = { title: observable('Bonjour') };

    const { skipped } = publishToTemplate(content, { audience: 'vip' });

    expect(content).not.toHaveProperty('audience');
    expect(skipped).toEqual(['audience']);
  });

  it('writes nothing when the property already holds the value', () => {
    const content = { audience: observable('vip') };

    publishToTemplate(content, { audience: 'vip' });

    // A write would add a step to the undo history for nothing.
    expect(content.audience.writes).toBe(0);
  });

  it('does nothing while the content is not there yet', () => {
    expect(publishToTemplate(null, { audience: 'vip' })).toEqual({
      applied: [],
      skipped: [],
    });
  });
});
