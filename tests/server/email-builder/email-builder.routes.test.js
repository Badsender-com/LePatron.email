'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../../../packages/server/email-builder/textgen.service.js', () => ({
  generateBlockText: jest.fn(),
}));
jest.mock('../../../packages/server/account/auth.guard.js', () => ({
  GUARD_USER: (req, _res, next) => {
    if (!req.headers['x-test-user']) {
      const err = new Error('Unauthorized');
      err.status = 401;
      return next(err);
    }
    req.user = {
      id: 'user-1',
      isAdmin: false,
      group: { id: 'group-1' },
    };
    next();
  },
}));

const textgenService = require('../../../packages/server/email-builder/textgen.service.js');
const routes = require('../../../packages/server/email-builder/email-builder.routes.js');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/email-builder', routes);
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return app;
}

beforeEach(() => jest.clearAllMocks());

describe('email-builder HTTP routes', () => {
  it('rejects unauthenticated calls', async () => {
    const res = await request(makeApp())
      .post('/api/email-builder/textgen/block')
      .send({ instruction: 'x', currentContent: [{ path: 'a', value: 'b' }] });
    expect(res.status).toBe(401);
  });

  it('400 on missing instruction or empty currentContent', async () => {
    const app = makeApp();
    let res = await request(app)
      .post('/api/email-builder/textgen/block')
      .set('x-test-user', '1')
      .send({ currentContent: [{ path: 'a', value: 'b' }] });
    expect(res.status).toBe(400);
    res = await request(app)
      .post('/api/email-builder/textgen/block')
      .set('x-test-user', '1')
      .send({ instruction: 'x', currentContent: [] });
    expect(res.status).toBe(400);
    expect(textgenService.generateBlockText).not.toHaveBeenCalled();
  });

  it('forwards the user group and returns the service result', async () => {
    textgenService.generateBlockText.mockResolvedValue({
      generated: [{ path: 'titleText', value: 'New' }],
      omittedPaths: [],
    });
    const res = await request(makeApp())
      .post('/api/email-builder/textgen/block')
      .set('x-test-user', '1')
      .send({
        instruction: 'Promo',
        currentContent: [{ path: 'titleText', value: 'Old' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.generated).toEqual([{ path: 'titleText', value: 'New' }]);
    expect(textgenService.generateBlockText).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'group-1', userId: 'user-1' })
    );
  });
});
