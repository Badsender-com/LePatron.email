'use strict';

/**
 * The right-hand place of the editor (ADR 0004).
 *
 * Comments, quality control and the AI panel help improve an email without
 * being part of designing it: they take turns at the same place, one open at
 * a time. This module is the one state that says which — instead of a flag per
 * panel kept apart by subscriptions on each other — and the one binding that
 * gives each panel the same shell behaviours.
 */

const PANELS = ['comments', 'quality', 'ai'];

/**
 * @param {Object} ko knockout
 * @returns {{
 *   open: Function, anyOpen: Function, isOpen: Function,
 *   show: Function, hide: Function, toggle: Function, flag: Function
 * }}
 */
function createRightPanel(ko) {
  const open = ko.observable(null);
  const flags = {};

  const assertKnown = (name) => {
    if (!PANELS.includes(name)) {
      throw new Error(`Unknown right panel "${name}"`);
    }
  };

  const panel = {
    // The name of the open panel, or null.
    open,
    // Whether any right panel is open: the canvas and the comments rail make
    // room for whichever it is.
    anyOpen: ko.pureComputed(() => open() !== null),
    isOpen: (name) => open() === name,
    show(name) {
      assertKnown(name);
      open(name);
    },
    hide() {
      open(null);
    },
    toggle(name) {
      assertKnown(name);
      open(open() === name ? null : name);
    },
    /**
     * A boolean view of one panel, for the templates and code that used to own
     * a flag of their own (`showComments`, `showQuality`). Writing true opens
     * it; writing false closes it only if it is the open one.
     */
    flag(name) {
      assertKnown(name);
      if (!flags[name]) {
        flags[name] = ko.pureComputed({
          read: () => open() === name,
          write: (isOpen) => {
            if (isOpen) open(name);
            else if (open() === name) open(null);
          },
        });
      }
      return flags[name];
    },
  };
  return panel;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * `data-bind="rightPanel: 'quality'"` on a panel's container: shown when its
 * panel is the open one, `inert` otherwise; Escape closes it; opening moves the
 * focus inside it, closing gives it back to the button that controls it
 * (`aria-controls`).
 */
function registerRightPanelBinding(ko) {
  if (ko.bindingHandlers.rightPanel) return;
  ko.bindingHandlers.rightPanel = {
    init(element, valueAccessor, allBindings, viewModel, bindingContext) {
      const name = ko.unwrap(valueAccessor());
      const panel = bindingContext.$root.rightPanel;

      const onKeydown = (event) => {
        if (event.key === 'Escape' && panel.isOpen(name)) {
          event.stopPropagation();
          panel.hide();
        }
      };
      element.addEventListener('keydown', onKeydown);

      const sync = ko.computed(() => {
        const isOpen = panel.isOpen(name);
        element.classList.toggle('hidden', !isOpen);
        if (isOpen) element.removeAttribute('inert');
        else element.setAttribute('inert', '');
        return isOpen;
      });

      const focusSub = sync.subscribe((isOpen) => {
        if (isOpen) {
          // After the panel's own content has rendered.
          setTimeout(() => {
            const first = element.querySelector(FOCUSABLE);
            if (first) first.focus();
          }, 0);
          return;
        }
        if (element.contains(document.activeElement) && element.id) {
          const toggle = document.querySelector(
            `[aria-controls="${element.id}"]`
          );
          if (toggle) toggle.focus();
        }
      });

      ko.utils.domNodeDisposal.addDisposeCallback(element, () => {
        element.removeEventListener('keydown', onKeydown);
        focusSub.dispose();
        sync.dispose();
      });
    },
  };
}

/**
 * The editor's right panel, created by whichever panel installs first. Each
 * panel then binds its own flag to it.
 */
function installRightPanel(viewModel, ko) {
  if (!viewModel.rightPanel) {
    viewModel.rightPanel = createRightPanel(ko);
    registerRightPanelBinding(ko);
  }
  return viewModel.rightPanel;
}

module.exports = {
  createRightPanel,
  installRightPanel,
  registerRightPanelBinding,
  PANELS,
};
