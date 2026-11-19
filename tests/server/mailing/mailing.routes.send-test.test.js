'use strict';

// A test send is bounded per account: an account gets a budget of sends per
// hour, and the next one answers 429 until the hour is over. The limit is
// read off the real route, guards first.

const { routeInspector } = require('../../helpers/express-router.js');
const router = require('../../../packages/server/mailing/mailing.routes.js');
const {
  TEST_SENDS_PER_HOUR_PER_ACCOUNT,
} = require('../../../packages/server/mailing/send-test-mail.service.js');

const { guardsOf } = routeInspector(router);
const PATH = '/:mailingId/mosaico/send-test-mail';

const limiter = () =>
  guardsOf('post', PATH).find((guard) => guard.name === 'rateLimit');

function sendAs(userId) {
  return new Promise((resolve) => {
    const res = { set: jest.fn(), on: jest.fn() };
    limiter()({ user: { id: userId }, headers: {} }, res, (err) =>
      resolve(err ? err.status : 'next')
    );
  });
}

describe('POST /mailings/:mailingId/mosaico/send-test-mail', () => {
  it('is bounded per account', async () => {
    expect(limiter()).toBeDefined();

    for (let i = 0; i < TEST_SENDS_PER_HOUR_PER_ACCOUNT; i += 1) {
      expect(await sendAs('account-a')).toBe('next');
    }
    expect(await sendAs('account-a')).toBe(429);
    // another account keeps its own budget
    expect(await sendAs('account-b')).toBe('next');
  });
});
