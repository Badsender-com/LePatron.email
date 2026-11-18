'use strict';

/**
 * Acceptance tests of the light read behind the comments' refresh (ADR 0020):
 * the editor lists the comments every 30 seconds while the panel is open, so
 * checking the access to the email reads its template's company, not the
 * whole email. Creating a comment keeps the full read, for the block snapshot.
 *
 * Turned on by P5 (the comments' controller).
 */

const mongoose = require('mongoose');

jest.mock('../../../packages/server/common/models.common.js');

const {
  Comments,
  Mailings,
} = require('../../../packages/server/common/models.common.js');
const commentService = require('../../../packages/server/comment/comment.service.js');

const GROUP = new mongoose.Types.ObjectId();
const MAILING = new mongoose.Types.ObjectId();
const user = {
  _id: new mongoose.Types.ObjectId(),
  role: 'reviewer',
  _company: GROUP,
};

describe('listing the comments reads the email lightly (ADR 0020, P5)', () => {
  it('selects the template only, to check the company', async () => {
    const select = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue({ _id: MAILING, _wireframe: { _company: GROUP } }),
      }),
    });
    Mailings.findById = jest.fn().mockReturnValue({ select });
    Comments.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    await commentService.getByMailing({ mailingId: MAILING.toString(), user });

    expect(select).toHaveBeenCalledWith('_wireframe');
  });
});
