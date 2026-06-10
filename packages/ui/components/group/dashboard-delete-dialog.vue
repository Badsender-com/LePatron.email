<script>
export default {
  name: 'BsDashboardDeleteDialog',
  props: {
    value: {
      type: Boolean,
      default: false,
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    visible: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      },
    },
  },
};
</script>

<template>
  <v-dialog :value="visible" max-width="400" @input="visible = $event">
    <v-card>
      <v-card-title>
        {{ $t('crmIntelligence.admin.deleteDashboardConfirmTitle') }}
      </v-card-title>
      <v-card-text>
        {{ $t('crmIntelligence.admin.deleteDashboardConfirmText') }}
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="visible = false">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn
          color="error"
          elevation="0"
          :loading="loading"
          @click="$emit('confirm')"
        >
          {{ $t('global.delete') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
