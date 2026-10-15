// Where a super admin lands after choosing another group in the selector
// (ADR 0002, amended). A settings tab of a group is kept in the new group;
// any other page under a group belongs to a resource of the previous group,
// so it gives way to the general settings of the new one. A page outside any
// group does not depend on it and stays where it is.

const SETTINGS_TAB = /^\/groups\/[^/]+\/settings\/([^/?#]+)\/?(?:[?#].*)?$/;
const UNDER_A_GROUP = /^\/groups\/(?!new(?:[/?#]|$))[^/?#]+/;

/**
 * @param {string} path the current full path, query included
 * @param {string} groupId the newly selected group
 * @returns {string} the path to go to
 */
export function routeAfterGroupSwitch(path, groupId) {
  const tab = path.match(SETTINGS_TAB);
  if (tab) return `/groups/${groupId}/settings/${tab[1]}`;
  if (UNDER_A_GROUP.test(path)) return `/groups/${groupId}/settings/general`;
  return path;
}
