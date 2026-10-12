'use strict';

// Updating a user renames their mailings' author only when the name changes:
// an update without a name, such as a role change alone, renames nobody.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Users: { findOneForApi: jest.fn(), findByIdAndUpdate: jest.fn() },
  Mailings: { updateMany: jest.fn() },
}));

const {
  Users,
  Mailings,
} = require('../../../packages/server/common/models.common.js');
const userService = require('../../../packages/server/user/user.service.js');

beforeEach(() => {
  jest.clearAllMocks();
  Users.findOneForApi.mockResolvedValue({ id: 'u1', name: 'Dave' });
  Users.findByIdAndUpdate.mockReturnValue({
    populate: jest.fn().mockResolvedValue({ id: 'u1' }),
  });
  Mailings.updateMany.mockResolvedValue({ nModified: 1 });
});

it('leaves the mailings alone on an update without a name', async () => {
  await userService.updateUser({ userId: 'u1', role: 'super_admin' });

  expect(Mailings.updateMany).not.toHaveBeenCalled();
});

it('leaves the mailings alone when the name stays the same', async () => {
  await userService.updateUser({ userId: 'u1', name: 'Dave' });

  expect(Mailings.updateMany).not.toHaveBeenCalled();
});

it('renames the author of the mailings when the name changes', async () => {
  await userService.updateUser({ userId: 'u1', name: 'David' });

  expect(Mailings.updateMany).toHaveBeenCalledWith(
    { _user: 'u1' },
    { author: 'David' }
  );
});
