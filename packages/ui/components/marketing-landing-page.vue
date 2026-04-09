<script>
export default {
  name: 'BsMarketingLandingPage',
  props: {
    icon: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    subtitle: {
      type: String,
      required: true,
    },
    features: {
      type: Array,
      required: true,
    },
    featuresTitle: {
      type: String,
      required: true,
    },
    ctaLabel: {
      type: String,
      required: true,
    },
    ctaUrl: {
      type: String,
      required: true,
    },
    footerCta: {
      type: String,
      required: true,
    },
  },
};
</script>

<template>
  <div class="marketing-page">
    <!-- HERO SECTION -->
    <section class="hero-section">
      <v-icon size="80" color="accent">
        {{ icon }}
      </v-icon>

      <h1 class="text-h3 mt-6 primary--text font-weight-bold">
        {{ title }}
      </h1>

      <p class="text-h6 mt-4 grey--text text--darken-1 hero-subtitle">
        {{ subtitle }}
      </p>

      <div class="hero-actions mt-8">
        <slot name="hero-actions">
          <v-btn
            color="accent"
            x-large
            elevation="0"
            :href="ctaUrl"
            target="_blank"
          >
            <v-icon left>
              mdi-email-outline
            </v-icon>
            {{ ctaLabel }}
          </v-btn>
        </slot>
      </div>
    </section>

    <!-- EXTRA SECTION (screenshot, etc.) -->
    <slot name="extra-section" />

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
        {{ footerCta }}
      </h2>

      <div class="footer-actions">
        <slot name="footer-actions">
          <v-btn
            color="accent"
            large
            elevation="0"
            :href="ctaUrl"
            target="_blank"
          >
            <v-icon left>
              mdi-email-outline
            </v-icon>
            {{ ctaLabel }}
          </v-btn>
        </slot>
      </div>
    </section>
  </div>
</template>

<style scoped>
.marketing-page {
  min-height: calc(100vh - 64px);
  margin-left: 56px;
}

.hero-section {
  padding: 80px 24px;
  text-align: center;
  background: linear-gradient(
    180deg,
    var(--v-background-lighten, #f8f9fa) 0%,
    var(--v-background-base, #fff) 100%
  );
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
  background: var(--v-background-lighten, #fafafa);
}

.feature-card {
  text-align: center;
  padding: 24px 16px;
}

.footer-cta {
  padding: 60px 24px;
  text-align: center;
  background: var(--v-background-base, #fff);
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.footer-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
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
