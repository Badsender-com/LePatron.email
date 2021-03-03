export const ACL_NOT_CONNECTED = 'ACL_NOT_CONNECTED';
export const ACL_USER = 'ACL_USER';
export const ACL_ADMIN = 'ACL_ADMIN';
export const ACL_GROUP_ADMIN = 'ACL_GROUP_ADMIN';

export const isNoSessionPage = (acl) => acl === ACL_NOT_CONNECTED;

export function getAuthorizations(acl) {
  return {
    notConnected: isNoSessionPage(acl),
    user: isUserPage(acl),
    admin: isAdminPage(acl),
    groupAdmin: isGroupAdminPage(acl),
  };
}

function isUserPage(acl) {
  const userRoles = [ACL_USER, ACL_ADMIN, ACL_GROUP_ADMIN];
  return Array.isArray(acl)
    ? acl.every((role) => userRoles.includes(role))
    : userRoles.includes(acl);
}

function isGroupAdminPage(acl) {
  return Array.isArray(acl)
    ? acl.includes(ACL_GROUP_ADMIN)
    : acl === ACL_GROUP_ADMIN;
}

function isAdminPage(acl) {
  return Array.isArray(acl) ? acl.includes(ACL_ADMIN) : acl === ACL_ADMIN;
}
