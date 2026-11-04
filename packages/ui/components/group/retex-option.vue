<script>
import mixinGroupSwitch from '~/helpers/mixins/mixin-group-switch.js';
import BsSettingsRow from '~/components/layout/bs-settings-row.vue';

// Retex (ADR 0012): whether a summary of an assistant session, sent with a
// feedback, may be kept for the platform company. Each user is still asked
// every time. Saved on its own, like the two-factor option.
export default {
  name: 'BsGroupRetexOption',
  components: { BsSettingsRow },
  mixins: [
    mixinGroupSwitch({ field: 'allowRetex', updatedKey: 'retex.updated' }),
  ],
};
</script>

<template>
  <bs-settings-row class="bs-group-retex-option" title-id="retex-option-title">
    <template #title>{{ $t('retex.title') }}</template>
    <template #description>{{ $t('retex.description') }}</template>
    <v-switch
      :input-value="switchValue"
      aria-labelledby="retex-option-title"
      :loading="loading"
      :disabled="loading"
      color="accent"
      hide-details
      class="mt-0 pt-0"
      @change="save"
    />
  </bs-settings-row>
</template>
