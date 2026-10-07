'use strict';

const {
  isDynamic,
  stripMergeTags,
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
  ])('reads %s as a merge tag', (value) => {
    expect(isDynamic(value)).toBe(true);
    expect(stripMergeTags(`Hi ${value}!`).replace(/\s+/g, ' ')).toBe('Hi !');
  });

  it('leaves plain text and addresses alone', () => {
    expect(isDynamic('https://brand.com/offer?a=1')).toBe(false);
    expect(stripMergeTags('Spring sale')).toBe('Spring sale');
  });
});
