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

  // Turned on by #1396 (a closed module refuses the assistants)
  describe.skip('what is offered', () => {
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

  // Turned on by #1398 (the AI features page and the consent say it is missing)
  describe.skip('why a user is stopped', () => {
    it('tells a user whose group lacks the module', async () => {
      oauth.update(app, 'groups', f.CLIENT_GROUP, { enableMcpModule: false });
      const { agent, uid } = await consentFor(f.FRANK);

      const response = await agent.get(`/oauth/consent/${uid}/details`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('no_mcp_module');
    });

    it('tells a user whose group has the module but no MCP access', async () => {
      oauth.update(app, 'groups', f.UNSUBSCRIBED_GROUP, {
        enableMcpModule: true,
      });
      const { agent, uid } = await consentFor(f.NINA);

      const response = await agent.get(`/oauth/consent/${uid}/details`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('no_mcp_access');
    });
  });
});
