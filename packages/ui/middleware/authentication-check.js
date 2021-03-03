import * as pageAcl from '~/helpers/pages-acls.js';
import { USER, SESSION_ACL } from '~/store/user';
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
    if (userSessionInfo.isAdmin) return redirect('/');
  }

  if (authorizations.user && !userSessionInfo.isConnected) {
    return redirect('/account/login');
  }

  if (
    authorizations.groupAdmin &&
    !authorizations.admin &&
    !userSessionInfo.isGroupAdmin
  ) {
    return redirect('/account/login');
  }

  if (
    authorizations.admin &&
    !authorizations.groupAdmin &&
    !userSessionInfo.isAdmin
  ) {
    return redirect('/account/admin');
  }

  if (
    authorizations.admin &&
    authorizations.groupAdmin &&
    !userSessionInfo.isAdmin &&
    !userSessionInfo.isGroupAdmin
  ) {
    return redirect('/account/admin');
  }
}
