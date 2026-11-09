import { mapGetters, mapMutations } from 'vuex';
import cloneDeep from 'lodash/cloneDeep';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { CAN, GROUP_CHANGED, USER } from '~/store/user.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { changedGroupFields } from '~/helpers/group-changes.js';
import { CAPABILITIES } from '../../../shared/access/roles.js';

// What the server lets a company admin change in its own company.
const COMPANY_ADMIN_FIELDS = ['name', 'colorScheme'];

/**
 * What a save of the company's settings sends: the fields changed on the page
 * since it was loaded, and only those (changedGroupFields). Whoever does not
 * manage the platform sends its company's name and colours at most, the
 * fields the server lets it change.
 *
 * @param {Object} group the edited company
 * @param {Object} loaded the company as the page loaded or last saved it
 * @param {Object} options
 * @param {boolean} options.canManagePlatform
 * @param {string[]} [options.fields] the fields the page edits, all if left out
 * @returns {Object} the changed fields, `{}` when nothing changed
 */
export function groupSettingsPayload(
  group,
  loaded,
  { canManagePlatform, fields }
) {
  const allowed = canManagePlatform
    ? fields
    : (fields || COMPANY_ADMIN_FIELDS).filter((key) =>
        COMPANY_ADMIN_FIELDS.includes(key)
      );
  return changedGroupFields(group, loaded, allowed);
}

/**
 * The save of a company settings page (general, colours): `group` and
 * `loading`, the group badge in the header, and `updateGroup`, which sends
 * the fields changed since the page was loaded.
 *
 * Usage, next to `mixinSettingsTitle`, with the page's own `asyncData`; a page
 * that edits some fields only names them, so it never sends the others:
 * ```
 * mixins: [mixinSettingsTitle, mixinGroupSettingsSave],
 * groupSettingsFields: ['colorScheme'],
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
  created() {
    // What the changes are measured against: the group as `asyncData` loaded
    // it, a copy, since the form edits the group in place.
    this.loadedGroup = cloneDeep(this.group);
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async updateGroup() {
      const {
        $axios,
        $route: { params },
      } = this;
      const changes = groupSettingsPayload(this.group, this.loadedGroup, {
        canManagePlatform: this.canManagePlatform,
        fields: this.$options.groupSettingsFields,
      });
      // Nothing changed: the company is already as the page shows it.
      if (Object.keys(changes).length === 0) {
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });
        return;
      }
      try {
        this.loading = true;
        const saved = await $axios.$put(apiRoutes.groupsItem(params), changes);
        this.group = saved;
        this.loadedGroup = cloneDeep(saved);
        // The MCP module decides the sidebar's connected applications link.
        if ('enableMcpModule' in changes) {
          this.$store.dispatch(`${USER}/${GROUP_CHANGED}`, {
            group: { id: params.groupId },
            changes: { enableMcpModule: saved.enableMcpModule },
          });
        }
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
