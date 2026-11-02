import { mapGetters, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { CAN, USER } from '~/store/user.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { CAPABILITIES } from '../../../shared/access/roles.js';

/**
 * What a save of the company's settings sends: whoever manages the platform
 * sends the whole company, a company admin its name and colours only, the
 * fields the server lets it change.
 *
 * @param {Object} group the edited company
 * @param {boolean} canManagePlatform
 * @returns {Object}
 */
export function groupSettingsPayload(group, canManagePlatform) {
  return canManagePlatform
    ? group
    : { name: group.name, colorScheme: group.colorScheme };
}

/**
 * The save of a company settings page (general, colours): `group` and
 * `loading`, the group badge in the header, and `updateGroup`.
 *
 * Usage, next to `mixinSettingsTitle`, with the page's own `asyncData`:
 * ```
 * mixins: [mixinSettingsTitle, mixinGroupSettingsSave],
 * ```
 */
export default {
  data() {
    return {
      group: {},
      loading: false,
    };
  },
  computed: {
    ...mapGetters(USER, { can: CAN }),
    canManagePlatform() {
      return this.can(CAPABILITIES.PLATFORM_MANAGE);
    },
    showGroupBadge() {
      return this.canManagePlatform && this.group.name;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async updateGroup() {
      const {
        $axios,
        $route: { params },
      } = this;
      try {
        this.loading = true;
        this.group = await $axios.$put(
          apiRoutes.groupsItem(params),
          groupSettingsPayload(this.group, this.canManagePlatform)
        );
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });
      } catch (error) {
        const errorCode = error?.response?.data?.message;
        this.showSnackbar({
          text:
            errorCode && this.$te(`global.errors.${errorCode}`)
              ? this.$t(`global.errors.${errorCode}`)
              : this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
