<script>
export default {
  name: 'EmailBuilderPlaceholder',
  computed: {
    contactUrl() {
      // Return localized contact URL
      return this.$i18n.locale === 'fr'
        ? 'https://www.badsender.com/contact/'
        : 'https://www.badsender.com/en/contact/';
    },
  },
};
</script>

<template>
  <div class="email-builder-placeholder">
    <div class="placeholder-content">
      <div class="placeholder-icon">
        <v-icon size="100" color="primary lighten-2">
          mdi-palette
        </v-icon>
      </div>

      <h1 class="text-h4 mt-6 primary--text">
        {{ $t('emailBuilder.marketing.title') }}
      </h1>

      <p class="text-body-1 mt-4 grey--text text--darken-1 placeholder-description">
        {{ $t('emailBuilder.marketing.description') }}
      </p>

      <v-card outlined class="mt-6 features-card">
        <v-list dense>
          <v-list-item
            v-for="(feature, index) in $t('emailBuilder.marketing.features')"
            :key="index"
          >
            <v-list-item-icon class="mr-2">
              <v-icon small color="success">
                mdi-check-circle
              </v-icon>
            </v-list-item-icon>
            <v-list-item-content>
              <v-list-item-title class="text-body-2">
                {{ feature }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-card>

      <v-btn
        color="primary"
        large
        class="mt-6"
        :href="contactUrl"
        target="_blank"
      >
        <v-icon left>
          mdi-email-outline
        </v-icon>
        {{ $t('emailBuilder.marketing.contactUs') }}
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.email-builder-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 64px);
  padding: 2rem;
  margin-left: 56px;
}

@media (max-width: 960px) {
  .email-builder-placeholder {
    margin-left: 0;
  }
}

.placeholder-content {
  text-align: center;
  max-width: 500px;
}

.placeholder-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background-color: rgba(0, 172, 220, 0.1);
}

.placeholder-description {
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.features-card {
  max-width: 350px;
  margin-left: auto;
  margin-right: auto;
}
</style>
