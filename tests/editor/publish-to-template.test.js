'use strict';

// Writing the published values where a template reads them: the root of the
// email's content, one observable per property the template declares.

const ko = require('knockout');
const {
  publishToTemplate,
} = require('../../packages/editor/src/js/utils/publish-to-template.js');

// A Knockout observable as the content model holds one. Counts its writes,
// the same value included, so a test sees an untouched property.
function observable(initial) {
  const target = ko.observable(initial).extend({ notify: 'always' });
  target.writes = 0;
  target.subscribe(() => {
    target.writes += 1;
  });
  return target;
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

  // A root function that is not an observable (a template-level helper such
  // as `_nextVariant`) or a computed that cannot be written: never called.
  it.each([
    ['a plain function', () => jest.fn(() => 'be')],
    ['a read-only computed', () => ko.pureComputed(() => 'be')],
  ])('neither calls nor writes %s', (_label, make) => {
    const target = make();
    const content = { audience: target };

    const { applied, skipped } = publishToTemplate(content, {
      audience: 'vip',
    });

    if (jest.isMockFunction(target)) expect(target).not.toHaveBeenCalled();
    expect(target()).toBe('be');
    expect(applied).toEqual([]);
    expect(skipped).toEqual(['audience']);
  });

  it('writes into a writable computed', () => {
    const backing = ko.observable('be');
    const content = {
      audience: ko.computed({ read: backing, write: backing }),
    };

    publishToTemplate(content, { audience: 'vip' });

    expect(backing()).toBe('vip');
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
