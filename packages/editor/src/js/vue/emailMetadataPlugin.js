'use strict';

const Vue = require('vue/dist/vue.common');

const {
  toFormState,
  typologyOptions,
  SUBJECT_HARD_LIMIT,
} = require('../utils/email-metadata');
const {
  createEmailMetadataStore,
} = require('../utils/email-metadata-store');
const template = require('./components/email-metadata/email-metadata.template');

// The mounted Vue instance, kept so `dispose` can tear it down when the editor
// swaps templates (template-loader.js:623 calls the hook).
let app = null;
// The beforeunload guard, kept for the same reason: a listener left on `window`
// would outlive the section and warn about a form that is no longer on screen.
let unloadGuard = null;
// The store this plugin armed. The state itself lives on the viewModel; this is
// only a handle for teardown, because template-loader calls `dispose` with no
// arguments (`pluginsCall(plugins, 'dispose', undefined, true)`).
let activeStore = null;

/**
 * The email settings of the Content tab: subject, planned send date, typology.
 *
 * A group of fields, not a panel. The first implementation followed the comments
 * panel — a slidebar opened from the top bar — and that was the wrong precedent:
 * a comment is an annotation laid on the email, transient; metadata is a setting
 * of the document, persistent. The Content tab already holds exactly that family
 * of document-level properties in the template's own options, and brand and
 * language will join them later as variant axes. So the fields sit there, right
 * under those options, as the second half of one continuous panel.
 *
 * This file holds no save path at all. The editor's Save writes the metadata with
 * the rest of the email; the component only keeps utils/email-metadata-store.js
 * informed of what the user has typed, and ext/badsender-server-storage.js reads
 * the store when the user saves.
 *
 * The field decisions live in utils/email-metadata.js and the store: the editor
 * has no component test harness, so anything left in this file is untested.
 *
 * Styled by badsender-email-metadata.less rather than through `bs-form-field`:
 * that class is imported INSIDE badsender-modal.less, so it only exists under a
 * modal scope and reaches nothing here.
 */
module.exports = {
  viewModel(vm, ko) {
    // Presence of the config is what decides the section exists. An opted-out
    // company gets neither key from findOneForMosaico, so nothing is rendered.
    const config = (vm.metadata && vm.metadata.emailMetadataConfig) || null;
    vm.hasEmailMetadata = ko.observable(Boolean(config && config.enabled));

    // Hung off the viewModel like the three other plugins' state, rather than held
    // at module scope. Created unconditionally and left unarmed for an opted-out
    // company: the save command then finds a store that answers "not dirty", which
    // is the same path it took before this feature existed, without having to test
    // for the store's existence.
    vm.emailMetadataStore = createEmailMetadataStore();
  },

  init(vm) {
    const config = (vm.metadata && vm.metadata.emailMetadataConfig) || null;
    if (!config || !config.enabled) return;

    const store = vm.emailMetadataStore;
    activeStore = store;

    const values = (vm.metadata && vm.metadata.emailMetadata) || {};
    const initialForm = toFormState(values);

    // Arm the store BEFORE mounting: the save command may be built first, and an
    // unarmed store answers "not dirty", which is the correct answer until the
    // user has had a chance to type anything.
    store.reset(initialForm);

    Vue.component('EmailMetadataPlugin', {
      data: () => ({
        subject: initialForm.subject,
        plannedSendDate: initialForm.plannedSendDate,
        emailTypeId: initialForm.emailTypeId,
        emailTypes: config.emailTypes || [],
        subjectHardLimit: SUBJECT_HARD_LIMIT,
      }),

      computed: {
        typologyChoices() {
          return typologyOptions(
            this.emailTypes,
            this.emailTypeId,
            vm.t('email-metadata-typology-none'),
            vm.t('email-metadata-typology-missing')
          );
        },
        // Watched rather than pushed field by field: one watcher, and the store
        // receives a complete snapshot every time instead of three partial ones.
        formState() {
          return {
            subject: this.subject,
            plannedSendDate: this.plannedSendDate,
            emailTypeId: this.emailTypeId,
          };
        },
      },

      watch: {
        formState: {
          handler(state) {
            store.setCurrent(state);
          },
          deep: true,
        },
      },

      methods: {
        // The second argument matters: vm.t(key, params) interpolates __token__
        // placeholders, and dropping it would lose them without an error.
        t: (key, params) => vm.t(key, params),
      },

      template,
    });

    app = new Vue({ el: '#email-metadata-section' });

    // These three fields are the only plain form inputs in the editor, and a form
    // input is where a user expects their typing to survive. Everything else here
    // is written through a command; the subject someone types and then closes the
    // tab on is gone with nothing said.
    //
    // A prompt on the way out, not a permanent indicator: the unsaved-state dot was
    // removed on purpose because it covered the metadata and nothing else, and a
    // signal that stays dark for a modified block tells the user their work is
    // safe. This fires only when the metadata are actually dirty, and says nothing
    // the rest of the time.
    unloadGuard = function (event) {
      if (!store.isDirty()) return undefined;
      // Browsers ignore the string and show their own wording; both forms are
      // still required for the prompt to appear at all.
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', unloadGuard);
  },

  // Called by the template loader when the editor swaps templates. Without it the
  // Vue instance outlives its node and keeps a closure over a stale config — and
  // the store would keep answering for fields that are no longer on screen.
  dispose() {
    if (unloadGuard) {
      window.removeEventListener('beforeunload', unloadGuard);
      unloadGuard = null;
    }
    if (activeStore) {
      activeStore.dispose();
      activeStore = null;
    }
    if (app) {
      app.$destroy();
      app = null;
    }
  },
};
