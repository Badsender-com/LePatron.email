export const ACL_NOT_CONNECTED = 'ACL_NOT_CONNECTED';
export const ACL_USER = 'ACL_USER';
export const ACL_ADMIN = 'ACL_ADMIN';
export const ACL_GROUP_ADMIN = 'ACL_GROUP_ADMIN';
export const ACL_GROUP_ADMIN_TECH = 'ACL_GROUP_ADMIN_TECH';

export const isNoSessionPage = (acl) => acl === ACL_NOT_CONNECTED;

export function getAuthorizations(acl) {
  return {
    notConnected: isNoSessionPage(acl),
    user: isUserPage(acl),
    admin: isAdminPage(acl),
    groupAdmin: isGroupAdminPage(acl),
    groupAdminTech: isGroupAdminTechPage(acl),
  };
}

function isUserPage(acl) {
  return Array.isArray(acl) ? acl.includes(ACL_USER) : acl === ACL_USER;
}

function isGroupAdminPage(acl) {
  return Array.isArray(acl)
    ? acl.includes(ACL_GROUP_ADMIN)
    : acl === ACL_GROUP_ADMIN;
}

function isGroupAdminTechPage(acl) {
  return Array.isArray(acl)
    ? acl.includes(ACL_GROUP_ADMIN_TECH)
    : acl === ACL_GROUP_ADMIN_TECH;
}

function isAdminPage(acl) {
  return Array.isArray(acl) ? acl.includes(ACL_ADMIN) : acl === ACL_ADMIN;
}
