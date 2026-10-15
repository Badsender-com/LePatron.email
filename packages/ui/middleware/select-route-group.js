import { USER, IS_ADMIN, SELECT_GROUP } from '~/store/user';

// A page of a group (`/groups/:groupId/…`) selects that group for a super
// admin, or the bootstrap account: the resource wins over the selection
// (ADR 0002, amended). Awaited here, before the page renders, so the first
// server-rendered page already shows the right group.
export default async function selectRouteGroup({ store, route }) {
  const { groupId } = route.params;
  if (!groupId || !store.getters[`${USER}/${IS_ADMIN}`]) return;
  try {
    await store.dispatch(`${USER}/${SELECT_GROUP}`, groupId);
  } catch (error) {
    // The page answers for an unknown group itself; a refused selection only
    // leaves the previous one in place.
  }
}
