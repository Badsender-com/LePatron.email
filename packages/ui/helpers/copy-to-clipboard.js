// Copy text to the clipboard, with a fallback.
//
// `navigator.clipboard` needs a secure context (HTTPS or localhost), so on a
// plain-HTTP staging host it is simply absent — hence the hidden-textarea +
// execCommand path, which still works there. Returns whether the copy
// succeeded so callers can tell the user rather than fail silently.
export default async function copyToClipboard(text) {
  if (!text) return false;

  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    window.isSecureContext
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Permission denied or unavailable — fall through to the legacy path.
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // readonly keeps the mobile keyboard away; the off-screen fixed position
    // avoids the scroll jump a plain appended textarea would cause.
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch (err) {
    return false;
  }
}
