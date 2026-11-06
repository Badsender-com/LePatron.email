import { aiSkillsExport } from '~/helpers/ai-skill-routes.js';
import { STATUSES } from '../../shared/ai-skill/constants.js';

// The name the server gives the file, from its Content-Disposition.
export function fileNameOf(disposition, fallback = 'lepatron-skills.json') {
  const match = /filename="([^"]+)"/.exec(disposition || '');
  return match ? match[1] : fallback;
}

/**
 * Downloads the skills export of a selection, or of everything (ADR 0018).
 *
 * @param {Object} $axios the app's axios
 * @param {Object} selection `skillIds`, `expertiseIds`, `withoutExpertiseIds`
 *   or `all`
 */
export async function downloadSkillsExport($axios, selection) {
  const response = await $axios.post(aiSkillsExport(), selection, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute(
    'download',
    fileNameOf(response.headers['content-disposition'])
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// What can be exported: an item with an active version, never archived.
export function isExportable(item) {
  return (
    item.status !== STATUSES.ARCHIVED &&
    Boolean(item.activeVersion) &&
    item.activeVersion.major != null
  );
}
