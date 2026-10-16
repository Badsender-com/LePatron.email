<script>
import { mapGetters } from 'vuex';
import { CAN, SELECTED_GROUP, SELECT_GROUP, USER } from '~/store/user';
import { SET_COLLAPSED } from '~/store/sidebar';
import { FOLDER, FETCH_WORKSPACES } from '~/store/folder';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as apiRoutes from '~/helpers/api-routes';
import { routeAfterGroupSwitch } from '~/helpers/route-after-group-switch';
import { CAPABILITIES } from '../../../shared/access/roles.js';

// The group selector of a super admin (ADR 0002, amended): one selected group,
// kept by the server, shared by the modules and the settings. Collapsed, the
// sidebar shows the group's initials, so the group in use is never hidden.
export default {
  name: 'BsSidebarCompanySwitcher',
  props: {
    collapsed: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      companies: [],
      loading: false,
      // Bumped to redraw the input on the selected group after a refusal.
      inputKey: 0,
    };
  },
  computed: {
    ...mapGetters(USER, { can: CAN, selectedGroup: SELECTED_GROUP }),

    // Whoever manages the platform works in a group it selects.
    canManagePlatform() {
      return this.can(CAPABILITIES.PLATFORM_MANAGE);
    },

    currentGroupId() {
      return this.selectedGroup ? this.selectedGroup.id : null;
    },

    options() {
      return this.companies.map((c) => ({
        label: c.name,
        value: c.id || c._id,
      }));
    },

    initials() {
      const name = (this.selectedGroup && this.selectedGroup.name) || '';
      return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0].toUpperCase())
        .join('');
    },
  },
  watch: {
    canManagePlatform: {
      immediate: true,
      handler(value) {
        if (value && this.companies.length === 0) {
          this.fetchCompanies();
        }
      },
    },
  },
  methods: {
    async fetchCompanies() {
      this.loading = true;
      try {
        const response = await this.$axios.$get(apiRoutes.groups());
        const list = Array.isArray(response) ? response : response?.items || [];
        this.companies = list;
      } catch (error) {
        console.error('[Sidebar] Failed to load companies:', error);
        this.companies = [];
      } finally {
        this.loading = false;
      }
    },
    async onChange(companyId) {
      if (!companyId || companyId === this.currentGroupId) return;
      try {
        await this.$store.dispatch(`${USER}/${SELECT_GROUP}`, companyId);
      } catch (error) {
        this.inputKey += 1;
        this.$store.commit(`${PAGE}/${SHOW_SNACKBAR}`, {
          text: this.$t('settingsNav.selectionFailed'),
          color: 'error',
        });
        return;
      }
      const next = routeAfterGroupSwitch(this.$route.fullPath, companyId);
      // The workspace tree of the new group first: landing on Email Builder
      // with the previous group's tree would reopen one of its workspaces,
      // and select that group again.
      if (next === '/mailings') {
        await this.$store.dispatch(`${FOLDER}/${FETCH_WORKSPACES}`);
      }
      // The module pages reload their data when the selected group changes.
      if (next !== this.$route.fullPath) await this.$router.push(next);
    },
    expand() {
      this.$store.commit(`sidebar/${SET_COLLAPSED}`, false);
    },
  },
};
</script>

<template>
  <div v-if="canManagePlatform" class="bs-sidebar-company-switcher">
    <v-tooltip v-if="collapsed" right>
      <template #activator="{ on }">
        <button
          class="bs-sidebar-company-switcher__badge"
          :aria-label="
            $t('settingsNav.selectedGroup', {
              name: selectedGroup ? selectedGroup.name : '',
            })
          "
          v-on="on"
          @click="expand"
        >
          {{ initials || '?' }}
        </button>
      </template>
      <span>{{ selectedGroup ? selectedGroup.name : '' }}</span>
    </v-tooltip>
    <v-autocomplete
      v-else
      :key="inputKey"
      :value="currentGroupId"
      :items="options"
      :placeholder="$t('settingsNav.switchCompany')"
      :loading="loading"
      item-text="label"
      item-value="value"
      dense
      solo
      flat
      hide-details
      prepend-inner-icon="mdi-domain"
      class="bs-sidebar-company-switcher__select"
      @change="onChange"
    />
  </div>
</template>

<style lang="scss" scoped>
.bs-sidebar-company-switcher {
  padding: 8px 12px;
  border-top: 1px solid #e0e0e0;
}

.bs-sidebar-company-switcher__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin: 0 auto;
  border: none;
  border-radius: 50%;
  background: rgba(0, 172, 220, 0.1);
  color: var(--v-primary-base, #093040);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.bs-sidebar-company-switcher__badge:hover {
  background: rgba(0, 172, 220, 0.2);
}

.bs-sidebar-company-switcher__select ::v-deep .v-input__slot {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  background: #fff !important;
  min-height: 32px !important;
  padding: 0 8px !important;
}

.bs-sidebar-company-switcher__select ::v-deep input {
  font-size: 13px;
}

.bs-sidebar-company-switcher__select ::v-deep .v-input__prepend-inner {
  margin-top: 6px;
  margin-right: 4px;
}

.bs-sidebar-company-switcher__select ::v-deep .v-icon {
  font-size: 18px;
  color: rgba(0, 0, 0, 0.54);
}
</style>
