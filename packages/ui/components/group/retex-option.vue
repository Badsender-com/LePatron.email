<script>
import mixinGroupSwitch from '~/helpers/mixins/mixin-group-switch.js';
import BsSettingsRow from '~/components/layout/bs-settings-row.vue';

// Retex (ADR 0012, ADR 0021): whether the company's users may report a
// retex, a divergence or a complement, to the platform company. Each user
// still approves each one. Saved on its own, like the two-factor option.
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
    <template #description>
      {{ $t('retex.description') }}
      <span class="d-block mt-1">{{ $t('retex.alwaysShared') }}</span>
      <span class="d-block">{{ $t('retex.offForgets') }}</span>
    </template>
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
