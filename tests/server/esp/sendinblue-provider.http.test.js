'use strict';

// The Brevo (Sendinblue) provider over real HTTP, against a local stand-in for
// the API: each method's request (path, api key, body) and what it reads back.
//
// The redirect cases guard the SDK's HTTP client. sib-api-v3-sdk 8.2.0 ships
// superagent 3.7.0, whose redirect code reads OutgoingMessage#_headers; Node 24
// removed it, so any redirect threw inside superagent's response handler and
// the call never settled. package.json resolves the SDK's superagent to 5.3.1.

const http = require('http');
const SibApiV3Sdk = require('sib-api-v3-sdk');

const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const logger = require('../../../packages/server/utils/logger.js');
const SendinBlueProvider = require('../../../packages/server/esp/sendinblue/sendinBlueProvider.js');
const ESP_CONTENT_TYPE = require('../../../packages/server/constant/content-esp-type.js');

const API_KEY = 'xkeysib-test';
const CAMPAIGN = {
  name: 'October newsletter',
  subject: 'News',
  replyTo: 'reply@client.test',
  sender: { name: 'Client', email: 'news@client.test' },
};

// Paths under /moved answer a redirect to the same path without the prefix,
// as an API changing host would.
const MOVED = '/moved';

function brevoStandIn() {
  const requests = [];
  const failNext = {};
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
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

const pushArgs = (contentSendType) => ({
  campaignMailData: {
    senderName: 'Client',
    senderMail: 'news@client.test',
    subject: 'News',
    name: 'October newsletter',
    replyTo: 'reply@client.test',
    contentSendType,
  },
  user: {},
  html: '<html>raw</html>',
  mailingId: 'm1',
});

describe('the Brevo provider over HTTP', () => {
  const client = SibApiV3Sdk.ApiClient.instance;
  const originalBasePath = client.basePath;
  let stand;
  let origin;
  let provider;

  beforeAll(async () => {
    stand = brevoStandIn();
    await new Promise((resolve) =>
      stand.server.listen(0, '127.0.0.1', resolve)
    );
    origin = `http://127.0.0.1:${stand.server.address().port}`;
  });

  afterAll(async () => {
    client.basePath = originalBasePath;
    await new Promise((resolve) => stand.server.close(resolve));
  });

  beforeEach(() => {
    stand.requests.length = 0;
    client.basePath = origin;
    jest
      .spyOn(mailingService, 'processHtmlWithFTPOption')
      .mockResolvedValue('<html>processed</html>');
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    provider = new SendinBlueProvider({ apiKey: API_KEY });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('each method', () => {
    it('connects with the api key', async () => {
      const account = await provider.connectApi();

      expect(account.email).toBe('owner@client.test');
      expect(stand.requests).toEqual([
        { method: 'GET', path: '/account', apiKey: API_KEY, body: undefined },
      ]);
    });

    it('reads a campaign', async () => {
      await expect(
        provider.getCampaignMail({ campaignId: 12 })
      ).resolves.toEqual({
        name: 'October newsletter',
        subject: 'News',
        additionalApiData: {
          senderName: 'Client',
          senderMail: 'news@client.test',
          replyTo: 'reply@client.test',
        },
      });
      expect(stand.requests[0].path).toBe('/emailCampaigns/12');
    });

    it('reads a template', async () => {
      const template = await provider.getTemplate({ campaignId: 34 });

      expect(template.name).toBe('October newsletter');
      expect(stand.requests[0].path).toBe('/smtp/templates/34');
    });

    it('creates a campaign with the processed HTML', async () => {
      const id = await provider.createCampaignMail(
        pushArgs(ESP_CONTENT_TYPE.MAIL)
      );

      expect(id).toBe(56);
      expect(stand.requests[0]).toMatchObject({
        method: 'POST',
        path: '/emailCampaigns',
        apiKey: API_KEY,
        body: {
          name: 'October newsletter',
          subject: 'News',
          replyTo: 'reply@client.test',
          sender: { name: 'Client', email: 'news@client.test' },
          htmlContent: '<html>processed</html>',
        },
      });
    });

    it('creates an active template', async () => {
      const id = await provider.createTemplate(
        pushArgs(ESP_CONTENT_TYPE.TEMPLATE)
      );

      expect(id).toBe(78);
      expect(stand.requests[0]).toMatchObject({
        method: 'POST',
        path: '/smtp/templates',
        body: { templateName: 'October newsletter', isActive: true },
      });
    });

    it('updates a campaign and a template', async () => {
      await provider.updateCampaignMail({
        ...pushArgs(ESP_CONTENT_TYPE.MAIL),
        campaignId: 12,
      });
      await provider.updateTemplate({
        ...pushArgs(ESP_CONTENT_TYPE.TEMPLATE),
        campaignId: 34,
      });

      expect(
        stand.requests.map(({ method, path }) => `${method} ${path}`)
      ).toEqual(['PUT /emailCampaigns/12', 'PUT /smtp/templates/34']);
      expect(stand.requests[1].body).toMatchObject({ isActive: true });
    });
  });

  it('rejects with the API status and logs its answer', async () => {
    stand.failNext['POST /emailCampaigns'] = {
      code: 'invalid_parameter',
      message: 'sender is invalid',
    };

    const error = await provider
      .createCampaignMail(pushArgs(ESP_CONTENT_TYPE.MAIL))
      .catch((e) => e);

    expect(error.status).toBe(400);
    expect(logger.error).toHaveBeenCalledWith(
      JSON.stringify({
        code: 'invalid_parameter',
        message: 'sender is invalid',
      })
    );
  });

  // Short timeouts: a call that never settles is the failure.
  describe('when the API answers a redirect', () => {
    beforeEach(() => {
      client.basePath = `${origin}${MOVED}`;
    });

    it('follows it on a read', async () => {
      const account = await provider.connectApi();

      expect(account.email).toBe('owner@client.test');
      expect(stand.requests[0].path).toBe('/account');
    }, 2000);

    it('follows it on a create, keeping the method and the body', async () => {
      const id = await provider.createCampaignMail(
        pushArgs(ESP_CONTENT_TYPE.MAIL)
      );

      expect(id).toBe(56);
      expect(stand.requests[0]).toMatchObject({
        method: 'POST',
        path: '/emailCampaigns',
        apiKey: API_KEY,
        body: { htmlContent: '<html>processed</html>' },
      });
    }, 2000);

    it('follows it on an update', async () => {
      await provider.updateTemplate({
        ...pushArgs(ESP_CONTENT_TYPE.TEMPLATE),
        campaignId: 34,
      });

      expect(stand.requests[0]).toMatchObject({
        method: 'PUT',
        path: '/smtp/templates/34',
        body: { isActive: true },
      });
    }, 2000);
  });
});
