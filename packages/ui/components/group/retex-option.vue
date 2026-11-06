<script>
import mixinGroupSwitch from '~/helpers/mixins/mixin-group-switch.js';

// Retex (ADR 0012): whether a summary of an assistant session, sent with a
// feedback, may be kept for the platform company. Each user is still asked
// every time. Saved on its own, like the two-factor option.
export default {
  name: 'BsGroupRetexOption',
  mixins: [
    mixinGroupSwitch({ field: 'allowRetex', updatedKey: 'retex.updated' }),
  ],
};
</script>

<template>
  <section class="bs-group-retex-option">
    <h3 class="text-subtitle-1 font-weight-medium">
      {{ $t('retex.title') }}
    </h3>
    <p class="text-body-2 text--secondary">
      {{ $t('retex.description') }}
    </p>
    <v-switch
      :input-value="switchValue"
      :label="$t('retex.switch')"
      :loading="loading"
      :disabled="loading"
      inset
      @change="save"
    />
    <p class="text-caption text--secondary mb-1">
      {{ $t('retex.alwaysShared') }}
    </p>
    <p class="text-caption text--secondary mb-0">
      {{ $t('retex.offForgets') }}
    </p>
  </section>
</template>
