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

    const { applied } = publishToTemplate(content, { audience: 'vip' });

    expect(content.audience()).toBe('vip');
    expect(applied).toEqual(['audience']);
  });

  it.each([
    ['a number', 600],
    ['a boolean', true],
    ['nothing yet', null],
    ['nothing at all', undefined],
  ])('writes into a property holding %s', (_label, initial) => {
    const content = { audience: observable(initial) };

    const { applied } = publishToTemplate(content, { audience: 'vip' });

    expect(content.audience()).toBe('vip');
    expect(applied).toEqual(['audience']);
  });

  it('writes no value as an empty string', () => {
    const content = { audience: observable('vip') };

    const { applied } = publishToTemplate(content, { audience: null });

    expect(content.audience()).toBe('');
    expect(applied).toEqual(['audience']);
  });

  // The editor's own structure sits at the same root as the template options:
  // the theme's styles (an object), the list of blocks (an observable array).
  // A text written there would destroy the email.
  it.each([
    ['an object', () => observable({ bodyTheme: observable('#fff') })],
    ['an array', () => observable([{ type: 'titleBlock' }])],
  ])('never writes into a property holding %s', (_label, make) => {
    const target = make();
    const before = target();
    const content = { theme: target };

    const { applied, skipped } = publishToTemplate(content, { theme: 'noel' });

    expect(target()).toBe(before);
    expect(target.writes).toBe(0);
    expect(applied).toEqual([]);
    expect(skipped).toEqual(['theme']);
  });

  it('leaves a template that does not declare the property untouched', () => {
    const content = { title: observable('Bonjour') };

    const { applied, skipped } = publishToTemplate(content, {
      audience: 'vip',
    });

    expect(content).not.toHaveProperty('audience');
    expect(applied).toEqual([]);
    expect(skipped).toEqual(['audience']);
  });

  it('writes nothing when the property already holds the value', () => {
    const content = { audience: observable('vip') };

    const { applied } = publishToTemplate(content, { audience: 'vip' });

    expect(content.audience.writes).toBe(0);
    expect(applied).toEqual([]);
  });

  it('does nothing while the content is not there yet', () => {
    expect(publishToTemplate(null, { audience: 'vip' })).toEqual({
      applied: [],
      skipped: [],
    });
  });
});
