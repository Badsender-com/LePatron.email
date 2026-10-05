// The refusals of the super admin guardrails (ADR 0002) each carry their own
// error code, sent back as the `message` of the API error. The screens show
// the matching translation instead of the generic "an error occurred".

const SUPER_ADMIN_ERROR_CODES = [
  'FORBIDDEN_SUPER_ADMIN_ROLE_CHANGE',
  'FORBIDDEN_SUPER_ADMIN_MANAGEMENT',
  'FORBIDDEN_SUPER_ADMIN_SELF_DEMOTION',
  'FORBIDDEN_SUPER_ADMIN_SELF_DEACTIVATION',
  'LAST_SUPER_ADMIN_PROTECTED',
  'SUPER_ADMIN_OUTSIDE_PLATFORM_GROUP',
  'PLATFORM_GROUP_NOT_FOUND',
  'PLATFORM_GROUP_HAS_SUPER_ADMINS',
  'INVALID_ROLE_PARAM',
];

/**
 * @param {Error} error an axios error
 * @returns {string|null} the i18n key of the refusal, or null when the error
 *   is not one of the super admin guardrails
 */
export function superAdminErrorKey(error) {
  const code = error?.response?.data?.message;
  return SUPER_ADMIN_ERROR_CODES.includes(code)
    ? `superAdmins.errors.${code}`
    : null;
}
