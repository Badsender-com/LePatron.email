import { aiSkillsExport } from '~/helpers/ai-skill-routes.js';
import { skillErrorMessage } from '~/helpers/ai-skill-errors.js';
import { STATUSES } from '../../shared/ai-skill/constants.js';

// The name the server gives the file, from its Content-Disposition.
export function fileNameOf(disposition, fallback = 'lepatron-skills.json') {
  const match = /filename="([^"]+)"/.exec(disposition || '');
  return match ? match[1] : fallback;
}

// The text of a blob, read the way every browser and jsdom can.
function textOf(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

// The file is asked for as a blob, and so is an error's body: read back, it
// gives the error its `message`, as any other answer of the server does.
async function withBodyRead(err) {
  const data = err && err.response && err.response.data;
  if (!(data instanceof Blob)) return err;
  try {
    err.response.data = JSON.parse(await textOf(data));
  } catch (readError) {
    err.response.data = {};
  }
  return err;
}

/**
 * Why an export failed, in the user's language: the reason the server gave
 * when there is one, translated when it is a known code.
 *
 * @param {Object} vm the component, for `$t`
 * @param {Error} err what `downloadSkillsExport` threw
 * @returns {string}
 */
export function exportFailureMessage(vm, err) {
  const data = (err && err.response && err.response.data) || {};
  if (!data.message) return vm.$t('aiSkills.export.failed');
  return vm.$t('aiSkills.export.failedBecause', {
    reason: skillErrorMessage(vm, err),
  });
}

/**
 * Downloads the skills export of a selection, or of everything (ADR 0018).
 *
 * @param {Object} $axios the app's axios
 * @param {Object} selection `skillIds`, `expertiseIds`, `withoutExpertiseIds`
 *   or `all`
 */
export async function downloadSkillsExport($axios, selection) {
  let response;
  try {
    response = await $axios.post(aiSkillsExport(), selection, {
      responseType: 'blob',
    });
  } catch (err) {
    throw await withBodyRead(err);
  }
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
