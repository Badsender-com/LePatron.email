import { USER, IS_ADMIN, SELECT_GROUP } from '~/store/user';
import { getFolder, getWorkspace } from '~/helpers/api-routes.js';

// A page of a group's resource selects that group for a super admin, or the
// bootstrap account: the resource wins over the selection (ADR 0002,
// amended). Awaited here, before the page loads its data, so the first
// server-rendered page already shows the right group:
// - `/groups/:groupId/…` names its group;
// - `/mailings?wid=…` or `?fid=…` names a workspace or folder, which answers
//   its group.
async function groupOfRoute({ route, $axios }) {
  if (route.params.groupId) return route.params.groupId;
  if (!route.path.startsWith('/mailings')) return null;
  const { wid, fid } = route.query;
  if (wid) return (await $axios.$get(getWorkspace(wid)))._company;
  if (fid) return (await $axios.$get(getFolder(fid)))._company;
  return null;
}

export default async function selectRouteGroup(nuxtContext) {
  const { store } = nuxtContext;
  if (!store.getters[`${USER}/${IS_ADMIN}`]) return;
  try {
    const groupId = await groupOfRoute(nuxtContext);
    if (groupId)
      await store.dispatch(`${USER}/${SELECT_GROUP}`, String(groupId));
  } catch (error) {
    // The page answers for an unknown or unreachable location itself; the
    // selection only stays where it was.
  }
}
