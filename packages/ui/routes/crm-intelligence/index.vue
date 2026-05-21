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
import DashboardList from './__partials/dashboard-list.vue';
import DashboardViewer from './__partials/dashboard-viewer.vue';
import BsMarketingLandingPage from '~/components/marketing-landing-page.vue';

export default {
  name: 'PageCrmIntelligence',
  components: {
    DashboardList,
    DashboardViewer,
    BsMarketingLandingPage,
  },
  mixins: [mixinPageTitle],
  meta: { acl: ACL_USER },
  middleware({ store, redirect }) {
    if (store.getters[`${USER}/${IS_ADMIN}`]) {
      redirect('/groups');
    }
  },
  async asyncData({ $axios }) {
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
    } catch {
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
    screenshotAvailable: true,
  }),
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
    contactUrl() {
      return this.$i18n.locale === 'fr'
        ? 'https://www.badsender.com/contact/'
        : 'https://www.badsender.com/en/contact/';
    },
    features() {
      return this.$t('crmIntelligence.marketing.features');
    },
    ...mapState(USER, {
      userInfo: 'info',
    }),
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
    }),
  },
  mounted() {
    // Auto-select first dashboard if available
    if (
      this.isEnabled &&
      this.dashboards.length > 0 &&
      !this.selectedDashboard
    ) {
      this.selectDashboard(this.dashboards[0]);
    }
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    onScreenshotError() {
      this.screenshotAvailable = false;
    },

    async refreshEmbed() {
      if (this.selectedDashboard) {
        await this.selectDashboard(this.selectedDashboard, true);
      }
    },

    async selectDashboard(dashboard, force = false) {
      if (!force && this.selectedDashboard?.id === dashboard.id) return;

      this.selectedDashboard = dashboard;
      this.loadingEmbed = true;
      this.embedUrl = null;

      try {
        const result = await this.$axios.$get(
          getCrmIntelligenceEmbedUrl(dashboard.id)
        );
        this.embedUrl = result.embedUrl;
      } catch {
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
  <!-- Marketing Landing Page when module disabled -->
  <bs-marketing-landing-page
    v-if="!isEnabled"
    icon="mdi-chart-line"
    :title="$t('crmIntelligence.marketing.title')"
    :subtitle="$t('crmIntelligence.marketing.subtitle')"
    :features="features"
    :features-title="$t('crmIntelligence.marketing.featuresTitle')"
    :cta-label="$t('crmIntelligence.marketing.ctaPrimary')"
    :cta-url="contactUrl"
    :footer-cta="$t('crmIntelligence.marketing.footerCta')"
  >
    <template v-if="screenshotAvailable" #extra-section>
      <section class="screenshot-section">
        <div class="screenshot-wrapper">
          <img
            src="/img/marketing/crm-intelligence-screenshot.png"
            :alt="$t('crmIntelligence.marketing.screenshotAlt')"
            class="screenshot-image"
            @error="onScreenshotError"
          >
        </div>
      </section>
    </template>
  </bs-marketing-landing-page>

  <!-- Single dashboard: full width, no module-specific sidebar -->
  <div v-else-if="isEnabled && !hasMultipleDashboards" class="crm-fullwidth">
    <dashboard-viewer
      v-if="selectedDashboard"
      :embed-url="embedUrl"
      :loading="loadingEmbed"
      :dashboard-name="selectedDashboard.name"
      @refresh="refreshEmbed"
    />
  </div>

  <!-- Multiple dashboards: use sidebar layout -->
  <bs-layout-left-menu v-else>
    <template #menu>
      <dashboard-list
        :dashboards="dashboards"
        :selected="selectedDashboard"
        @select="selectDashboard"
      />
    </template>

    <!-- Main Content Area -->
    <v-card flat tile class="fill-height">
      <dashboard-viewer
        v-if="selectedDashboard"
        :embed-url="embedUrl"
        :loading="loadingEmbed"
        :dashboard-name="selectedDashboard.name"
        @refresh="refreshEmbed"
      />
      <div
        v-else
        class="d-flex align-center justify-center fill-height grey lighten-4"
      >
        <v-card flat max-width="400" class="text-center pa-8 transparent">
          <v-icon size="64" color="grey">
            mdi-chart-line
          </v-icon>
          <p class="text-body-1 mt-4 grey--text">
            {{ $t('crmIntelligence.selectDashboard') }}
          </p>
        </v-card>
      </div>
    </v-card>
  </bs-layout-left-menu>
</template>

<style scoped>
.screenshot-section {
  padding: 40px 24px;
  background: var(--v-background-base, #fff);
}

.screenshot-wrapper {
  max-width: 1000px;
  margin: 0 auto;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  background: #f5f5f5;
}

.screenshot-image {
  width: 100%;
  height: auto;
  display: block;
}

/* Dashboard views */
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
