<script>
import BsMarketingLandingPage from '~/components/marketing-landing-page.vue';

export default {
  name: 'EmailBuilderPlaceholder',
  components: { BsMarketingLandingPage },
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
  <bs-marketing-landing-page
    icon="mdi-palette"
    :title="$t('emailBuilder.marketing.title')"
    :subtitle="$t('emailBuilder.marketing.subtitle')"
    :features="features"
    :features-title="$t('emailBuilder.marketing.featuresTitle')"
    :cta-label="$t('emailBuilder.marketing.ctaPrimary')"
    :cta-url="contactUrl"
    :footer-cta="$t('emailBuilder.marketing.footerCta')"
  >
    <template #hero-actions>
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
      <v-btn outlined x-large color="primary" :href="infoUrl" target="_blank">
        {{ $t('emailBuilder.marketing.ctaSecondary') }}
        <v-icon right>
          mdi-open-in-new
        </v-icon>
      </v-btn>
    </template>

    <template #extra-section>
      <section class="screenshot-section">
        <div class="screenshot-wrapper">
          <img
            src="/img/marketing/email-builder-screenshot.png"
            :alt="$t('emailBuilder.marketing.screenshotAlt')"
            class="screenshot-image"
          >
        </div>
      </section>
    </template>

    <template #footer-actions>
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
      <v-btn outlined large color="primary" :href="infoUrl" target="_blank">
        {{ $t('emailBuilder.marketing.ctaSecondary') }}
        <v-icon right>
          mdi-open-in-new
        </v-icon>
      </v-btn>
    </template>
  </bs-marketing-landing-page>
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
</style>
