import { mapGetters } from 'vuex';
import { PAGE, SET_PAGE_TITLE } from '~/store/page.js';
import { IS_ADMIN, USER } from '~/store/user.js';

/**
 * Mixin for settings pages that provides consistent title handling.
 *
 * Requirements:
 * - The component must have a `group` data property with a `name` field
 *
 * Provides:
 * - `settingsTitle` computed: "Paramètres > CompanyName" for super admin, "Paramètres" for group admin
 * - `title` computed: alias for settingsTitle (used by mixinPageTitle)
 * - Automatic topbar title update when group.name changes
 *
 * Usage:
 * ```
 * import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
 *
 * export default {
 *   mixins: [mixinSettingsTitle],
 *   // ...
 * }
 * ```
 */
export default {
  computed: {
    ...mapGetters(USER, {
      mixinIsAdmin: IS_ADMIN,
    }),
    settingsTitle() {
      const settingsLabel = this.$t('modules.settings');
      if (this.mixinIsAdmin && this.group?.name) {
        return `${settingsLabel} > ${this.group.name}`;
      }
      return settingsLabel;
    },
    // Alias for mixinPageTitle compatibility
    title() {
      return this.settingsTitle;
    },
  },
  watch: {
    'group.name': {
      immediate: true,
      handler() {
        this.updateSettingsTitle();
      },
    },
    mixinIsAdmin: {
      immediate: true,
      handler() {
        this.updateSettingsTitle();
      },
    },
  },
  mounted() {
    this.updateSettingsTitle();
  },
  destroyed() {
    this.$store.commit(`${PAGE}/${SET_PAGE_TITLE}`, '');
  },
  methods: {
    updateSettingsTitle() {
      this.$store.commit(`${PAGE}/${SET_PAGE_TITLE}`, this.settingsTitle);
    },
  },
};
