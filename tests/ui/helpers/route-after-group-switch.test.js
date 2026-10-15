// Where a super admin lands after choosing another group in the selector
// (ADR 0002, amended). In the settings, it stays on the same page of the new
// group, unless the page belongs to a resource of the previous group; in a
// module, it lands on the module's home in the new group; a global admin page
// does not depend on a group and stays where it is.

const PREVIOUS = '507f1f77bcf86cd799439a01';
const NEXT = '507f1f77bcf86cd799439b01';

let routeAfterGroupSwitch;

// Required in the blocks, not at the top of the file: the helper doesn't exist
// until #1274 ships it, and a top-level import would break the suite.
function loadHelper() {
  ({
    routeAfterGroupSwitch,
  } = require('~/helpers/route-after-group-switch.js'));
}

// Turned on by #1274 (the selected group)
describe.skip('switching group in the settings', () => {
  beforeAll(loadHelper);

  it.each([
    ['general'],
    ['templates'],
    ['workspaces'],
    ['users'],
    ['crm-intelligence'],
    ['email-builder'],
  ])('stays on the %s settings of the new group', (tab) => {
    expect(
      routeAfterGroupSwitch(`/groups/${PREVIOUS}/settings/${tab}`, NEXT)
    ).toBe(`/groups/${NEXT}/settings/${tab}`);
  });

  it('drops the query, which belongs to the previous group', () => {
    expect(
      routeAfterGroupSwitch(
        `/groups/${PREVIOUS}/settings/mailings?page=3`,
        NEXT
      )
    ).toBe(`/groups/${NEXT}/settings/mailings`);
  });

  it.each([
    ['a user', `/groups/${PREVIOUS}/settings/users/507f1f77bcf86cd799439101`],
    ['a workspace', `/groups/${PREVIOUS}/workspace/507f1f77bcf86cd799439011`],
    ['a profile', `/groups/${PREVIOUS}/profiles/507f1f77bcf86cd799439021`],
    [
      'an emails group',
      `/groups/${PREVIOUS}/emails-groups/507f1f77bcf86cd799439031`,
    ],
    ['a new template', `/groups/${PREVIOUS}/new-template`],
    ['a new workspace', `/groups/${PREVIOUS}/new-workspace`],
    ['the group page', `/groups/${PREVIOUS}`],
  ])(
    'opens the general settings of the new group from %s of the previous one',
    (_label, path) => {
      expect(routeAfterGroupSwitch(path, NEXT)).toBe(
        `/groups/${NEXT}/settings/general`
      );
    }
  );

  it.each([['/groups'], ['/super-admins'], ['/ai-skills'], ['/ai-playground']])(
    'stays on the global admin page %s',
    (path) => {
      expect(routeAfterGroupSwitch(path, NEXT)).toBe(path);
    }
  );
});

// Turned on by #1275 (super admins in the modules of their selected group)
describe.skip('switching group in a module', () => {
  beforeAll(loadHelper);

  it.each([
    ['/mailings'],
    ['/mailings?wid=507f1f77bcf86cd799439011'],
    ['/mailings?fid=507f1f77bcf86cd799439012'],
    ['/mailings/new?wid=507f1f77bcf86cd799439011'],
  ])('lands on the Email Builder home from %s', (path) => {
    expect(routeAfterGroupSwitch(path, NEXT)).toBe('/mailings');
  });

  it.each([['/crm-intelligence'], ['/crm-intelligence?dashboard=d1']])(
    'lands on the CRM Intelligence home from %s',
    (path) => {
      expect(routeAfterGroupSwitch(path, NEXT)).toBe('/crm-intelligence');
    }
  );
});
