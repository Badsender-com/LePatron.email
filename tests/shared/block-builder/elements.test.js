'use strict';

// These templates are the part of the generator a human writes by hand, so they
// are the part where a forgotten slot type or a stray quote would land. The
// sweep at the top runs every element through the same hostile values; the
// per-element blocks cover what is specific to each.

const {
  ELEMENTS,
  elementFor,
} = require('../../../packages/shared/block-builder/elements/index.js');

const HOSTILE = '"><script>alert(1)</script>';

describe('every element', () => {
  test.each(ELEMENTS.map((element) => [element.type, element]))(
    '%s renders with its defaults',
    (_type, element) => {
      const html = element.render(element.defaults);
      expect(html).toContain('<table role="presentation"');
      expect(html).not.toContain('[[');
    }
  );

  test.each(ELEMENTS.map((element) => [element.type, element]))(
    '%s renders with no values at all',
    (_type, element) => {
      expect(() => element.render()).not.toThrow();
      expect(element.render()).not.toContain('[[');
    }
  );

  // The sweep that matters: whatever the slot, a hostile value must not become
  // markup.
  test.each(ELEMENTS.map((element) => [element.type, element]))(
    '%s neutralises hostile values in every slot',
    (_type, element) => {
      const values = {};
      element.render.slots.forEach((slot) => {
        values[slot.name] = HOSTILE;
      });

      const html = element.render(values);

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('javascript:');
      // No slot may end its attribute and start a new one.
      expect(html).not.toMatch(/"\s*on[a-z]+\s*=/i);
    }
  );

  it('exposes each type once', () => {
    const types = ELEMENTS.map((element) => element.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('is looked up by type, and unknown types are null', () => {
    expect(elementFor('button').type).toBe('button');
    expect(elementFor('nope')).toBeNull();
    expect(elementFor('constructor')).toBeNull();
  });
});

describe('text', () => {
  const text = elementFor('text');

  it('places the content in the cell', () => {
    expect(text.render({ ...text.defaults, content: 'Bonjour' })).toContain(
      '>Bonjour<'
    );
  });

  // The content slot is RICH_TEXT: an allow-list rebuild, not an escape.
  it('keeps the formatting a writer expects', () => {
    const html = text.render({
      ...text.defaults,
      content: '<strong>gras</strong> et <a href="https://e.com">un lien</a>',
    });
    expect(html).toContain('<strong>gras</strong>');
    expect(html).toContain('<a href="https://e.com">un lien</a>');
  });

  it('drops everything else, keeping the words', () => {
    const html = text.render({
      ...text.defaults,
      content: '<span style="color:red">a</span><script>alert(1)</script>b',
    });
    expect(html).toContain('>ab<');
    expect(html).not.toContain('<span');
    expect(html).not.toContain('<script');
  });

  it('keeps ESP personalisation readable', () => {
    const html = text.render({
      ...text.defaults,
      content: 'Bonjour {{firstname}}',
    });
    expect(html).toContain('{{firstname}}');
  });
});

describe('image', () => {
  const image = elementFor('image');

  it('ships no anchor when there is no link', () => {
    const html = image.render({
      ...image.defaults,
      src: 'https://e.com/a.png',
    });
    expect(html).not.toContain('<a ');
  });

  it('wraps the image when there is one', () => {
    const html = image.render({
      ...image.defaults,
      src: 'https://e.com/a.png',
      href: 'https://e.com',
    });
    expect(html).toContain('<a href="https://e.com"');
    expect(html).toContain('</a>');
  });

  it('treats a blank link as no link', () => {
    const html = image.render({ ...image.defaults, href: '   ' });
    expect(html).not.toContain('<a ');
  });

  // display:block kills the baseline gap; the attribute is for Outlook, the
  // style for everyone else.
  it('carries the width twice and blocks the image', () => {
    const html = image.render({ ...image.defaults, width: 300 });
    expect(html).toContain('width="300"');
    expect(html).toContain('max-width:300px');
    expect(html).toContain('display:block');
  });

  it('refuses a javascript: source', () => {
    const html = image.render({
      ...image.defaults,
      src: 'javascript:alert(1)',
    });
    expect(html).toContain('src=""');
  });
});

describe('button', () => {
  const button = elementFor('button');

  // Deliberate: a v:roundrect needs its width in pixels, which locks the label.
  // The design rules prefer square corners on Outlook over a locked label for
  // anything industrialised — which a builder is.
  it('ships no VML, so the label is never locked', () => {
    const html = button.render(button.defaults);
    expect(html).not.toContain('v:roundrect');
    expect(html).not.toContain('<!--[if mso]');
  });

  it('paints the background on the cell and on the anchor', () => {
    const html = button.render({
      ...button.defaults,
      backgroundColor: '#ff0000',
    });
    expect(html).toContain('bgcolor="#ff0000"');
    expect(html).toContain('background-color:#ff0000');
  });

  it('falls back to a safe href', () => {
    const html = button.render({
      ...button.defaults,
      href: 'javascript:alert(1)',
    });
    expect(html).toContain('href="#"');
  });

  // 14px top + 14px bottom + 20px line height clears the 44px tap target.
  it('defaults to a tap target the design rules accept', () => {
    const { verticalPadding, lineHeight } = button.defaults;
    expect(verticalPadding * 2 + lineHeight).toBeGreaterThanOrEqual(44);
  });
});

describe('divider and spacer', () => {
  it('draws the rule with a border rather than an <hr>', () => {
    const divider = elementFor('divider');
    const html = divider.render({ ...divider.defaults, thickness: 2 });
    expect(html).not.toContain('<hr');
    expect(html).toContain('border-top:2px solid');
  });

  // Without font-size:0 Outlook gives the nbsp a line box and the gap grows.
  it('collapses the spacer line box', () => {
    const spacer = elementFor('spacer');
    const html = spacer.render({ height: 40 });
    expect(html).toContain('height="40"');
    expect(html).toContain('font-size:0');
    expect(html).toContain('&nbsp;');
  });
});
