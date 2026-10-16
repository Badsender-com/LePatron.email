import { CAPABILITIES } from '../../shared/access/roles.js';

// What a page asks of its visitor, in its `meta.acl` (one value or a list,
// any of which grants the page), read by middleware/authentication-check.js.
// Besides being signed in or not, a page names the capability it needs: the
// UI compares no role (packages/shared/access/roles.js).
export const ACL_NOT_CONNECTED = 'ACL_NOT_CONNECTED';
export const ACL_USER = 'ACL_USER';
export const ACL_PLATFORM_MANAGE = CAPABILITIES.PLATFORM_MANAGE;
export const ACL_GROUP_MANAGE = CAPABILITIES.GROUP_MANAGE;
export const ACL_GROUP_MANAGE_TECH = CAPABILITIES.GROUP_MANAGE_TECH;
// Manages its own company, not the platform: the page writes to the user's
// own group, which a super admin and the bootstrap account do not have.
export const ACL_OWN_GROUP_MANAGE = 'ACL_OWN_GROUP_MANAGE';

export const isNoSessionPage = (acl) => acl === ACL_NOT_CONNECTED;

/**
 * Whether the visitor may open a page.
 *
 * @param {string|string[]} acl the page's `meta.acl`
 * @param {Object} visitor
 * @param {boolean} visitor.isConnected
 * @param {function(string): boolean} visitor.can the store's `CAN`
 * @returns {boolean}
 */
export function isPageGranted(acl, { isConnected, can }) {
  const acls = Array.isArray(acl) ? acl : [acl];
  return acls.some((entry) => {
    if (entry === ACL_NOT_CONNECTED) return !isConnected;
    if (!isConnected) return false;
    if (entry === ACL_USER) return true;
    if (entry === ACL_OWN_GROUP_MANAGE) {
      return (
        can(CAPABILITIES.GROUP_MANAGE) && !can(CAPABILITIES.PLATFORM_MANAGE)
      );
    }
    // A page without an acl is granted to nobody, as before.
    return entry != null && can(entry);
  });
}
