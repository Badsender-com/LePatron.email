// What a skill's page and an expertise's page do the same way on their item:
// a new minor or major version, deleting a draft, archiving, and telling an
// error. Each request answers the whole item, which replaces the page's.
//
// The page names the data key of its item, the field of its id, its routes
// and the snackbar of its archive; it has a `saving` flag and an
// `archiveModal` ref. A warning read before a dialog opens shows the page
// busy; when it cannot be read, the user is told and the change goes on.

import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import {
  skillErrorMessage,
  skillWarningMessage,
} from '~/helpers/ai-skill-errors.js';

/**
 * @param {Object} item
 * @param {string} item.key the data key of the item (`skill`, `exp`)
 * @param {string} item.idField its id (`skillId`, `expertiseId`)
 * @param {Object} item.routes `versionMinor(id)`, `versionMajor(id)`,
 *   `version(id, major, minor)` and `archive(id)`
 * @param {string} item.archivedKey the i18n key said once it is archived
 * @returns {Object} the mixin
 */
export default function mixinAiVersionedItem({
  key,
  idField,
  routes,
  archivedKey,
}) {
  return {
    methods: {
      ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
      handleError(err) {
        this.showSnackbar({
          text: skillErrorMessage(this, err),
          color: 'error',
        });
      },
      // A warning read before a dialog opens that could not be: the change
      // goes on without it, and the user is told so.
      tellWarningUnchecked() {
        this.showSnackbar({
          text: this.$t('aiSkills.warningUnchecked'),
          color: 'warning',
        });
      },
      // Saved, with what the save warns of, or the warning it could not
      // check before.
      tellSaved({ warnings = [], unchecked = false } = {}) {
        const notes = [
          ...(unchecked ? [this.$t('aiSkills.savedWarningUnchecked')] : []),
          ...warnings.map((warning) => skillWarningMessage(this, warning)),
        ];
        this.showSnackbar(
          notes.length
            ? { text: notes.join(' '), color: 'warning' }
            : { text: this.$t('global.savedSuccessfully'), color: 'success' }
        );
      },
      itemId() {
        return this[key][idField];
      },
      // Sends a request that answers the item, which then replaces it.
      // Returns whether it went through.
      async replaceItem(request, successKey) {
        this.saving = true;
        try {
          this[key] = await request();
          if (successKey) {
            this.showSnackbar({ text: this.$t(successKey), color: 'success' });
          }
          return true;
        } catch (err) {
          this.handleError(err);
          return false;
        } finally {
          this.saving = false;
        }
      },
      createMinorVersion() {
        return this.replaceItem(
          () => this.$axios.$post(routes.versionMinor(this.itemId())),
          'aiSkills.version.versionCreated'
        );
      },
      createMajorVersion(source) {
        const body = source
          ? {
              sourceMajor: source.versionMajor,
              sourceMinor: source.versionMinor,
            }
          : {};
        return this.replaceItem(
          () => this.$axios.$post(routes.versionMajor(this.itemId()), body),
          'aiSkills.version.versionCreated'
        );
      },
      deleteVersion(version) {
        if (!confirm(this.$t('aiSkills.version.deleteDraftConfirm'))) return;
        return this.replaceItem(() =>
          this.$axios.$delete(
            routes.version(
              this.itemId(),
              version.versionMajor,
              version.versionMinor
            )
          )
        );
      },
      async archive() {
        const done = await this.replaceItem(
          () => this.$axios.$post(routes.archive(this.itemId())),
          archivedKey
        );
        if (done) this.$refs.archiveModal.close();
      },
    },
  };
}
