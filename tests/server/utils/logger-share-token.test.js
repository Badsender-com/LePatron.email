'use strict';

// A share link's token is its only credential: the request logs must never
// hold it whole, however the path is written.

const logger = require('../../../packages/server/utils/logger.js');

describe('request logs', () => {
  const tokens = (url) => ({ url: () => url });

  it('keep only the first characters of a share token', () => {
    const token = 'AbCd' + 'x'.repeat(39);
    expect(logger.loggedUrl(tokens(`/share/${token}`))).toBe('/share/AbCd…');
    expect(logger.loggedUrl(tokens(`/share/${token}?utm=1`))).toBe(
      '/share/AbCd…?utm=1'
    );
  });

  it('mask the token however the path is written', () => {
    const token = 'AbCd' + 'x'.repeat(39);
    expect(logger.loggedUrl(tokens(`/SHARE/${token}`))).toBe('/SHARE/AbCd…');
    expect(logger.loggedUrl(tokens(`//share/${token}`))).toBe('//share/AbCd…');
    expect(logger.loggedUrl(tokens(`/share/%41%42${token}`))).toBe(
      '/share/%41%…'
    );
  });

  it('leave every other address alone', () => {
    expect(logger.loggedUrl(tokens('/api/mailings/m1/share-links'))).toBe(
      '/api/mailings/m1/share-links'
    );
  });
});
