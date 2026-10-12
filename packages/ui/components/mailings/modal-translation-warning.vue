<script>
import { CheckCircle2, Check } from 'lucide-vue';

// What to check when a job reports no warnings of its own (an older server).
const DEFAULT_WARNING_KEYS = [
  'translation.warnings.checkLinks',
  'translation.warnings.checkImages',
  'translation.warnings.checkVariant',
];

export default {
  name: 'BsMailingModalTranslationWarning',
  components: {
    LucideCheckCircle2: CheckCircle2,
    LucideCheck: Check,
  },
  data() {
    return {
      show: false,
      warningKeys: DEFAULT_WARNING_KEYS,
    };
  },
  computed: {
    // The server says what to check — a composed block it could not translate
    // faithfully adds a line. A key this build has no wording for is left out
    // rather than shown raw.
    shownWarningKeys() {
      return this.warningKeys.filter((key) => this.$te(key));
    },
  },
  methods: {
    open(warningKeys) {
      this.warningKeys =
        Array.isArray(warningKeys) && warningKeys.length > 0
          ? warningKeys
          : DEFAULT_WARNING_KEYS;
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
        <lucide-check-circle2
          :size="20"
          class="mr-2"
          style="color: var(--v-primary-base)"
        />
        {{ $t('translation.successTitle') }}
      </v-card-title>

      <v-card-text>
        <p class="mb-4">
          {{ $t('translation.successMessage') }}
        </p>

        <v-alert type="info" dense outlined class="mb-4" color="#2196F3">
          <strong>{{ $t('translation.warningTitle') }}</strong>
          <ul class="mt-2 mb-0">
            <li v-for="key in shownWarningKeys" :key="key">
              {{ $t(key) }}
            </li>
          </ul>
        </v-alert>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn color="accent" @click="close">
          <lucide-check :size="16" class="mr-2" />
          {{ $t('translation.understood') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
