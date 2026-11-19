'use strict';

const {
  isDynamic,
  stripMergeTags,
  SCRIPTING_MARKUP,
} = require('../../../packages/editor/src/js/ext/quality/merge-tag-syntax.js');

describe('merge-tag-syntax', () => {
  it.each([
    '{{first_name}}',
    '%%FirstName%%',
    '*|FNAME|*',
    '[[name]]',
    '<%= recipient.firstName %>',
    // eslint-disable-next-line no-template-curly-in-string
    '${contact.name}',
    '[unsubscribe_link]',
    '{% if customer %}',
  ])('reads %s as a merge tag', (value) => {
    expect(isDynamic(value)).toBe(true);
    expect(stripMergeTags(`Hi ${value}!`).replace(/\s+/g, ' ')).toBe('Hi !');
  });

  it('leaves plain text and addresses alone', () => {
    expect(isDynamic('https://brand.com/offer?a=1')).toBe(false);
    expect(stripMergeTags('Spring sale')).toBe('Spring sale');
  });

  it('reads a tag left open to a bounded length, not to the end of the text', () => {
    const text = `${'{{'.repeat(2000)}${'x'.repeat(30000)}`;
    expect(stripMergeTags(text)).toBe(text);
  });

  it('knows ESP scripting as no markup: <% %> and FreeMarker directives', () => {
    const scripting = '<% if (x) { %>a<% } %><#list items as i>b</#list>';
    expect(scripting.replace(SCRIPTING_MARKUP, '')).toBe('ab');
  });
});
