export const ACL_NOT_CONNECTED = 'ACL_NOT_CONNECTED';
export const ACL_USER = 'ACL_USER';
export const ACL_ADMIN = 'ACL_ADMIN';
export const ACL_GROUP_ADMIN = 'ACL_GROUP_ADMIN';

export const isNoSessionPage = (acl) => acl === ACL_NOT_CONNECTED;
export const isUserPage = (acl) =>
  acl === ACL_USER || acl === ACL_ADMIN || acl === ACL_GROUP_ADMIN;
export const isGroupAdminPage = (acl) => acl === ACL_GROUP_ADMIN;
export const isAdminPage = (acl) => acl === ACL_ADMIN;

export function getAuthorizations(acl) {
  return {
    notConnected: isNoSessionPage(acl),
    user: isUserPage(acl),
    admin: isAdminPage(acl),
    groupAdmin: isGroupAdminPage(acl),
  };
}
