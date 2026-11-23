'use strict';

// Every route that forwards a user payload to an AI provider is counted by
// aiRateLimit, and its body is read by the AI parser, capped at 256 KB. Read
// off the real express stacks: a route added to one list and not the other
// fails here.

jest.mock('sharp', () => jest.fn());
jest.mock('puppeteer', () => ({}));

const path = require('path');
const express = require('express');
const request = require('../../helpers/local-request.js');

const SERVER = path.join(__dirname, '../../../packages/server');
const load = (file) => require(path.join(SERVER, file));

const { AI_ROUTE_PATHS } = load('ai-usage/ai-rate-limit.js');

// As index.js mounts them.
const ROUTERS = {
  '/api/translation': load('translation/translation.routes'),
  '/api/mailings': load('mailing/mailing.routes'),
  '/api/text-generation': load('text-generation/text-generation.routes.js'),
};

function rateLimitedRoutes() {
  return Object.entries(ROUTERS).flatMap(([mount, router]) =>
    router.stack
      .filter(
        (layer) =>
          layer.route &&
          layer.route.stack.some(
            (h) => h.handle.name === 'aiRateLimitMiddleware'
          )
      )
      .map((layer) => `${mount}${layer.route.path}`)
  );
}

describe('AI routes', () => {
  const routes = rateLimitedRoutes();

  it('are counted by aiRateLimit', () => {
    expect(routes.sort()).toEqual(
      [
        '/api/translation/text',
        '/api/translation/block',
        '/api/mailings/:mailingId/duplicate-translate',
        '/api/text-generation/subject',
        '/api/text-generation/preheader',
        '/api/text-generation/corrections',
      ].sort()
    );
  });

  // The paths index.js mounts the AI parser on.
  const app = express();
  app.use(AI_ROUTE_PATHS, (req, res) => res.send('ai'));
  app.use((req, res) => res.send('app'));

  it.each(routes)('%s has its body read by the AI parser', async (route) => {
    const res = await request(app).post(
      route.replace(':mailingId', '64b7f0c2a1b2c3d4e5f60718')
    );
    expect(res.text).toBe('ai');
  });
});
