import * as pageAcl from '~/helpers/pages-acls.js';
import { USER, IS_CONNECTED, CAN, IS_BOOTSTRAP_ACCOUNT } from '~/store/user';

function flattenMeta(acc, meta) {
  return { ...acc, ...meta };
}

export default async function authMiddleware(nuxtContext) {
  const { store, redirect, route } = nuxtContext;
  const isConnected = store.getters[`${USER}/${IS_CONNECTED}`];
  const can = store.getters[`${USER}/${CAN}`];
  const meta = route.meta.reduce(flattenMeta, {});

  // A signed-in user has nothing to do on the sign-in pages: the bootstrap
  // account goes to the settings, anyone else home.
  if (pageAcl.isNoSessionPage(meta.acl) && isConnected) {
    if (store.getters[`${USER}/${IS_BOOTSTRAP_ACCOUNT}`]) {
      return redirect('/groups');
    }
    return redirect('/');
  }

  if (pageAcl.isPageGranted(meta.acl, { isConnected, can })) return;

  return redirect('/account/login');
}
