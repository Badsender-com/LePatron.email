import { mapGetters } from 'vuex';
import { PAGE, SET_PAGE_TITLE } from '~/store/page.js';
import { CAN, USER } from '~/store/user.js';
import { CAPABILITIES } from '../../../shared/access/roles.js';

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
    ...mapGetters(USER, { mixinCan: CAN }),
    // Whoever manages the platform works in a group it names in the title.
    mixinCanManagePlatform() {
      return this.mixinCan(CAPABILITIES.PLATFORM_MANAGE);
    },
    settingsTitle() {
      const settingsLabel = this.$t('modules.settings');
      if (this.mixinCanManagePlatform && this.group?.name) {
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
    mixinCanManagePlatform: {
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
