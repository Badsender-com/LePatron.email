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
import {
  LineChart,
  Mail,
  AreaChart,
  MailCheck,
  HeartHandshake,
  DollarSign,
  Euro,
  LayoutDashboard,
  Database,
} from 'lucide-vue';

// Icon mapping from Lucide names to components
const FEATURE_ICON_MAP = {
  'area-chart': AreaChart,
  'mail-check': MailCheck,
  'heart-handshake': HeartHandshake,
  'dollar-sign': DollarSign,
  'euro': Euro,
  'layout-dashboard': LayoutDashboard,
  'database': Database,
};

export default {
  name: 'PageCrmIntelligence',
  components: {
    DashboardList,
    DashboardViewer,
    LucideLineChart: LineChart,
    LucideMail: Mail,
    LucideAreaChart: AreaChart,
    LucideMailCheck: MailCheck,
    LucideHeartHandshake: HeartHandshake,
    LucideDollarSign: DollarSign,
    LucideEuro: Euro,
    LucideLayoutDashboard: LayoutDashboard,
    LucideDatabase: Database,
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
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    getFeatureIconComponent(iconName) {
      return FEATURE_ICON_MAP[iconName] || AreaChart;
    },

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
  <!-- Marketing Landing Page when module disabled -->
  <div v-if="!isEnabled" class="marketing-page">
    <!-- HERO SECTION -->
    <section class="hero-section">
      <lucide-line-chart :size="80" style="color: var(--v-accent-base)" />

      <h1 class="text-h3 mt-6 primary--text font-weight-bold">
        {{ $t('crmIntelligence.marketing.title') }}
      </h1>

      <p class="text-h6 mt-4 grey--text text--darken-1 hero-subtitle">
        {{ $t('crmIntelligence.marketing.subtitle') }}
      </p>

      <div class="hero-actions mt-8">
        <v-btn
          color="accent"
          x-large
          elevation="0"
          :href="contactUrl"
          target="_blank"
        >
          <lucide-mail :size="20" class="mr-2" />
          {{ $t('crmIntelligence.marketing.ctaPrimary') }}
        </v-btn>
      </div>
    </section>

    <!-- FEATURES SECTION -->
    <section class="features-section">
      <h2 class="text-h5 text-center mb-8 primary--text font-weight-medium">
        {{ $t('crmIntelligence.marketing.featuresTitle') }}
      </h2>

      <v-container>
        <v-row justify="center">
          <v-col
            v-for="(feature, index) in features"
            :key="index"
            cols="12"
            sm="6"
            md="4"
          >
            <div class="feature-card">
              <component
                :is="getFeatureIconComponent(feature.icon)"
                :size="48"
                style="color: var(--v-accent-base)"
                class="mb-4"
              />
              <h3 class="text-subtitle-1 font-weight-medium mb-2">
                {{ feature.title }}
              </h3>
              <p class="text-body-2 grey--text text--darken-1 mb-0">
                {{ feature.description }}
              </p>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <!-- FOOTER CTA -->
    <section class="footer-cta">
      <h2 class="text-h5 mb-6 primary--text">
        {{ $t('crmIntelligence.marketing.footerCta') }}
      </h2>

      <v-btn
        color="accent"
        large
        elevation="0"
        :href="contactUrl"
        target="_blank"
      >
        <lucide-mail :size="20" class="mr-2" />
        {{ $t('crmIntelligence.marketing.ctaPrimary') }}
      </v-btn>
    </section>
  </div>

  <!-- Single dashboard: full width, no module-specific sidebar -->
  <div
    v-else-if="isEnabled && !hasMultipleDashboards"
    class="crm-fullwidth"
  >
    <dashboard-viewer
      v-if="selectedDashboard"
      :embed-url="embedUrl"
      :loading="loadingEmbed"
      :dashboard-name="selectedDashboard.name"
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
      />
      <div
        v-else
        class="d-flex align-center justify-center fill-height grey lighten-4"
      >
        <v-card flat max-width="400" class="text-center pa-8 transparent">
          <lucide-line-chart :size="64" style="color: #9e9e9e" />
          <p class="text-body-1 mt-4 grey--text">
            {{ $t('crmIntelligence.selectDashboard') }}
          </p>
        </v-card>
      </div>
    </v-card>
  </bs-layout-left-menu>
</template>

<style scoped>
/* Marketing Landing Page */
.marketing-page {
  min-height: calc(100vh - 64px);
  margin-left: 56px;
}

.hero-section {
  padding: 80px 24px;
  text-align: center;
  background: linear-gradient(180deg, #f8f9fa 0%, #fff 100%);
}

.hero-subtitle {
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  font-weight: 400;
}

.hero-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
}

.features-section {
  padding: 60px 24px;
  background: #fafafa;
}

.feature-card {
  text-align: center;
  padding: 24px 16px;
}

.footer-cta {
  padding: 60px 24px;
  text-align: center;
  background: #fff;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

/* Dashboard views */
.crm-fullwidth {
  margin-left: 56px;
  height: calc(100vh - 64px);
  width: calc(100% - 56px);
}

@media (max-width: 960px) {
  .marketing-page {
    margin-left: 0;
  }

  .hero-section {
    padding: 48px 16px;
  }

  .hero-actions {
    flex-direction: column;
    align-items: center;
  }

  .hero-actions .v-btn {
    width: 100%;
    max-width: 280px;
  }

  .crm-fullwidth {
    margin-left: 0;
    width: 100%;
  }
}
</style>
