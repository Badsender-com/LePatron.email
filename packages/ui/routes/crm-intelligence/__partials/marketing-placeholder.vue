<script>
export default {
  name: 'MarketingPlaceholder',
};
</script>

<template>
  <div>
    <v-list>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title class="text-h6">
            {{ $t('crmIntelligence.title') }}
          </v-list-item-title>
        </v-list-item-content>
      </v-list-item>
    </v-list>

    <v-divider />

    <div class="pa-4">
      <v-card outlined class="pa-4">
        <div class="text-center">
          <v-icon size="48" color="primary">
            mdi-chart-areaspline
          </v-icon>
        </div>
        <h3 class="text-subtitle-1 text-center mt-3">
          {{ $t('crmIntelligence.marketing.title') }}
        </h3>
        <p class="text-body-2 text-center mt-2 grey--text">
          {{ $t('crmIntelligence.marketing.subtitle') }}
        </p>

        <v-list dense class="mt-3">
          <v-list-item
            v-for="(feature, index) in $t('crmIntelligence.marketing.features')"
            :key="index"
          >
            <v-list-item-icon class="mr-2">
              <v-icon small color="success">
                mdi-check-circle
              </v-icon>
            </v-list-item-icon>
            <v-list-item-content>
              <v-list-item-title class="text-body-2">
                {{ feature.title }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-card>
    </div>
  </div>
</template>
