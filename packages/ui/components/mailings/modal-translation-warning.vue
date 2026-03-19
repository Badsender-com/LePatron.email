<script>
export default {
  name: 'BsMailingModalTranslationWarning',
  data() {
    return {
      show: false,
    };
  },
  methods: {
    open() {
      this.show = true;
    },
    close() {
      this.show = false;
    },
  },
};
</script>

<template>
  <v-dialog v-model="show" max-width="500">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon left color="primary">
          mdi-check-circle
        </v-icon>
        {{ $t('translation.successTitle') }}
      </v-card-title>

      <v-card-text>
        <p class="mb-4">
          {{ $t('translation.successMessage') }}
        </p>

        <v-alert type="info" dense outlined class="mb-4" color="#2196F3">
          <strong>{{ $t('translation.warningTitle') }}</strong>
          <ul class="mt-2 mb-0">
            <li>{{ $t('translation.warningLinks') }}</li>
            <li>{{ $t('translation.warningImages') }}</li>
            <li>{{ $t('translation.warningVariants') }}</li>
          </ul>
        </v-alert>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn color="accent" @click="close">
          <v-icon left>mdi-check</v-icon>
          {{ $t('translation.understood') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
