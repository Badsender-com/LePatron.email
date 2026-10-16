import { getters, USER } from '~/store/user.js';
import {
  ALL_CAPABILITIES,
  capabilitiesOfRole,
} from '../../../packages/shared/access/roles.js';

/**
 * The user store's getters for `info`, each resolved from the others as Vuex
 * does.
 *
 * @param {Object|null} info the user as the server sends it
 * @returns {Object} the getters by name
 */
export function userGettersOf(info) {
  const state = { info };
  const resolved = {};
  Object.keys(getters).forEach((name) => {
    Object.defineProperty(resolved, name, {
      get: () => getters[name](state, resolved),
    });
  });
  return resolved;
}

/**
 * A Nuxt store holding `info` in its user module, as the middlewares read it.
 *
 * @param {Object|null} info
 * @returns {{ getters: Object }}
 */
export function storeOf(info) {
  const user = userGettersOf(info);
  const namespaced = {};
  Object.keys(getters).forEach((name) => {
    Object.defineProperty(namespaced, `${USER}/${name}`, {
      get: () => user[name],
    });
  });
  return { getters: namespaced };
}

// A signed-in account of `role`, as the server sends it: the role's
// capabilities (packages/shared/access/roles.js).
export const userOfRole = (role, extra = {}) => ({
  id: `${role}-id`,
  role,
  capabilities: capabilitiesOfRole(role),
  ...extra,
});

// The account defined by the deployment configuration: no role, every
// capability (account/auth.guard.js on the server).
export const bootstrapAccount = (extra = {}) => ({
  id: 'admin-id',
  name: 'admin',
  isAdmin: true,
  capabilities: ALL_CAPABILITIES,
  ...extra,
});
