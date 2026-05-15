<script>
import { mapGetters } from 'vuex';
import { IS_ADMIN, USER } from '~/store/user';
import * as apiRoutes from '~/helpers/api-routes';
import { SET_LAST_GROUP_ID } from '~/store/sidebar';

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
    };
  },
  computed: {
    ...mapGetters(USER, { isAdmin: IS_ADMIN }),
    ...mapGetters('sidebar', { lastGroupId: 'lastGroupId' }),

    currentGroupId() {
      return this.$route.params.groupId || this.lastGroupId || null;
    },

    options() {
      return this.companies.map((c) => ({
        label: c.name,
        value: c.id || c._id,
      }));
    },

    visible() {
      return this.isAdmin && !this.collapsed;
    },
  },
  watch: {
    isAdmin: {
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
    onChange(companyId) {
      if (!companyId || companyId === this.currentGroupId) return;
      this.$store.commit(`sidebar/${SET_LAST_GROUP_ID}`, companyId);
      this.$router.push(`/groups/${companyId}/settings/general`);
    },
  },
};
</script>

<template>
  <div v-if="visible" class="bs-sidebar-company-switcher">
    <v-autocomplete
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
