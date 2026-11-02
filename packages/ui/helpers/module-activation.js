// Centralized helpers for the "module activation" rules. The same checks
// used to live inline in BsSidebar (per-module via SIDEBAR_MODULES) AND in
// BsSidebarSettingsList (hardcoded on enableEmailBuilder). Two implementations
// of the same business rule drift the moment someone tweaks one and forgets
// the other.

/**
 * @param {{ id?: string, enabledFlag?: string }} module A row from SIDEBAR_MODULES.
 * @param {{ canManagePlatform?: boolean }} user
 * @param {Object} group The user's group document (or {} if not loaded yet).
 * @returns {boolean} true when the module should be rendered as locked.
 *
 * Rules:
 * - Modules without `enabledFlag` are always unlocked (free for everyone).
 * - Otherwise: locked iff the flag is explicitly falsy on the group.
 * - A super admin sees the modules of its selected group as the group's users
 *   do (ADR 0002, amended): the caller passes that group. The lock is part of
 *   the view; the server never refuses a super admin for a module flag.
 */
export function isModuleLocked(module, user, group) {
  if (!module || !module.enabledFlag) return false;
  return !group || !group[module.enabledFlag];
}

/**
 * Convenience wrapper for callers that only need to ask "is module X enabled?"
 * by id. Falls back to true when the module id is unknown so the caller
 * doesn't have to guard against typos.
 *
 * @param {string} flag Name of the boolean flag on the group document
 *   (e.g. 'enableEmailBuilder', 'enableCrmIntelligence').
 * @param {{ canManagePlatform?: boolean }} user
 * @param {Object} group
 */
export function isFlagEnabled(flag, user, group) {
  if (user && user.canManagePlatform) return true;
  if (!group) return false;
  // Treat an undefined flag as enabled — same forgiving semantics as
  // guardEmailBuilder.js server-side: legacy groups predating the flag
  // shouldn't be locked out.
  return group[flag] !== false;
}
