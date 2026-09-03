import * as pageAcl from '~/helpers/pages-acls.js';
import { USER, SESSION_ACL, IS_BOOTSTRAP_ACCOUNT } from '~/store/user';
function flattenMeta(acc, meta) {
  return { ...acc, ...meta };
}

export default async function authMiddleware(nuxtContext) {
  const { store, redirect, route } = nuxtContext;
  const userSessionInfo = store.getters[`${USER}/${SESSION_ACL}`];
  const meta = route.meta.reduce(flattenMeta, {});
  const authorizations = pageAcl.getAuthorizations(meta.acl);
  if (authorizations.notConnected && userSessionInfo.isConnected) {
    if (userSessionInfo.isUser) return redirect('/');
    if (userSessionInfo.isGroupAdmin) return redirect('/');
    if (store.getters[`${USER}/${IS_BOOTSTRAP_ACCOUNT}`]) {
      return redirect('/groups');
    }
    if (userSessionInfo.isAdmin) return redirect('/');
  }

  if (
    (authorizations.groupAdmin && userSessionInfo.isGroupAdmin) ||
    (authorizations.groupAdminTech && userSessionInfo.isGroupAdminTech) ||
    (authorizations.admin && userSessionInfo.isAdmin) ||
    (authorizations.user && userSessionInfo.isConnected) ||
    (authorizations.notConnected && !userSessionInfo.isConnected)
  ) {
    return;
  }

  return redirect('/account/login');
}
