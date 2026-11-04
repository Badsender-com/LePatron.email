// The rules of the import modal of the skills export (ADR 0018), apart from
// the modal so they are tested on their own: the project mounts no component
// in its tests.

const IMPORTABLE = ['new', 'update'];

// One key per item of the file: an expertise and a skill may share an id.
export const keyOf = (item) => `${item.kind}:${item.id}`;

// Only a new item or an update can be imported; an item up to date has
// nothing to bring, a blocked one says why.
export function isSelectable(item) {
  return IMPORTABLE.includes(item.state);
}

// Checked at first: everything that can be imported.
export function defaultSelection(items) {
  return items.filter(isSelectable).map(keyOf);
}

// The selection, as the import route takes it.
export function importPayload(keys) {
  const idsOf = (kind) =>
    keys
      .filter((key) => key.startsWith(`${kind}:`))
      .map((key) => key.slice(kind.length + 1));
  return { expertiseIds: idsOf('expertise'), skillIds: idsOf('skill') };
}

// How many items each outcome of the import holds.
export function reportCounts(report) {
  return ['created', 'updated', 'skipped', 'failed'].reduce(
    (counts, outcome) => ({
      ...counts,
      [outcome]: (report[outcome] || []).length,
    }),
    {}
  );
}

// The drafts the import wrote, each linked to its page in the back office,
// where a person publishes it.
export function draftLinks(report) {
  return [...(report.created || []), ...(report.updated || [])].map(
    ({ kind, id, version }) => ({
      id,
      version,
      to: kind === 'skill' ? `/ai-skills/${id}` : `/ai-expertise/${id}`,
    })
  );
}
