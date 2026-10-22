// The location of an email, as the search across workspaces answers it
// (ADR 0007): `{ workspace, folder?, subfolder? }`, each `{ id, name }`.

/**
 * @param {Object} location
 * @returns {string} the path from the workspace down: `Espace › Dossier`
 */
export function locationPath({ workspace, folder, subfolder } = {}) {
  return [workspace, folder, subfolder]
    .filter(Boolean)
    .map(({ name }) => name)
    .join(' › ');
}

/**
 * @param {Object} location
 * @returns {Object|null} the route of its listing, in the current folder
 *   scope; none for a row that has no location (one of the folder listing,
 *   shown for an instant while the scope switches)
 */
export function locationRoute({ workspace, folder, subfolder } = {}) {
  if (!workspace) return null;
  const place = subfolder || folder;
  return {
    path: '/mailings',
    query: place ? { fid: place.id } : { wid: workspace.id },
  };
}
