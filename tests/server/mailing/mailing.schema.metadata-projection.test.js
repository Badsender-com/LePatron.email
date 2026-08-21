'use strict';

// The listing gets its rows from findForApiWithPagination. Two things must hold
// for the metadata columns and filters to work at all, and both are invisible in
// review if broken: the new fields must be in the .find() projection (an absent
// key means an empty column, not an error), and the new filters must land in the
// query alongside the existing ones instead of replacing them.
//
// Same harness as mailing.schema.find-for-api-pagination.test.js: the static is
// called with a fake `this`, no Mongoose involved.

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

const mongoose = require('mongoose');
const MailingSchema = require('../../../packages/server/mailing/mailing.schema');

const findForApiWithPagination = MailingSchema.statics.findForApiWithPagination;

const ID_ROW = mongoose.Types.ObjectId('507f1f77bcf86cd799439055');
const TYPE_A = '507f1f77bcf86cd799439101';
const TYPE_B = '507f1f77bcf86cd799439102';

function makeModel(pageDocs = []) {
  const paginate = jest
    .fn()
    .mockResolvedValue({ docs: pageDocs, totalDocs: pageDocs.length, page: 1 });
  const lean = jest.fn().mockResolvedValue([]);
  const find = jest.fn().mockReturnValue({ lean });
  return { model: { paginate, find }, paginate };
}

async function queryFor(filtersJSON) {
  const { model, paginate } = makeModel();
  // filtersJSON travels inside the single query argument, alongside paginationJSON.
  await findForApiWithPagination.call(model, { filtersJSON });
  return paginate.mock.calls[0][0];
}

beforeEach(() => {
  mongoose.models = {};
});

describe('findForApiWithPagination — metadata projection', () => {
  it.each(['subject', 'plannedSendDate', '_emailType'])(
    'projects %s so the listing column is not empty',
    async (field) => {
      const { model, paginate } = makeModel();
      await findForApiWithPagination.call(model, {});
      expect(paginate.mock.calls[0][1].projection).toHaveProperty(field);
    }
  );

  // Asserting on the projection object is not enough, and that is exactly how a
  // regression slipped through: `emailTypeId: '$_emailType'` looked right there,
  // but the .find() projection mongoose-paginate-v2 uses does not honour an
  // aggregation expression, so the field came back ABSENT from the response.
  // Caught by running the real endpoint. These assertions look at the row the
  // client actually receives.
  it('returns the typology as emailTypeId on the row itself', async () => {
    const TYPE = mongoose.Types.ObjectId('507f1f77bcf86cd799439101');
    const { model } = makeModel([
      { _id: ID_ROW, name: 'a', _emailType: TYPE, subject: 'Soldes' },
    ]);

    const { docs } = await findForApiWithPagination.call(model, {});

    expect(docs[0].emailTypeId).toEqual(TYPE);
    expect(docs[0]).not.toHaveProperty('_emailType');
    expect(docs[0].subject).toBe('Soldes');
  });

  it('leaves emailTypeId undefined on an email without a typology', async () => {
    const { model } = makeModel([{ _id: ID_ROW, name: 'a' }]);

    const { docs } = await findForApiWithPagination.call(model, {});

    expect(docs[0].emailTypeId).toBeUndefined();
    expect(docs[0]).not.toHaveProperty('_emailType');
  });

  it('does not project the aggregation-expression form, which does not work', async () => {
    const { model, paginate } = makeModel();
    await findForApiWithPagination.call(model, {});
    expect(paginate.mock.calls[0][1].projection.emailTypeId).toBeUndefined();
  });

  it('still does not project previewHtml (the blob stays out of the page query)', async () => {
    const { model, paginate } = makeModel();
    await findForApiWithPagination.call(model, {});
    expect(paginate.mock.calls[0][1].projection).not.toHaveProperty(
      'previewHtml'
    );
  });
});

describe('findForApiWithPagination — emailTypes filter', () => {
  it('filters on _emailType with $in', async () => {
    const query = await queryFor({ emailTypes: [TYPE_A, TYPE_B] });
    expect(query._emailType).toEqual({ $in: [TYPE_A, TYPE_B] });
  });

  it.each([[[]], [undefined], ['not-an-array']])(
    'adds no filter for %p',
    async (emailTypes) => {
      const query = await queryFor({ emailTypes });
      expect(query).not.toHaveProperty('_emailType');
    }
  );

  it('combines with the existing template and tag filters', async () => {
    const query = await queryFor({
      emailTypes: [TYPE_A],
      templates: ['tpl-1'],
      tags: ['promo'],
    });

    expect(query._emailType).toEqual({ $in: [TYPE_A] });
    expect(query._wireframe).toEqual({ $in: ['tpl-1'] });
    expect(query.tags).toEqual({ $in: ['promo'] });
  });
});

describe('findForApiWithPagination — plannedSendDate range', () => {
  it('applies the lower bound', async () => {
    const query = await queryFor({ plannedSendDateStart: '2026-09-01' });
    expect(query.plannedSendDate).toEqual({ $gte: new Date('2026-09-01') });
  });

  it('applies the upper bound', async () => {
    const query = await queryFor({ plannedSendDateEnd: '2026-09-30' });
    expect(query.plannedSendDate).toEqual({ $lt: new Date('2026-09-30') });
  });

  it('keeps both bounds, instead of the second overwriting the first', async () => {
    const query = await queryFor({
      plannedSendDateStart: '2026-09-01',
      plannedSendDateEnd: '2026-09-30',
    });

    expect(query.plannedSendDate).toEqual({
      $gte: new Date('2026-09-01'),
      $lt: new Date('2026-09-30'),
    });
  });

  it('does not disturb the createdAt / updatedAt ranges', async () => {
    const query = await queryFor({
      plannedSendDateStart: '2026-09-01',
      createdAtStart: '2026-01-01',
      updatedAtEnd: '2026-12-31',
    });

    expect(query.plannedSendDate).toEqual({ $gte: new Date('2026-09-01') });
    expect(query.createdAt).toEqual({ $gte: new Date('2026-01-01') });
    expect(query.updatedAt).toEqual({ $lt: new Date('2026-12-31') });
  });
});
