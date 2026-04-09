<script>
export default {
  name: 'BsDashboardCard',
  props: {
    dashboard: {
      type: Object,
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
    isFirst: {
      type: Boolean,
      default: false,
    },
    isLast: {
      type: Boolean,
      default: false,
    },
  },
};
</script>

<template>
  <v-card outlined class="mb-2">
    <v-card-title class="py-2">
      <span class="text-body-2 grey--text mr-3">#{{ index + 1 }}</span>
      <v-icon left small color="primary">
        mdi-chart-line
      </v-icon>
      {{ dashboard.name }}
      <v-spacer />
      <v-tooltip bottom>
        <template #activator="{ on, attrs }">
          <v-btn
            icon
            small
            :disabled="isFirst"
            v-bind="attrs"
            v-on="on"
            @click="$emit('move', 'up')"
          >
            <v-icon small>
              mdi-arrow-up
            </v-icon>
          </v-btn>
        </template>
        <span>{{ $t('crmIntelligence.admin.moveUp') }}</span>
      </v-tooltip>
      <v-tooltip bottom>
        <template #activator="{ on, attrs }">
          <v-btn
            icon
            small
            :disabled="isLast"
            v-bind="attrs"
            v-on="on"
            @click="$emit('move', 'down')"
          >
            <v-icon small>
              mdi-arrow-down
            </v-icon>
          </v-btn>
        </template>
        <span>{{ $t('crmIntelligence.admin.moveDown') }}</span>
      </v-tooltip>
      <v-btn icon small class="ml-2" @click="$emit('edit')">
        <v-icon small>
          mdi-pencil
        </v-icon>
      </v-btn>
      <v-btn icon small color="error" @click="$emit('delete')">
        <v-icon small>
          mdi-delete
        </v-icon>
      </v-btn>
    </v-card-title>
    <v-card-subtitle>
      <v-chip x-small outlined class="mr-2">
        {{
          dashboard.integration && dashboard.integration.name
            ? dashboard.integration.name
            : '-'
        }}
      </v-chip>
      <span v-if="dashboard.description">
        {{ dashboard.description }}
      </span>
    </v-card-subtitle>
  </v-card>
</template>
