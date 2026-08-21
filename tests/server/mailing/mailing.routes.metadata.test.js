'use strict';

// The `emailMetadata.enabled` flag gates the email metadata, and only those. The
// taxonomy used to sit behind it too, which forced admins to switch the feature on
// before they could prepare a company's typologies — so users met metadata fields
// whose typology picker was empty. The gate moved; this file pins where it landed.
//
// Its counterpart is tests/server/taxonomy/taxonomy.routes.test.js, which asserts
// the absence of the same guard. Read together, they state the boundary. Guards are
// compared by identity on the actual express stack, not on source text.

const {
  GUARD_USER,
} = require('../../../packages/server/account/auth.guard.js');
const {
  GUARD_EMAIL_METADATA,
} = require('../../../packages/server/mailing/email-metadata.guard.js');
const router = require('../../../packages/server/mailing/mailing.routes.js');

function layerFor(method, path) {
  const layer = router.stack.find(
    (candidate) =>
      candidate.route &&
      candidate.route.path === path &&
      candidate.route.methods[method]
  );
  if (!layer) {
    throw new Error(`no ${method.toUpperCase()} ${path} route declared`);
  }
  return layer;
}

const guardsOf = (method, path) =>
  layerFor(method, path)
    .route.stack.map((handler) => handler.handle)
    .slice(0, -1);

describe('mailing routes — the metadata endpoint is behind the flag', () => {
  it('declares PATCH /:mailingId/metadata', () => {
    expect(() => layerFor('patch', '/:mailingId/metadata')).not.toThrow();
  });

  it('gates it with GUARD_EMAIL_METADATA', () => {
    expect(guardsOf('patch', '/:mailingId/metadata')).toEqual([
      GUARD_USER,
      GUARD_EMAIL_METADATA,
    ]);
  });

  // Declared before `/:mailingId`, otherwise the rename route would answer first
  // — express matches in declaration order.
  it('is declared before the bare /:mailingId patch', () => {
    const patchPaths = router.stack
      .filter((layer) => layer.route && layer.route.methods.patch)
      .map((layer) => layer.route.path);

    expect(patchPaths).toContain('/:mailingId/metadata');
    expect(patchPaths).toContain('/:mailingId');
  });
});

describe('mailing routes — the flag gates nothing else', () => {
  // Everything a user does to an email that is not about its editorial metadata
  // must keep working for a company that never switched the feature on.
  it.each([
    ['get', ''],
    ['post', ''],
    ['patch', '/:mailingId'],
    ['get', '/:mailingId'],
    ['delete', '/:mailingId'],
    ['put', '/:mailingId/mosaico'],
    ['get', '/:mailingId/mosaico'],
    ['post', '/:mailingId/duplicate'],
    ['get', '/:mailingId/preview'],
    ['put', ''],
  ])('leaves %s %s untouched by the flag', (method, path) => {
    expect(guardsOf(method, path)).not.toContain(GUARD_EMAIL_METADATA);
  });
});
