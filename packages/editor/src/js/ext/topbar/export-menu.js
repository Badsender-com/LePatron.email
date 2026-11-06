'use strict';

/**
 * The menu of « Exporter » in the top bar, when there are several ways out
 * (a ZIP, hosted images, an FTP or an ESP profile). A disclosure: the button
 * opens and closes it, Escape closes it and gives the focus back to the
 * button, the focus leaving it closes it, and so does a way out chosen. The
 * mouse also opens it on hover (badsender-topbar.less).
 *
 * @param {Object} ko - Knockout
 * @returns {{ open: Function, toggle: Function, close: Function,
 *   onKeydown: Function, onFocusout: Function }}
 */
function createExportMenu(ko) {
  const open = ko.observable(false);
  let trigger = null;

  return {
    open,
    toggle(data, event) {
      if (event && event.currentTarget) trigger = event.currentTarget;
      open(!open());
    },
    close() {
      open(false);
    },
    // Knockout handlers: true lets the event go on.
    onKeydown(data, event) {
      if (event.key !== 'Escape' || !open()) return true;
      open(false);
      if (trigger) trigger.focus();
      // The menu closes, not the panel or the dialog behind it.
      event.stopPropagation();
      return false;
    },
    onFocusout(data, event) {
      const menu = event.currentTarget;
      if (!event.relatedTarget || !menu.contains(event.relatedTarget)) {
        open(false);
      }
      return true;
    },
  };
}

module.exports = { createExportMenu };
