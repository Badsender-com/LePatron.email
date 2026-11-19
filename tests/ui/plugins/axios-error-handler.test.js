'use strict';

// A 401 sends the browser to the login page, but for the consent of a
// connected application (ADR 0012): its page says why, and still lets the
// user decline.

const ORIGIN = 'https://lepatron.test';

let onError;
let redirected;

beforeAll(() => {
  const plugin = require('../../../packages/ui/plugins/axios-error-handler.js')
    .default;
  plugin({ $axios: { onError: (handler) => (onError = handler) } });
});

beforeEach(() => {
  redirected = false;
  const location = { origin: ORIGIN };
  Object.defineProperty(location, 'href', {
    get: () => `${ORIGIN}/oauth/consent/u1`,
    set: () => {
      redirected = true;
    },
  });
  global.window = { location };
});

afterEach(() => {
  delete global.window;
});

// The consent API's URLs are absolute (helpers/api-routes.js).
it.each(['details', 'consent', 'deny'])(
  'leaves the consent page to say why its %s is refused',
  (action) => {
    onError({
      response: { status: 401 },
      config: { url: `${ORIGIN}/oauth/consent/u1/${action}` },
    });

    expect(redirected).toBe(false);
  }
);

it('still sends a signed-out request elsewhere to the login page', () => {
  onError({ response: { status: 401 }, config: { url: '/mailings' } });

  expect(redirected).toBe(true);
});
