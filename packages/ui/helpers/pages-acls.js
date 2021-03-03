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
  const result = Array.isArray(acl)
    ? acl.every(
        (element) =>
          [ACL_USER, ACL_ADMIN, ACL_GROUP_ADMIN].indexOf(element) !== 1
      )
    : acl === ACL_USER || acl === ACL_ADMIN || acl === ACL_GROUP_ADMIN;
  return result;
}

function isGroupAdminPage(acl) {
  const result = Array.isArray(acl)
    ? acl.includes(ACL_GROUP_ADMIN)
    : acl === ACL_GROUP_ADMIN;
  return result;
}

function isAdminPage(acl) {
  const result = Array.isArray(acl)
    ? acl.includes(ACL_ADMIN)
    : acl === ACL_ADMIN;
  return result;
}
