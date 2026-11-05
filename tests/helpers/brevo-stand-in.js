'use strict';

// A local stand-in for the Brevo (Sendinblue) API v3, for tests that drive a
// Brevo client over real HTTP. It records each request (method, path, api
// key, JSON body) and answers the routes the provider calls.
//
// - Paths under MOVED or PERMANENT answer a redirect, as an API changing host
//   would (see below).
// - `failNext['METHOD /path']` makes the next call to that route answer 400
//   with the given JSON, or drop the connection when set to DROP.

const http = require('http');

const CAMPAIGN = {
  name: 'October newsletter',
  subject: 'News',
  replyTo: 'reply@client.test',
  sender: { name: 'Client', email: 'news@client.test' },
};

// Paths under these prefixes answer a redirect to the same path without the
// prefix, as an API changing host would: /moved with 301 on a read and 308 on
// a write, /permanent with 301 whatever the method.
const MOVED = '/moved';
const PERMANENT = '/permanent';

// failNext value that drops the connection instead of answering.
const DROP = 'drop';

function brevoStandIn() {
  const requests = [];
  const failNext = {};
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      if (req.url.startsWith(PERMANENT)) {
        res.writeHead(301, { location: req.url.slice(PERMANENT.length) });
        return res.end();
      }
      if (req.url.startsWith(MOVED)) {
        const status = req.method === 'GET' ? 301 : 308;
        res.writeHead(status, { location: req.url.slice(MOVED.length) });
        return res.end();
      }
      requests.push({
        method: req.method,
        path: req.url,
        apiKey: req.headers['api-key'],
        body: body ? JSON.parse(body) : undefined,
      });
      const route = `${req.method} ${req.url}`;
      if (failNext[route] === DROP) {
        delete failNext[route];
        return req.socket.destroy();
      }
      if (failNext[route]) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify(failNext[route]));
        delete failNext[route];
        return;
      }
      const json = (status, payload) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(payload === undefined ? '' : JSON.stringify(payload));
      };
      switch (route) {
        case 'GET /account':
          return json(200, { email: 'owner@client.test' });
        case 'GET /emailCampaigns':
          return json(200, { campaigns: [], count: 0 });
        case 'GET /emailCampaigns/12':
        case 'GET /smtp/templates/34':
          return json(200, CAMPAIGN);
        case 'POST /emailCampaigns':
          return json(201, { id: 56 });
        case 'POST /smtp/templates':
          return json(201, { id: 78 });
        case 'PUT /emailCampaigns/12':
        case 'PUT /smtp/templates/34':
          res.writeHead(204);
          return res.end();
        default:
          return json(404, { code: 'not_found' });
      }
    });
  });
  return { server, requests, failNext };
}

module.exports = { brevoStandIn, MOVED, PERMANENT, DROP };
