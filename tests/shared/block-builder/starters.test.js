'use strict';

// The `starters` option: what a blank element shows in the preview.
//
// It exists because an element that renders nothing appears nowhere — "I added
// a text and saw nothing" — and it is an option rather than a default because
// the words must never reach a recipient. What is pinned: they appear only
// when asked for, only in a blank slot, through the slot's own escaping, and
// the markup without the option is byte for byte what it was.

const {
  generate,
  emptyState,
  STARTER_ATTRIBUTE,
} = require('../../../packages/shared/block-builder/generate.js');

const STARTERS = {
  text: { key: 'content', text: 'Saisissez votre texte…' },
  button: { key: 'label', text: 'Votre bouton' },
};

const stateWith = (...elements) => ({ ...emptyState(), elements });
const text = (content) => ({ id: 't1', type: 'text', content });
const button = (label) => ({ id: 'b1', type: 'button', label });

describe('starters', () => {
  it('shows the starter in a blank element and marks its row', () => {
    const html = generate(stateWith(text('')), { starters: STARTERS });

    expect(html).toContain('Saisissez votre texte…');
    expect(html).toContain(`${STARTER_ATTRIBUTE}="text"`);
  });

  it('covers the button label as well', () => {
    const html = generate(stateWith(button('')), { starters: STARTERS });

    expect(html).toContain('>Votre bouton</a>');
    expect(html).toContain(`${STARTER_ATTRIBUTE}="button"`);
  });

  // What TinyMCE leaves behind in a field the user emptied.
  it.each(['<br>', '&nbsp;', '    ', '<strong></strong>'])(
    'treats %j as blank',
    (content) => {
      const html = generate(stateWith(text(content)), { starters: STARTERS });

      expect(html).toContain(STARTER_ATTRIBUTE);
    }
  );

  it('leaves an element that holds something alone', () => {
    const html = generate(stateWith(text('Bonjour')), { starters: STARTERS });

    expect(html).toContain('Bonjour');
    expect(html).not.toContain('Saisissez');
    expect(html).not.toContain(STARTER_ATTRIBUTE);
  });

  it('changes nothing at all without the option', () => {
    const state = stateWith(text(''), button(''));

    expect(generate(state)).not.toContain('Saisissez');
    expect(generate(state)).not.toContain(STARTER_ATTRIBUTE);
    expect(generate(state, { elementIds: true })).not.toContain(
      STARTER_ATTRIBUTE
    );
  });

  // The words come from a dictionary, but they land in markup: the slot's
  // escaping applies to them exactly as to anything the user types.
  it('escapes the starter through the slot', () => {
    const html = generate(stateWith(button('')), {
      starters: { button: { key: 'label', text: '<img src=x onerror=1>' } },
    });

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('marks a row without substituting when a starter has no text', () => {
    const html = generate(stateWith({ id: 'i1', type: 'image', src: '' }), {
      starters: { image: { key: 'src' } },
    });

    expect(html).toContain(`${STARTER_ATTRIBUTE}="image"`);
    expect(html).toContain('src=""');
  });

  it('does not let a prototype key masquerade as a starter', () => {
    const html = generate(stateWith(text('')), {
      starters: Object.create({ text: { key: 'content', text: 'piégé' } }),
    });

    expect(html).not.toContain('piégé');
  });
});
