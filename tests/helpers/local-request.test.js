'use strict';

// supertest is read through tests/helpers/local-request.js, which makes its
// server listen on 127.0.0.1: read directly, it listens on every address and
// can reach another process on macOS (see the helper).

const fs = require('fs');
const path = require('path');

const TESTS = path.join(__dirname, '..');
const HELPER = path.join(__dirname, 'local-request.js');

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

describe('the requests of the route tests', () => {
  it('go through the helper that listens on 127.0.0.1', () => {
    const direct = filesUnder(TESTS)
      .filter((file) => file !== HELPER)
      .filter((file) =>
        /require\(['"]supertest['"]\)|from ['"]supertest['"]/.test(
          fs.readFileSync(file, 'utf8')
        )
      )
      .map((file) => path.relative(TESTS, file));

    expect(direct).toEqual([]);
  });

  it('answer from the server of the test', async () => {
    const request = require('./local-request.js');
    const express = require('express');
    const app = express().get('/who', (req, res) => res.json({ me: true }));

    const res = await request(app).get('/who');

    expect(res.body).toEqual({ me: true });
  });
});
