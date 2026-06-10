// Escape user-controlled values before interpolating them into an i18n template
// that is then rendered with v-html. Without this, user-controlled fields such as
// mailing/folder/workspace/group/profile names rendered inside `v-html="$t(..., { name })"`
// allow stored XSS, because vue-i18n does not escape interpolated values.
//
// Use it everywhere a user-controlled string is injected into a v-html-rendered
// translation key. Locale strings keep their legitimate HTML (<strong>, <br/>).
export function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
