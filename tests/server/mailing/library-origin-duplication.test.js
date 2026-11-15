'use strict';

// The origin a composed block holds (ADR 0026) is the block's, not the email's:
// a copy of an email keeps the provenance of its blocks. Duplication rewrites
// every occurrence of the email's own id in its content, and nothing else.

const MailingSchema = require('../../../packages/server/mailing/mailing.schema.js');

const ENTRY_ID = '6af8d97d5a86a79f311eaf47';
const MAILING_ID = '6a859c4b1f26b497e8e011dd';

// Turned on by #1566 (an inserted composed block remembers its library entry)
describe.skip('an inserted composed block remembers its library entry', () => {
  it('keeps its origin through a duplication of the email', () => {
    const mailing = {
      _id: { toString: () => MAILING_ID },
      name: 'Newsletter',
      data: {
        mainBlocks: {
          blocks: [
            {
              type: 'blockBuilderBlock',
              builderHtml: '<p>x</p>',
              builderState: '{"v":1,"elements":[]}',
              libraryOrigin: ENTRY_ID,
            },
          ],
        },
      },
      markModified: () => {},
    };

    MailingSchema.methods.duplicate.call(mailing, {
      id: 'user-1',
      _id: 'user-1',
      name: 'Camille',
    });

    expect(mailing.data.mainBlocks.blocks[0].libraryOrigin).toBe(ENTRY_ID);
  });
});
