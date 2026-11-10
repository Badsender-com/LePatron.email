/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The MCP module at consent (ADR 0017): a company without it is never offered,
// and a user whose company lacks it is told so, apart from MCP access being
// off, so the consent page can name who may change it.

const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');

const { CIMD_CLIENT } = oauth;

describe('the MCP module at consent', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  const consentFor = async (userId) => {
    const agent = oauth.signIn(app, userId);
    const uid = await oauth.startConsent(
      agent,
      CIMD_CLIENT,
      oauth.pkce().challenge
    );
    return { agent, uid };
  };

  describe('what is offered', () => {
    it('leaves a group without the module out of a super admin’s choice', async () => {
      oauth.update(app, 'groups', f.OTHER_GROUP, { enableMcpModule: false });
      const { agent, uid } = await consentFor(f.ALICE);

      const { body } = await agent.get(`/oauth/consent/${uid}/details`);

      expect(body.groups.map((group) => group.id).sort()).toEqual(
        [f.PLATFORM_GROUP, f.CLIENT_GROUP].sort()
      );
    });

    it('refuses to bind a super admin to a group without the module', async () => {
      oauth.update(app, 'groups', f.OTHER_GROUP, { enableMcpModule: false });
      const { agent, uid } = await consentFor(f.ALICE);

      const consent = await agent
        .post(`/oauth/consent/${uid}/consent`)
        .send({ groupId: f.OTHER_GROUP });

      expect(consent.status).toBe(403);
    });
  });

  describe('why a user is stopped', () => {
    it('tells a user whose group lacks the module', async () => {
      oauth.update(app, 'groups', f.CLIENT_GROUP, { enableMcpModule: false });
      const { agent, uid } = await consentFor(f.FRANK);

      const response = await agent.get(`/oauth/consent/${uid}/details`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('MCP_CONSENT_NO_MODULE');
    });

    it('tells a user whose group has the module but no MCP access', async () => {
      oauth.update(app, 'groups', f.MCP_ACCESS_OFF_GROUP, {
        enableMcpModule: true,
      });
      const { agent, uid } = await consentFor(f.NINA);

      const response = await agent.get(`/oauth/consent/${uid}/details`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('MCP_CONSENT_NO_ACCESS');
    });

    // A super admin opens the modules: told the module is missing, not to
    // ask a tech admin, when no company has it.
    it('tells a super admin when no group has the module', async () => {
      f.GROUPS.forEach((group) =>
        oauth.update(app, 'groups', group._id, { enableMcpModule: false })
      );
      const { agent, uid } = await consentFor(f.ALICE);

      const response = await agent.get(`/oauth/consent/${uid}/details`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('MCP_CONSENT_NO_MODULE');
    });

    it('tells a super admin when the groups with the module have no MCP access', async () => {
      f.GROUPS.forEach((group) =>
        oauth.update(app, 'groups', group._id, { enableMcp: false })
      );
      const { agent, uid } = await consentFor(f.ALICE);

      const response = await agent.get(`/oauth/consent/${uid}/details`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('MCP_CONSENT_NO_ACCESS');
    });
  });

  // A client registered by hand connects its company alone: what that
  // company lacks is what the user is told, a super admin included.
  describe('why a client registered by a company is refused', () => {
    const REDIRECT =
      'https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect';
    let client;
    beforeEach(async () => {
      const { body } = await oauth
        .signIn(app, f.TESS)
        .post(`/api/groups/${f.CLIENT_GROUP}/mcp-clients`)
        .send({ name: 'Copilot Studio', redirectUris: [REDIRECT] });
      client = { client_id: body.clientId, redirect_uris: [REDIRECT] };
    });

    const refusalFor = async (userId) => {
      const agent = oauth.signIn(app, userId);
      const uid = await oauth.startConsent(
        agent,
        client,
        oauth.pkce().challenge
      );
      return agent.get(`/oauth/consent/${uid}/details`);
    };

    it.each([
      ['a super admin', f.ALICE],
      ['a user of the company', f.FRANK],
    ])('tells %s that the company lacks the module', async (_case, userId) => {
      oauth.update(app, 'groups', f.CLIENT_GROUP, {
        enableMcpModule: false,
      });

      const response = await refusalFor(userId);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('MCP_CONSENT_NO_MODULE');
    });

    it('tells a super admin that the company lacks MCP access', async () => {
      oauth.update(app, 'groups', f.CLIENT_GROUP, { enableMcp: false });

      const response = await refusalFor(f.ALICE);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('MCP_CONSENT_NO_ACCESS');
    });
  });

  // The company closed while its user consents: the closing revokes the
  // connections it finds, before this one is recorded. Read again once
  // recorded, it goes too, so a reopened module revives nothing (ADR 0017).
  describe('a company closed while its user consents', () => {
    const {
      revokeConnections,
    } = require('../../../packages/server/mcp/mcp-connections.js');
    const {
      McpConnections,
    } = require('../../../packages/server/common/models.common.js');

    // The closing lands between the reading of the companies offered and the
    // recording of the connection: written, then revoking what it finds.
    const closedBeforeRecording = (changes) => {
      const create = McpConnections.create.bind(McpConnections);
      jest
        .spyOn(McpConnections, 'create')
        .mockImplementationOnce(async (record) => {
          oauth.update(app, 'groups', f.CLIENT_GROUP, changes);
          await revokeConnections({ _company: f.CLIENT_GROUP });
          return create(record);
        });
    };

    afterEach(() => jest.restoreAllMocks());

    it.each([
      [
        'the module closed',
        { enableMcpModule: false },
        'MCP_CONSENT_NO_MODULE',
      ],
      ['MCP access turned off', { enableMcp: false }, 'MCP_CONSENT_NO_ACCESS'],
    ])(
      'revokes the connection and refuses the consent, %s',
      async (_case, changes, code) => {
        const { agent, uid } = await consentFor(f.FRANK);
        closedBeforeRecording(changes);

        const consent = await agent
          .post(`/oauth/consent/${uid}/consent`)
          .send({ groupId: f.CLIENT_GROUP });

        expect(consent.status).toBe(403);
        expect(consent.body.message).toBe(code);
        expect(oauth.stored('connections')).toEqual([]);
        expect(oauth.oauthStore('Grant').records).toEqual([]);
      }
    );

    it('revives nothing once the module is opened again', async () => {
      const { agent, uid } = await consentFor(f.FRANK);
      closedBeforeRecording({ enableMcpModule: false });
      await agent
        .post(`/oauth/consent/${uid}/consent`)
        .send({ groupId: f.CLIENT_GROUP });

      oauth.update(app, 'groups', f.CLIENT_GROUP, { enableMcpModule: true });
      const list = await oauth
        .signIn(app, f.FRANK)
        .get('/api/connected-applications');

      expect(list.body.items).toEqual([]);
    });
  });
});
