'use strict';

// The application reads JSON everywhere and a form-encoded body only where a
// client sends one. The editor renames an email with a form-encoded `name`
// (badsender-edit-title.js): that route reads its own form, so the rename
// keeps working with JSON as the only body read for every route.

jest.mock('../../../packages/server/mailing/mailing.controller.js', () => ({
  ...jest.requireActual(
    '../../../packages/server/mailing/mailing.controller.js'
  ),
  updateMosaico: (req, res) => res.json({ body: req.body }),
}));

const express = require('express');
const request = require('../../helpers/local-request.js');

const router = require('../../../packages/server/mailing/mailing.routes.js');

const MAILING_ID = '507f1f77bcf86cd799439011';
const superAdmin = { id: '507f1f77bcf86cd799439101', role: 'super_admin' };

function app() {
  const server = express();
  // what index.js reads for every route
  server.use(express.json());
  server.use((req, _res, next) => {
    req.user = superAdmin;
    req.isAuthenticated = () => true;
    next();
  });
  server.use('/api/mailings', router);
  server.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return server;
}

describe('PUT /api/mailings/:mailingId/mosaico', () => {
  it('reads the name the editor sends as a form', async () => {
    const res = await request(app())
      .put(`/api/mailings/${MAILING_ID}/mosaico`)
      .type('form')
      .send({ name: 'Summer sale' });

    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({ name: 'Summer sale' });
  });

  it('reads the content the editor saves as JSON', async () => {
    const res = await request(app())
      .put(`/api/mailings/${MAILING_ID}/mosaico`)
      .send({ name: 'Summer sale', data: { a: 1 } });

    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({ name: 'Summer sale', data: { a: 1 } });
  });

  it('refuses a form larger than a name needs', async () => {
    const res = await request(app())
      .put(`/api/mailings/${MAILING_ID}/mosaico`)
      .type('form')
      .send({ name: 'x'.repeat(200 * 1024) });

    expect(res.status).toBe(413);
  });
});
