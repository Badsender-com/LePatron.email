'use strict';

// A company is written by its named fields only (PUT /groups/:groupId): a key
// that starts with `$` would be read by the database as an update operator,
// and could set a switch past the rule it answers to (group-switch.js). The
// harness's updateGroup writes a `$set` as Mongoose's updateOne does.

const {
  SecurityEvents,
  groupService,
  superAdmin,
  storedGroup,
  update,
} = require('./group-update.harness.js');
const {
  revokeConnections,
} = require('../../../packages/server/mcp/mcp-connections.js');

const SWITCHES = [
  'enableMcpModule',
  'enableMcp',
  'allowRetex',
  'requireTwoFactor',
];

let saved;

beforeEach(() => {
  jest.clearAllMocks();
  saved = storedGroup(
    Object.fromEntries(SWITCHES.map((field) => [field, false]))
  );
});

describe('PUT /groups/:groupId — named fields only', () => {
  it.each(SWITCHES)(
    'leaves %s as it was when a super admin sends it as an operator',
    async (field) => {
      await update(superAdmin, { name: 'Renamed', $set: { [field]: true } });

      expect(saved[field]).toBe(false);
      expect(saved.name).toBe('Renamed');
      expect(SecurityEvents.create).not.toHaveBeenCalled();
    }
  );

  it('hands the service no key that starts with $', async () => {
    await update(superAdmin, {
      name: 'Renamed',
      $set: { enableMcp: true },
      $unset: { name: 1 },
      $rename: { enableMcp: 'x' },
    });

    expect(
      Object.keys(groupService.updateGroup.mock.calls[0][0]).filter((key) =>
        key.startsWith('$')
      )
    ).toEqual([]);
  });

  it('still writes a switch sent by its name', async () => {
    await update(superAdmin, { enableMcpModule: true, $set: { enableMcp: 1 } });

    expect(saved.enableMcpModule).toBe(true);
    expect(saved.enableMcp).toBe(false);
    expect(revokeConnections).not.toHaveBeenCalled();
  });
});
