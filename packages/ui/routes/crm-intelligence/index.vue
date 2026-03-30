<script>
import { mapGetters, mapMutations, mapState } from 'vuex';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import {
  getCrmIntelligenceStatus,
  getCrmIntelligenceDashboards,
  getCrmIntelligenceEmbedUrl,
} from '~/helpers/api-routes.js';
import { ACL_USER } from '~/helpers/pages-acls.js';
import { IS_ADMIN, USER } from '~/store/user';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import MarketingPlaceholder from './__partials/marketing-placeholder.vue';
import DashboardList from './__partials/dashboard-list.vue';
import DashboardViewer from './__partials/dashboard-viewer.vue';

export default {
  name: 'PageCrmIntelligence',
  components: {
    MarketingPlaceholder,
    DashboardList,
    DashboardViewer,
  },
  mixins: [mixinPageTitle],
  meta: { acl: ACL_USER },
  middleware({ store, redirect }) {
    if (store.getters[`${USER}/${IS_ADMIN}`]) {
      redirect('/groups');
    }
  },
  async asyncData({ $axios, error }) {
    try {
      const status = await $axios.$get(getCrmIntelligenceStatus());
      let dashboards = [];

      if (status.enabled && status.configured) {
        dashboards = await $axios.$get(getCrmIntelligenceDashboards());
      }

      return {
        status,
        dashboards,
        selectedDashboard: null,
        embedUrl: null,
        loadingEmbed: false,
      };
    } catch (err) {
      console.error('[CrmIntelligence] Error fetching status:', err);
      return {
        status: { enabled: false, configured: false },
        dashboards: [],
        selectedDashboard: null,
        embedUrl: null,
        loadingEmbed: false,
      };
    }
  },
  data: () => ({
    status: { enabled: false, configured: false },
    dashboards: [],
    selectedDashboard: null,
    embedUrl: null,
    loadingEmbed: false,
  }),
  mounted() {
    // Auto-select first dashboard if available
    if (this.isEnabled && this.dashboards.length > 0 && !this.selectedDashboard) {
      this.selectDashboard(this.dashboards[0]);
    }
  },
  computed: {
    title() {
      return this.$t('crmIntelligence.title');
    },
    isEnabled() {
      return this.status.enabled && this.status.configured;
    },
    hasMultipleDashboards() {
      return this.dashboards.length > 1;
    },
    ...mapState(USER, {
      userInfo: 'info',
    }),
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
    }),
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    async selectDashboard(dashboard) {
      if (this.selectedDashboard?.id === dashboard.id) return;

      this.selectedDashboard = dashboard;
      this.loadingEmbed = true;
      this.embedUrl = null;

      try {
        const result = await this.$axios.$get(
          getCrmIntelligenceEmbedUrl(dashboard.id)
        );
        this.embedUrl = result.embedUrl;
      } catch (err) {
        console.error('[CrmIntelligence] Error fetching embed URL:', err);
        this.showSnackbar({
          text: this.$t('crmIntelligence.errors.embedFailed'),
          color: 'error',
        });
      } finally {
        this.loadingEmbed = false;
      }
    },
  },
};
</script>

<template>
  <!-- Single dashboard: full width, no module-specific sidebar -->
  <div
    v-if="isEnabled && !hasMultipleDashboards"
    class="crm-fullwidth"
  >
    <dashboard-viewer
      v-if="selectedDashboard"
      :embed-url="embedUrl"
      :loading="loadingEmbed"
      :dashboard-name="selectedDashboard.name"
    />
  </div>

  <!-- Multiple dashboards or other states: use sidebar layout -->
  <bs-layout-left-menu v-else>
    <template #menu>
      <!-- Enabled State with Multiple Dashboards -->
      <template v-if="isEnabled && hasMultipleDashboards">
        <dashboard-list
          :dashboards="dashboards"
          :selected="selectedDashboard"
          @select="selectDashboard"
        />
      </template>

      <!-- Marketing Placeholder for non-enabled groups -->
      <template v-else>
        <marketing-placeholder />
      </template>
    </template>

    <!-- Main Content Area -->
    <v-card flat tile class="fill-height">
      <!-- Dashboard Viewer (multiple dashboards case) -->
      <template v-if="isEnabled">
        <dashboard-viewer
          v-if="selectedDashboard"
          :embed-url="embedUrl"
          :loading="loadingEmbed"
          :dashboard-name="selectedDashboard.name"
        />
        <div
          v-else
          class="d-flex align-center justify-center fill-height grey lighten-4"
        >
          <v-card flat max-width="400" class="text-center pa-8 transparent">
            <v-icon size="64" color="grey">
              mdi-chart-bar
            </v-icon>
            <p class="text-body-1 mt-4 grey--text">
              {{ $t('crmIntelligence.selectDashboard') }}
            </p>
          </v-card>
        </div>
      </template>

      <!-- Marketing Placeholder Content -->
      <template v-else>
        <div class="d-flex align-center justify-center fill-height">
          <v-card flat max-width="600" class="text-center pa-8">
            <v-icon size="100" color="primary lighten-2">
              mdi-chart-areaspline
            </v-icon>
            <h1 class="text-h4 mt-6 primary--text">
              {{ $t('crmIntelligence.marketing.title') }}
            </h1>
            <p class="text-body-1 mt-4 grey--text text--darken-1">
              {{ $t('crmIntelligence.marketing.description') }}
            </p>
            <v-btn
              color="primary"
              large
              class="mt-6"
              href="mailto:contact@lepatron.email?subject=CRM%20Intelligence%20-%20Demande%20d'information"
            >
              <v-icon left>
                mdi-email-outline
              </v-icon>
              {{ $t('crmIntelligence.marketing.contactUs') }}
            </v-btn>
          </v-card>
        </div>
      </template>
    </v-card>
  </bs-layout-left-menu>
</template>

<style scoped>
.crm-fullwidth {
  margin-left: 56px;
  height: calc(100vh - 64px);
  width: calc(100% - 56px);
}

@media (max-width: 960px) {
  .crm-fullwidth {
    margin-left: 0;
    width: 100%;
  }
}
</style>
