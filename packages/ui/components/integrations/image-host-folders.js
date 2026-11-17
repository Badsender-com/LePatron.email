/**
 * The folders of an image host account as select options, each labelled with
 * its path so that two "Emails" folders under different parents stay apart.
 *
 * @param {Array<{ id: number, parent: number, name: string }>} folders
 * @returns {Array<{ value: number, text: string }>} sorted by path
 */
export function folderOptions(folders) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));

  function pathOf(folder) {
    const names = [];
    const seen = new Set();
    let current = folder;
    // `seen` stops a loop an inconsistent answer would make endless.
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(current.name);
      current = byId.get(current.parent);
    }
    return names.join(' / ');
  }

  return folders
    .map((folder) => ({ value: folder.id, text: pathOf(folder) }))
    .sort((a, b) => a.text.localeCompare(b.text));
}
