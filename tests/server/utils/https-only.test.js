'use strict';

// HTTPS everywhere but on a developer's machine: the session cookie travels
// over HTTPS only, and the browser is told to use HTTPS only.

const {
  sessionCookieOptions,
  forceHttps,
  HSTS,
} = require('../../../packages/server/utils/https-only.js');

const DEPLOYED = { isDev: false };
const DEVELOPER = { isDev: true };

function request(proto) {
  return {
    url: '/mailings?page=2',
    header: (name) =>
      ({ 'x-forwarded-proto': proto, host: 'app.client.test' }[name]),
  };
}

function response() {
  return {
    headers: {},
    redirect: jest.fn(),
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
}

describe('the session cookie', () => {
  it('is sent over HTTPS only, and not on the requests of other sites', () => {
    expect(sessionCookieOptions(DEPLOYED)).toMatchObject({
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });
  });

  it('also works over plain HTTP on a developer machine', () => {
    expect(sessionCookieOptions(DEVELOPER).secure).toBe(false);
  });
});

describe('a deployed application', () => {
  it('sends a plain HTTP request to HTTPS', () => {
    const res = response();
    const next = jest.fn();

    forceHttps(DEPLOYED)(request('http'), res, next);

    expect(res.redirect).toHaveBeenCalledWith(
      'https://app.client.test/mailings?page=2'
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('tells the browser to use HTTPS only, from an HTTPS request', () => {
    const res = response();
    const next = jest.fn();

    forceHttps(DEPLOYED)(request('https'), res, next);

    expect(res.headers['Strict-Transport-Security']).toBe(HSTS);
    expect(HSTS).toBe('max-age=31536000');
    expect(next).toHaveBeenCalled();
  });

  it('forces nothing on a developer machine', () => {
    expect(forceHttps(DEVELOPER)).toBeNull();
  });
});
