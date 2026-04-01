<script>
export default {
  name: 'EmailBuilderPlaceholder',
  computed: {
    contactUrl() {
      return this.$i18n.locale === 'fr'
        ? 'https://www.badsender.com/contact/'
        : 'https://www.badsender.com/en/contact/';
    },
    infoUrl() {
      return 'https://www.lepatron.email/';
    },
    features() {
      return this.$t('emailBuilder.marketing.features');
    },
  },
};
</script>

<template>
  <div class="marketing-page">
    <!-- HERO SECTION -->
    <section class="hero-section">
      <v-icon size="80" color="accent">
        mdi-palette
      </v-icon>

      <h1 class="text-h3 mt-6 primary--text font-weight-bold">
        {{ $t('emailBuilder.marketing.title') }}
      </h1>

      <p class="text-h6 mt-4 grey--text text--darken-1 hero-subtitle">
        {{ $t('emailBuilder.marketing.subtitle') }}
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
          <v-icon left>
            mdi-email-outline
          </v-icon>
          {{ $t('emailBuilder.marketing.ctaPrimary') }}
        </v-btn>
        <v-btn
          outlined
          x-large
          color="primary"
          :href="infoUrl"
          target="_blank"
        >
          {{ $t('emailBuilder.marketing.ctaSecondary') }}
          <v-icon right>
            mdi-open-in-new
          </v-icon>
        </v-btn>
      </div>
    </section>

    <!-- SCREENSHOT SECTION -->
    <section class="screenshot-section">
      <div class="screenshot-wrapper">
        <img
          src="/img/marketing/email-builder-screenshot.png"
          alt="Email Builder Interface"
          class="screenshot-image"
        >
      </div>
    </section>

    <!-- FEATURES SECTION -->
    <section class="features-section">
      <h2 class="text-h5 text-center mb-8 primary--text font-weight-medium">
        {{ $t('emailBuilder.marketing.featuresTitle') }}
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
              <v-icon size="48" color="accent" class="mb-4">
                {{ feature.icon }}
              </v-icon>
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
        {{ $t('emailBuilder.marketing.footerCta') }}
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
          <v-icon left>
            mdi-email-outline
          </v-icon>
          {{ $t('emailBuilder.marketing.ctaPrimary') }}
        </v-btn>
        <v-btn
          outlined
          large
          color="primary"
          :href="infoUrl"
          target="_blank"
        >
          {{ $t('emailBuilder.marketing.ctaSecondary') }}
          <v-icon right>
            mdi-open-in-new
          </v-icon>
        </v-btn>
      </div>
    </section>
  </div>
</template>

<style scoped>
.marketing-page {
  min-height: calc(100vh - 64px);
  margin-left: 56px;
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
