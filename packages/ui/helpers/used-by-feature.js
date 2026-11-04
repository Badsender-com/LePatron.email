// "Used by a feature" in the back office (ADR 0019): the server works it out
// from the features' declarations and sends it as `usedBy`. The rules the
// lists and the detail pages read live here, so they are tested on their own:
// the project mounts no component in its tests.

// The features that use a skill or an expertise, as the server sent them.
export function usedByOf(item) {
  return item && Array.isArray(item.usedBy) ? item.usedBy : [];
}

export function isUsedByFeature(item) {
  return usedByOf(item).length > 0;
}

// The list filter: everything when it is off, only what a feature uses when
// it is on.
export function filterUsedByFeature(items, onlyUsed) {
  const list = Array.isArray(items) ? items : [];
  return onlyUsed ? list.filter(isUsedByFeature) : list;
}
