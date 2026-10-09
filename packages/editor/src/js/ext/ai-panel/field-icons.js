'use strict';

/**
 * The AI icons on the fields an AI action fills (ADR 0004).
 *
 * Where each field's icon goes is its target's (ext/ai-panel/targets.js); this
 * places them, right after the field's label.
 *
 * Both sections re-render (Vue, Knockout), so this is called again on every
 * change: it places what is missing and never doubles an icon.
 */

const { FIELD_TARGETS } = require('./targets');

const ATTRIBUTE = 'data-ai-target';

function createIcon(kind, { onOpen, label, anchor }) {
  const icon = document.createElement('button');
  icon.type = 'button';
  icon.className = 'ai-field-icon';
  icon.setAttribute(ATTRIBUTE, kind);
  icon.setAttribute('aria-label', label);
  // A Mosaico property label already shows its own tooltip on hover.
  if (!anchor.closest('[title]')) icon.title = label;
  icon.innerHTML = '<span class="lucide lucide-bot" aria-hidden="true"></span>';
  icon.addEventListener('click', (event) => {
    // The preheader label sits in a property editor that selects on click.
    event.stopPropagation();
    onOpen({ kind });
  });
  return icon;
}

/**
 * @param {Element} root where the fields are looked for
 * @param {{
 *   actionsFor: function({ kind: string }): { actions: Array },
 *   onOpen: function({ kind: string }): void,
 *   labelFor?: function(string): string,
 * }} options
 */
function placeFieldIcons(
  root,
  { actionsFor, onOpen, labelFor = () => 'AI actions' }
) {
  Object.entries(FIELD_TARGETS).forEach(([kind, field]) => {
    const anchor = field.anchor(root);
    if (!anchor) return;
    const existing = anchor.querySelector(`[${ATTRIBUTE}="${kind}"]`);
    const offered = actionsFor({ kind }).actions.length > 0;
    if (!offered) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    const icon = createIcon(kind, { onOpen, label: labelFor(kind), anchor });
    // Right after the field's label, the same for both fields.
    const label = anchor.querySelector('label, span');
    if (label) label.after(icon);
    else anchor.appendChild(icon);
  });
}

module.exports = { placeFieldIcons };
