<script>
import { LineChart, CheckCircle2 } from 'lucide-vue';

export default {
  name: 'MarketingPlaceholder',
  components: {
    LucideLineChart: LineChart,
    LucideCheckCircle2: CheckCircle2,
  },
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
          <lucide-line-chart :size="48" style="color: var(--v-primary-base)" />
        </div>
        <h3 class="text-subtitle-1 text-center mt-3">
          {{ $t('crmIntelligence.marketing.sidebarTitle') }}
        </h3>
        <p class="text-body-2 text-center mt-2 grey--text">
          {{ $t('crmIntelligence.marketing.sidebarDescription') }}
        </p>

        <v-list dense class="mt-3">
          <v-list-item
            v-for="(feature, index) in $t('crmIntelligence.marketing.features')"
            :key="index"
          >
            <v-list-item-icon class="mr-2">
              <lucide-check-circle2 :size="16" style="color: var(--v-success-base)" />
            </v-list-item-icon>
            <v-list-item-content>
              <v-list-item-title class="text-body-2">
                {{ feature }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-card>
    </div>
  </div>
</template>
