<template>
  <v-dialog v-model="visible" max-width="500">
    <v-card>
      <v-card-title class="text-h6 primary--text">
        {{ $t('sidebar.upgradeRequired') }}
      </v-card-title>

      <v-card-text>
        <p class="text-body-1 mb-4">
          {{ $t('sidebar.upgradeMessage', { module: moduleName }) }}
        </p>
        <p class="text-body-2 grey--text">
          {{ $t('sidebar.contactAdmin') }}
        </p>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn text @click="visible = false">
          {{ $t('common.close') }}
        </v-btn>
        <v-btn color="accent" :href="contactUrl" target="_blank" elevation="0">
          {{ $t('sidebar.contactBadsender') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'BsUpgradeModal',
  props: {
    value: {
      type: Boolean,
      default: false,
    },
    module: {
      type: Object,
      default: null,
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

    moduleName() {
      return this.module ? this.$t(this.module.labelKey) : '';
    },

    contactUrl() {
      return this.$i18n.locale === 'fr'
        ? 'https://www.badsender.com/contact/'
        : 'https://www.badsender.com/en/contact/';
    },
  },
};
</script>
