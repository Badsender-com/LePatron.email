/**
 * @jest-environment jsdom
 */

'use strict';

// A comment stored without a block, a decision or a parent comes back without
// those fields; the Knockout panel reads them by name, and a missing name
// throws, which broke the whole list.

const $ = require('jquery');
const {
  createCommentsApi,
} = require('../../../packages/editor/src/js/ext/comments/comments-api.js');

afterEach(() => jest.restoreAllMocks());

describe('the comments api', () => {
  it('gives every comment the fields the panel reads', async () => {
    jest
      .spyOn($, 'ajax')
      .mockImplementation((options) =>
        options.success({ items: [{ _id: 'c1', text: 'Sur tout l’email' }] })
      );
    const api = createCommentsApi({ apiBaseUrl: '/api', mailingId: 'm1' });
    expect(await api.list()).toEqual([
      {
        _id: 'c1',
        text: 'Sur tout l’email',
        blockId: null,
        decision: null,
        _parentComment: null,
      },
    ]);
  });

  it('reads a bare count per block as an info', async () => {
    jest
      .spyOn($, 'ajax')
      .mockImplementation((options) => options.success({ counts: { b1: 2 } }));
    const api = createCommentsApi({ apiBaseUrl: '/api', mailingId: 'm1' });
    expect(await api.counts()).toEqual({
      b1: { count: 2, maxSeverity: 'info' },
    });
  });
});
