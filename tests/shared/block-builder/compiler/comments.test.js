'use strict';

// Comments in a component are notes for whoever edits it next, and must not
// reach the email of everyone who ships the block — except Outlook's
// conditional comments, which are markup to the clients that read them.

const {
  stripComments,
} = require('../../../../scripts/block-builder/markup-pipeline.js');
const { compileFixture } = require('./fixture.js');

describe('stripComments', () => {
  it('drops an ordinary comment', () => {
    expect(stripComments('<td><!-- a note -->x</td>')).toBe('<td>x</td>');
  });

  it('drops what Vue leaves behind for a resolved v-if', () => {
    expect(stripComments('<td><!--v-if--></td>')).toBe('<td></td>');
  });

  it('keeps a downlevel-hidden conditional comment, markup included', () => {
    const mso = '<!--[if mso]><table><tr><td><![endif]-->';
    expect(stripComments(`${mso}<p>x</p>`)).toBe(`${mso}<p>x</p>`);
  });

  it('keeps both halves of a downlevel-revealed conditional comment', () => {
    const html = '<!--[if !mso]><!--><p>x</p><!--<![endif]-->';
    expect(stripComments(html)).toBe(html);
  });

  it('does not mistake a comment that merely mentions [if for one', () => {
    expect(stripComments('<!-- see [if mso] below -->')).toBe('');
  });
});

describe('comments through the whole compile', () => {
  const slots = { label: { context: 'TEXT' } };

  it('strips the author’s notes and keeps the conditional comments', async () => {
    const { default: html } = await compileFixture({
      slots,
      template: [
        '<table><tr>',
        '<!-- a note for the next author -->',
        '<!-- prettier-ignore -->',
        '<!--[if mso]><td width="600"><![endif]-->',
        '<!--[if !mso]><!--><td><!--<![endif]-->{{ label }}</td>',
        '</tr></table>',
      ].join(''),
    });

    expect(html).toBe(
      '<table><tr><!--[if mso]><td width="600"><![endif]-->' +
        '<!--[if !mso]><!--><td><!--<![endif]-->[[label|TEXT|]]</td>' +
        '</tr></table>'
    );
  });
});

describe('the compiler and NODE_ENV', () => {
  const original = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  // Vue's production build drops every comment and every warning, so the same
  // source would compile to a different email depending on the shell.
  it('refuses to load under NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    jest.isolateModules(() => {
      expect(() =>
        require('../../../../scripts/block-builder/render-component.js')
      ).toThrow(/development build/);
    });
  });
});
