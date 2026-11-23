'use strict';

// Whether the logs of a company's AI invocations keep their content (the text
// sent, the instruction, the raw answer): on unless the company turns it off.
// Set by whoever sets up the company's AI features, its tech admin or a super
// admin; the group update keeps it out of everyone else's reach, as every
// field they may not set. The invocation log reads it
// (tests/server/ai-skill/services/skill-invocation.test.js).

const mongoose = require('mongoose');
const {
  groupService,
  GROUP_ID,
  companyAdmin,
  techAdmin,
  superAdmin,
  storedGroup,
  update,
} = require('./group-update.harness.js');
const {
  ROLES,
  CAPABILITIES,
  roleCan,
} = require('../../../packages/shared/access/roles.js');

beforeEach(() => {
  jest.clearAllMocks();
  storedGroup({ logSkillInvocationContent: true });
});

describe('PUT /groups/:groupId — the content of the AI invocation logs', () => {
  it('is kept on a new company', () => {
    const GroupSchema = require('../../../packages/server/group/group.schema.js');
    const Group =
      mongoose.models.AiLogContentGroup ||
      mongoose.model('AiLogContentGroup', GroupSchema);

    expect(new Group({ name: 'New client' }).logSkillInvocationContent).toBe(
      true
    );
  });

  it.each(Object.values(ROLES))('decides the field for a %s', async (role) => {
    const payload = await update(
      { id: 'r1', role, group: GROUP_ID },
      { logSkillInvocationContent: false }
    );

    if (roleCan(role, CAPABILITIES.GROUP_MANAGE_TECH)) {
      expect(payload.logSkillInvocationContent).toBe(false);
    } else {
      expect(payload).not.toHaveProperty('logSkillInvocationContent');
    }
  });

  it('lets a tech admin turn it off, and back on', async () => {
    expect(
      (await update(techAdmin, { logSkillInvocationContent: false }))
        .logSkillInvocationContent
    ).toBe(false);

    jest.clearAllMocks();
    storedGroup({ logSkillInvocationContent: false });
    expect(
      (await update(techAdmin, { logSkillInvocationContent: true }))
        .logSkillInvocationContent
    ).toBe(true);
  });

  it('lets a super admin turn it off', async () => {
    const payload = await update(superAdmin, {
      logSkillInvocationContent: false,
    });

    expect(payload.logSkillInvocationContent).toBe(false);
  });

  it('keeps it out of the reach of a company admin', async () => {
    const payload = await update(companyAdmin, {
      name: 'Renamed',
      logSkillInvocationContent: false,
    });

    expect(payload).not.toHaveProperty('logSkillInvocationContent');
    expect(payload.name).toBe('Renamed');
  });

  // Anything but `true` keeps the content out of the logs.
  it.each([['yes'], ['true'], [1], [{ $ne: false }], [null]])(
    'keeps a boolean when the request carries %p',
    async (value) => {
      const payload = await update(techAdmin, {
        logSkillInvocationContent: value,
      });

      expect(payload.logSkillInvocationContent).toBe(false);
    }
  );

  it('leaves the field alone when the request does not carry it', async () => {
    const payload = await update(techAdmin, { name: 'Renamed' });

    expect(payload).not.toHaveProperty('logSkillInvocationContent');
    expect(groupService.updateGroup).toHaveBeenCalledTimes(1);
  });
});
