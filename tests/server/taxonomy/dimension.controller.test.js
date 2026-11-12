'use strict';

// What the dimension endpoints send the screen: the fields it renders from, and
// never the company.

jest.mock(
  '../../../packages/server/taxonomy/services/dimension.service.js',
  () => ({
    listDimensions: jest.fn(),
  })
);

const dimensionService = require('../../../packages/server/taxonomy/services/dimension.service.js');
const controller = require('../../../packages/server/taxonomy/controllers/dimension.controller.js');

const respond = () => {
  const res = { json: jest.fn() };
  return res;
};

describe('dimension controller: what the screen receives', () => {
  it('sends the dimension a dimension hangs under, so the screen can show it', async () => {
    dimensionService.listDimensions.mockResolvedValue([
      {
        _id: '507f1f77bcf86cd799439d01',
        _company: '507f1f77bcf86cd799439a01',
        name: 'language',
        label: 'Langue',
        isActive: true,
        order: 20,
        precedence: 30,
        parentName: 'market',
      },
      {
        _id: '507f1f77bcf86cd799439d02',
        _company: '507f1f77bcf86cd799439a01',
        name: 'market',
        label: 'Marché',
        isActive: true,
      },
    ]);
    const res = respond();

    await controller.listDimensions({ user: {}, query: {} }, res, jest.fn());

    const [{ items }] = res.json.mock.calls[0];
    expect(items[0]).toMatchObject({ name: 'language', parentName: 'market' });
    expect(items[1].parentName).toBeNull();
    expect(items[0]).not.toHaveProperty('_company');
  });
});
