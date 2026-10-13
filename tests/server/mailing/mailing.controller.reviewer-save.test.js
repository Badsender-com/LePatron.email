'use strict';

// PUT /mailings/:mailingId/mosaico, for a reviewer: a reviewer writes nothing,
// except the save the editor runs once on opening a mailing that has no
// preview yet. Any other role is not concerned here (ADR 0004).

const {
  mockMailing,
  mockFlags,
  save,
  resetMocks,
  user,
} = require('./update-mosaico.harness.js');
const { dataWith } = require('./synthetic-blocks.fixtures.js');

const EMPTY = dataWith();
const reviewer = { ...user, role: 'reviewer' };

beforeEach(() => {
  resetMocks();
  mockFlags({});
});

describe('PUT /mailings/:mailingId/mosaico — reviewer', () => {
  it('refuses to overwrite a mailing that already has a preview', async () => {
    const mailing = mockMailing(EMPTY, '');
    mailing.previewHtml = '<p>an email</p>';

    const error = await save(
      { data: EMPTY, htmlToExport: '<p>x</p>' },
      reviewer
    );

    expect(error).toMatchObject({
      status: 403,
      message: 'FORBIDDEN_REVIEWER_READ_ONLY',
    });
    expect(mailing.save).not.toHaveBeenCalled();
  });

  it('keeps the save run once on opening a mailing without a preview', async () => {
    const mailing = mockMailing(EMPTY, '');

    expect(
      await save({ data: EMPTY, htmlToExport: '<p>x</p>' }, reviewer)
    ).toBeNull();
    expect(mailing.save).toHaveBeenCalled();
  });

  it.each(['writer', 'regular_user', 'company_admin'])(
    'does not restrict a %s',
    async (role) => {
      const mailing = mockMailing(EMPTY, '');
      mailing.previewHtml = '<p>an email</p>';

      expect(
        await save({ data: EMPTY, htmlToExport: '<p>x</p>' }, { ...user, role })
      ).toBeNull();
      expect(mailing.save).toHaveBeenCalled();
    }
  );
});
