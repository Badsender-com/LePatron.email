'use strict';

// The routes that export, push or send what the request carries accept JSON
// only. A browser sends a JSON body to another site only after a CORS
// preflight the app does not grant, so these routes stay with the app's own
// pages; a plain form posted from elsewhere is turned away.

const express = require('express');
const request = require('supertest');

const {
  requireJsonBody,
} = require('../../../packages/server/utils/require-json-body.js');
const {
  GUARD_USER,
} = require('../../../packages/server/account/auth.guard.js');
const { routeInspector } = require('../../helpers/express-router.js');
const router = require('../../../packages/server/mailing/mailing.routes.js');
const profileRouter = require('../../../packages/server/profile/profile.routes.js');

function appWith(handler) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.post('/x', requireJsonBody, handler);
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) =>
    res.status(error.status).send(error.message)
  );
  return app;
}

describe('requireJsonBody', () => {
  const ok = (req, res) => res.json({ received: req.body });

  it('lets a JSON body through', async () => {
    const response = await request(appWith(ok))
      .post('/x')
      .send({ html: '<p>x</p>' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: { html: '<p>x</p>' } });
  });

  it.each([
    ['a url-encoded form', 'application/x-www-form-urlencoded', 'html=x'],
    ['a multipart form', 'multipart/form-data; boundary=b', '--b--'],
    ['plain text', 'text/plain', 'html=x'],
  ])('turns away %s', async (_label, type, body) => {
    const handler = jest.fn(ok);
    const response = await request(appWith(handler))
      .post('/x')
      .set('Content-Type', type)
      .send(body);

    expect(response.status).toBe(415);
    expect(response.text).toBe('JSON_BODY_REQUIRED');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('the mailing routes that act on what the request carries', () => {
  const { guardsOf } = routeInspector(router);

  it.each([
    ['/:mailingId/mosaico/download-zip'],
    ['/:mailingId/mosaico/send-test-mail'],
    ['/download-multiple-zip'],
  ])('%s requires a JSON body', (path) => {
    expect(guardsOf('post', path)).toEqual([GUARD_USER, requireJsonBody]);
  });
});

// It pushes the request's HTML to the ESP, as the campaign the user ships.
describe('the profile route that sends a campaign', () => {
  const { guardsOf } = routeInspector(profileRouter);

  it('/:mailingId/send-campaign-mail requires a JSON body', () => {
    expect(guardsOf('post', '/:mailingId/send-campaign-mail')).toEqual([
      GUARD_USER,
      requireJsonBody,
    ]);
  });
});
