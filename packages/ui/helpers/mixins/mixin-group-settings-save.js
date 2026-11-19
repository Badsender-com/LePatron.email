import { mapGetters } from 'vuex';
import { CAN, USER } from '~/store/user.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { CAPABILITIES } from '../../../shared/access/roles.js';
import mixinInlineOutcome from '~/helpers/mixins/mixin-inline-outcome.js';

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
 * `loading`, the group badge in the header, and `updateGroup`. The outcome is
 * read on the page (`outcome`, `outcomeDetail`: see `mixinInlineOutcome`), at
 * the foot of the form, never in a toast.
 *
 * Usage, next to `mixinSettingsTitle`, with the page's own `asyncData`:
 * ```
 * mixins: [mixinSettingsTitle, mixinGroupSettingsSave],
 * ```
 */
export default {
  mixins: [mixinInlineOutcome],
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
        this.markSaved();
      } catch (error) {
        const errorCode = error?.response?.data?.message;
        this.markFailed(
          errorCode && this.$te(`global.errors.${errorCode}`)
            ? this.$t(`global.errors.${errorCode}`)
            : ''
        );
      } finally {
        this.loading = false;
      }
    },
  },
};
