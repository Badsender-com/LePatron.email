'use strict';

// Two things are being pinned here.
//
// A template bug must fail at build time, loudly: an unknown context or a
// nameless slot is a developer mistake, and the cost of discovering it at
// render time — in a canvas, on a Friday — is exactly what this engine exists
// to avoid.
//
// And ESP personalisation tags must survive a render untouched. Templates
// legitimately contain `{{unsubscribe}}` and `%%name%%`; a placeholder syntax
// that ate them would break every email that uses one.

const {
  compileTemplate,
  renderTemplate,
  defineTemplate,
} = require('../../../packages/shared/block-builder/template.js');

describe('compileTemplate', () => {
  it('splits markup into chunks and slots', () => {
    const { chunks, slots } = compileTemplate('<p>[[label|TEXT]]</p>');

    expect(chunks).toEqual(['<p>', '</p>']);
    expect(slots).toEqual([{ name: 'label', context: 'TEXT', fallback: '' }]);
  });

  // Every render walks the two arrays in step; this is the invariant it needs.
  it('always yields one more chunk than slots', () => {
    ['no slot at all', '[[a|TEXT]]', '[[a|TEXT]]x[[b|TEXT]]'].forEach(
      (source) => {
        const { chunks, slots } = compileTemplate(source);
        expect(chunks).toHaveLength(slots.length + 1);
      }
    );
  });

  it('reads the fallback', () => {
    const { slots } = compileTemplate('[[color|COLOR|#000000]]');
    expect(slots[0].fallback).toBe('#000000');
  });

  it('can be called twice on the same source', () => {
    expect(compileTemplate('[[a|TEXT]]')).toEqual(
      compileTemplate('[[a|TEXT]]')
    );
  });

  describe('refuses a template bug rather than rendering one', () => {
    it('on an unknown context', () => {
      expect(() => compileTemplate('[[a|NONSENSE]]')).toThrow(
        /unknown context "NONSENSE"/
      );
    });

    it('on a missing context', () => {
      expect(() => compileTemplate('[[a]]')).toThrow(/unknown context/);
    });

    it('on a nameless slot', () => {
      expect(() => compileTemplate('[[|TEXT]]')).toThrow(/no name/);
    });

    it('on something that is not a string', () => {
      expect(() => compileTemplate(null)).toThrow(/must be a string/);
    });
  });
});

describe('renderTemplate', () => {
  const template = compileTemplate(
    '<td style="color:[[color|COLOR|#000000]]">[[label|TEXT]]</td>'
  );

  it('fills the slots', () => {
    expect(
      renderTemplate(template, { color: '#ff0000', label: 'Bonjour' })
    ).toBe('<td style="color:#ff0000">Bonjour</td>');
  });

  it('escapes each value for its own context', () => {
    const out = renderTemplate(template, {
      color: 'red;background:url(evil)',
      label: '<script>alert(1)</script>',
    });

    expect(out).toContain('color:#000000');
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('<script>');
  });

  it('uses the fallback for a missing value', () => {
    expect(renderTemplate(template, {})).toBe(
      '<td style="color:#000000"></td>'
    );
  });

  it('renders without any values at all', () => {
    expect(() => renderTemplate(template)).not.toThrow();
  });

  it('refuses something that is not a compiled template', () => {
    expect(() => renderTemplate('<p></p>', {})).toThrow(/compiled template/);
  });

  // The reason the placeholder syntax is `[[ ]]` and not `{{ }}` or `%% %%`.
  describe('ESP personalisation tags', () => {
    const espTemplate = compileTemplate(
      '<a href="[[url|URL|#]]">{{firstname}} %%lastname%% <%= id %></a>'
    );

    it('leaves the tags of the markup alone', () => {
      const out = renderTemplate(espTemplate, { url: 'https://e.com' });
      expect(out).toContain('{{firstname}}');
      expect(out).toContain('%%lastname%%');
      expect(out).toContain('<%= id %>');
    });

    it('lets a tag be the value of a URL slot', () => {
      const out = renderTemplate(espTemplate, { url: '{{unsubscribe}}' });
      expect(out).toContain('href="{{unsubscribe}}"');
    });
  });
});

describe('defineTemplate', () => {
  it('compiles once and renders many times', () => {
    const render = defineTemplate('<p>[[label|TEXT]]</p>');

    expect(render({ label: 'a' })).toBe('<p>a</p>');
    expect(render({ label: 'b' })).toBe('<p>b</p>');
  });

  it('exposes the slots it expects, for the gallery', () => {
    const render = defineTemplate('[[a|TEXT]][[b|PX|0]]');
    expect(render.slots.map((slot) => slot.name)).toEqual(['a', 'b']);
  });

  it('throws at definition time on a template bug', () => {
    expect(() => defineTemplate('[[a|NOPE]]')).toThrow();
  });
});
