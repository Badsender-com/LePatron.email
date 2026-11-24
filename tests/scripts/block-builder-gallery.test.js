'use strict';

// The gallery is what gets sent to Litmus, so a broken one wastes a review
// round rather than breaking a build. These tests keep it a valid, complete
// document that actually exercises every element.

const {
  renderGallery,
  specimens,
} = require('../../scripts/block-builder-gallery.js');
const {
  ELEMENTS,
} = require('../../packages/shared/block-builder/elements/index.js');
const {
  elementsOfState,
} = require('../../packages/shared/block-builder/composition.js');

describe('specimens', () => {
  it('exercises every element at least once', () => {
    const rendered = new Set();
    specimens().forEach((spec) =>
      elementsOfState(spec.state).forEach((element) =>
        rendered.add(element.type)
      )
    );

    ELEMENTS.forEach((element) => {
      expect(rendered.has(element.type)).toBe(true);
    });
  });

  it('gives every element a unique id', () => {
    const ids = specimens().flatMap((spec) =>
      elementsOfState(spec.state).map((element) => element.id)
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  // What #1207 asks the client tests to cover: the three presets, each with an
  // image and some text.
  test.each([[[50, 50]], [[33, 33, 34]], [[66, 34]]])(
    'lays out a row of %j with an image and a text',
    (widths) => {
      const spec = specimens().find(
        (candidate) =>
          Array.isArray(candidate.state.rows) &&
          JSON.stringify(
            candidate.state.rows[0].columns.map((column) => column.width)
          ) === JSON.stringify(widths)
      );
      const types = elementsOfState(spec.state).map((element) => element.type);

      expect(types).toContain('image');
      expect(types).toContain('text');
    }
  );

  // Called twice by a watcher, or by a test and then a build.
  it('is stable across calls', () => {
    expect(JSON.stringify(specimens())).toBe(JSON.stringify(specimens()));
  });
});

describe('renderGallery', () => {
  const html = renderGallery();

  it('is a complete document', () => {
    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('</html>');
    expect(html).toContain('charset=utf-8');
  });

  it('renders every specimen with its title', () => {
    specimens().forEach((spec) => {
      expect(html).toContain(spec.title);
    });
  });

  it('stacks the columns on a phone', () => {
    expect(html).toMatch(/@media[^{]*max-width:600px\)\{\.lp-stack\{/);
    expect(html).toContain('class="lp-stack"');
  });

  it('leaves no placeholder behind', () => {
    expect(html).not.toContain('[[');
  });

  it('carries the generator version, so a report can be traced back', () => {
    expect(html).toMatch(/Générateur \d+\.\d+\.\d+/);
  });

  // It is opened in mail clients: a stray script would be both a bug and a
  // spam signal.
  it('ships no script and no event handler', () => {
    expect(html).not.toContain('<script');
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it('stays small enough for Gmail not to clip it', () => {
    // Gmail clips around 102KB.
    expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(102 * 1024);
  });
});
