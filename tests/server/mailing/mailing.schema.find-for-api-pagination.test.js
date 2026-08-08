'use strict';

// Pins the preview-badge contract of MailingSchema.statics.findForApiWithPagination.
//
// `hasHtmlPreview` is a boolean the email listing uses to decide whether a
// mailing can be downloaded directly or needs the "no HTML generated" warning
// (mailings-selection-actions.vue). Historically this flag has flip-flopped
// between three implementations; the current one must:
//   1. NOT pull the (potentially huge) `previewHtml` blob into the page query —
//      the projection passed to paginate must omit it.
//   2. Derive the flag from a cheap _id-only follow-up query that fetches only
//      the ids whose `previewHtml` field exists.
// These tests lock both so a future refactor can't silently reintroduce the
// blob transfer or break the badge.

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

const mongoose = require('mongoose');
const MailingSchema = require('../../../packages/server/mailing/mailing.schema');

const ID_WITH_PREVIEW = mongoose.Types.ObjectId('507f1f77bcf86cd799439001');
const ID_WITHOUT_PREVIEW = mongoose.Types.ObjectId('507f1f77bcf86cd799439002');

const findForApiWithPagination = MailingSchema.statics.findForApiWithPagination;

// Builds a fake `this` for the static: paginate returns the supplied page docs,
// find (the _id-only preview lookup) returns the supplied "has preview" ids.
function makeModel({ pageDocs, previewIds }) {
  const paginate = jest.fn().mockResolvedValue({
    docs: pageDocs,
    totalDocs: pageDocs.length,
    page: 1,
  });
  const lean = jest.fn().mockResolvedValue(previewIds.map((_id) => ({ _id })));
  const find = jest.fn().mockReturnValue({ lean });
  return { model: { paginate, find }, paginate, find, lean };
}

describe('MailingSchema.statics.findForApiWithPagination — hasHtmlPreview', () => {
  beforeEach(() => {
    mongoose.models = {};
  });

  it('does NOT project previewHtml into the paginate query (no blob transfer)', async () => {
    const { model, paginate } = makeModel({
      pageDocs: [{ _id: ID_WITH_PREVIEW, name: 'a' }],
      previewIds: [ID_WITH_PREVIEW],
    });

    await findForApiWithPagination.call(model, {});

    const projection = paginate.mock.calls[0][1].projection;
    expect(projection).not.toHaveProperty('previewHtml');
  });

  it('derives the flag from a cheap _id-only lookup, not the full document', async () => {
    const { model, find } = makeModel({
      pageDocs: [{ _id: ID_WITH_PREVIEW, name: 'a' }],
      previewIds: [ID_WITH_PREVIEW],
    });

    await findForApiWithPagination.call(model, {});

    // Filter targets a non-empty `previewHtml`, projection is _id only.
    const [filter, projection] = find.mock.calls[0];
    expect(filter).toMatchObject({
      previewHtml: { $exists: true, $nin: [null, ''] },
    });
    expect(filter._id).toEqual({ $in: [ID_WITH_PREVIEW] });
    expect(projection).toEqual({ _id: 1 });
  });

  it('treats an empty/null previewHtml as no preview (matches download semantics)', async () => {
    // The _id-only lookup, driven by `{ $nin: [null, ''] }`, simply won't return
    // a row whose previewHtml is empty — so that mailing must come back false.
    const { model, find } = makeModel({
      pageDocs: [{ _id: ID_WITHOUT_PREVIEW, name: 'empty-html' }],
      previewIds: [], // empty-string previewHtml is excluded by the query
    });

    const { docs } = await findForApiWithPagination.call(model, {});

    expect(find.mock.calls[0][0].previewHtml).toEqual({
      $exists: true,
      $nin: [null, ''],
    });
    expect(docs[0].hasHtmlPreview).toBe(false);
  });

  it('sets hasHtmlPreview true/false per row and never leaks previewHtml', async () => {
    const { model } = makeModel({
      // The blob is present on the page docs on purpose: even if a future
      // refactor reprojects `previewHtml` into the paginate query, the function
      // must strip it from every returned doc. (Asserting absence on docs that
      // never carried it would pass vacuously.)
      pageDocs: [
        { _id: ID_WITH_PREVIEW, name: 'with', previewHtml: '<html>big</html>' },
        { _id: ID_WITHOUT_PREVIEW, name: 'without' },
      ],
      previewIds: [ID_WITH_PREVIEW], // only the first has a non-empty previewHtml
    });

    const { docs } = await findForApiWithPagination.call(model, {});

    const withPreview = docs.find((d) => d.name === 'with');
    const withoutPreview = docs.find((d) => d.name === 'without');

    expect(withPreview.hasHtmlPreview).toBe(true);
    expect(withoutPreview.hasHtmlPreview).toBe(false);
    // The raw HTML must never reach the client payload.
    expect(withPreview).not.toHaveProperty('previewHtml');
    expect(withoutPreview).not.toHaveProperty('previewHtml');
  });

  it('reports hasHtmlPreview false for every row when none have a preview', async () => {
    const { model } = makeModel({
      pageDocs: [
        { _id: ID_WITH_PREVIEW, name: 'a' },
        { _id: ID_WITHOUT_PREVIEW, name: 'b' },
      ],
      previewIds: [],
    });

    const { docs } = await findForApiWithPagination.call(model, {});

    expect(docs.every((d) => d.hasHtmlPreview === false)).toBe(true);
  });
});
