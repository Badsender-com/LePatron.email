import { SET_LAST_GROUP_ID } from '~/store/sidebar';

const STORAGE_KEY = 'lepatron_last_group_id';

/**
 * Client-only: restore the last selected company (groupId) from localStorage
 * into the sidebar store on app init. The store's state() runs server-side
 * under SSR (no localStorage), so restoration must happen here, after
 * hydration — otherwise a reload of an admin-global page (/ai-skills, …) loses
 * the company and its admin menu.
 */
export default ({ store }) => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) store.commit(`sidebar/${SET_LAST_GROUP_ID}`, stored);
  } catch (e) {
    // localStorage unavailable (private mode, etc.) — nothing to restore.
  }
};
