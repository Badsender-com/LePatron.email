<script>
import {
  Mail,
  ExternalLink,
  GripVertical,
  Smartphone,
  Puzzle,
  Palette,
  CloudUpload,
  Users,
  LineChart,
  BarChart,
  PieChart,
  TrendingUp,
  Target,
  Zap,
} from 'lucide-vue';

// Icon mapping from Lucide names to components
const FEATURE_ICON_MAP = {
  'grip-vertical': GripVertical,
  smartphone: Smartphone,
  puzzle: Puzzle,
  palette: Palette,
  'cloud-upload': CloudUpload,
  users: Users,
  'line-chart': LineChart,
  'bar-chart': BarChart,
  'pie-chart': PieChart,
  'trending-up': TrendingUp,
  target: Target,
  zap: Zap,
};

export default {
  name: 'ModuleMarketingPage',
  components: {
    LucideMail: Mail,
    LucideExternalLink: ExternalLink,
    LucideGripVertical: GripVertical,
    LucideSmartphone: Smartphone,
    LucidePuzzle: Puzzle,
    LucidePalette: Palette,
    LucideCloudUpload: CloudUpload,
    LucideUsers: Users,
    LucideLineChart: LineChart,
    LucideBarChart: BarChart,
    LucidePieChart: PieChart,
    LucideTrendingUp: TrendingUp,
    LucideTarget: Target,
    LucideZap: Zap,
  },
  props: {
    moduleId: {
      type: String,
      required: true,
    },
  },
  computed: {
    contactUrl() {
      return this.$i18n.locale === 'fr'
        ? 'https://www.badsender.com/contact/'
        : 'https://www.badsender.com/en/contact/';
    },
    infoUrl() {
      return 'https://www.lepatron.email/';
    },
    moduleKey() {
      // Convert module-id to camelCase for i18n keys
      return this.moduleId.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    },
    heroIcon() {
      const iconMap = {
        emailBuilder: Palette,
        crmIntelligence: LineChart,
      };
      return iconMap[this.moduleKey] || Palette;
    },
    title() {
      return this.$t(`${this.moduleKey}.marketing.title`);
    },
    subtitle() {
      return this.$t(`${this.moduleKey}.marketing.subtitle`);
    },
    ctaPrimary() {
      return this.$t(`${this.moduleKey}.marketing.ctaPrimary`);
    },
    ctaSecondary() {
      return this.$t(`${this.moduleKey}.marketing.ctaSecondary`);
    },
    featuresTitle() {
      return this.$t(`${this.moduleKey}.marketing.featuresTitle`);
    },
    footerCta() {
      return this.$t(`${this.moduleKey}.marketing.footerCta`);
    },
    features() {
      return this.$t(`${this.moduleKey}.marketing.features`);
    },
    screenshot() {
      const screenshots = {
        emailBuilder: '/img/marketing/email-builder-screenshot.png',
        crmIntelligence: '/img/marketing/crm-intelligence-screenshot.png',
      };
      return screenshots[this.moduleKey];
    },
  },
  methods: {
    getFeatureIconComponent(iconName) {
      return FEATURE_ICON_MAP[iconName] || Palette;
    },
  },
};
</script>

<template>
  <div class="marketing-page">
    <!-- HERO SECTION -->
    <section class="hero-section">
      <component
        :is="heroIcon"
        :size="80"
        style="color: var(--v-accent-base)"
      />

      <h1 class="text-h3 mt-6 primary--text font-weight-bold">
        {{ title }}
      </h1>

      <p class="text-h6 mt-4 grey--text text--darken-1 hero-subtitle">
        {{ subtitle }}
      </p>

      <div class="hero-actions mt-8">
        <v-btn
          color="accent"
          x-large
          elevation="0"
          :href="contactUrl"
          target="_blank"
          class="mr-4"
        >
          <lucide-mail :size="20" class="mr-2" />
          {{ ctaPrimary }}
        </v-btn>
        <v-btn
          v-if="ctaSecondary"
          outlined
          x-large
          color="primary"
          :href="infoUrl"
          target="_blank"
        >
          {{ ctaSecondary }}
          <lucide-external-link :size="20" class="ml-2" />
        </v-btn>
      </div>
    </section>

    <!-- SCREENSHOT SECTION -->
    <section v-if="screenshot" class="screenshot-section">
      <div class="screenshot-wrapper">
        <img
          :src="screenshot"
          :alt="`${title} Interface`"
          class="screenshot-image"
        >
      </div>
    </section>

    <!-- FEATURES SECTION -->
    <section class="features-section">
      <h2 class="text-h5 text-center mb-8 primary--text font-weight-medium">
        {{ featuresTitle }}
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
        {{ footerCta }}
      </h2>

      <div class="footer-actions">
        <v-btn
          color="accent"
          large
          elevation="0"
          :href="contactUrl"
          target="_blank"
          class="mr-4"
        >
          <lucide-mail :size="20" class="mr-2" />
          {{ ctaPrimary }}
        </v-btn>
        <v-btn
          v-if="ctaSecondary"
          outlined
          large
          color="primary"
          :href="infoUrl"
          target="_blank"
        >
          {{ ctaSecondary }}
          <lucide-external-link :size="20" class="ml-2" />
        </v-btn>
      </div>
    </section>
  </div>
</template>

<style scoped>
.marketing-page {
  min-height: calc(100vh - 64px);
}

/* Hero Section */
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

/* Screenshot Section */
.screenshot-section {
  padding: 40px 24px;
  background: #fff;
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

/* Features Section */
.features-section {
  padding: 60px 24px;
  background: #fafafa;
}

.feature-card {
  text-align: center;
  padding: 24px 16px;
}

/* Footer CTA */
.footer-cta {
  padding: 60px 24px;
  text-align: center;
  background: #fff;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.footer-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
}

/* Responsive */
@media (max-width: 960px) {
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
    margin-right: 0 !important;
  }

  .footer-actions {
    flex-direction: column;
    align-items: center;
  }

  .footer-actions .v-btn {
    width: 100%;
    max-width: 280px;
    margin-right: 0 !important;
  }
}
</style>
