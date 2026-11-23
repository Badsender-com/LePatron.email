<script>
import { ScrollText } from 'lucide-vue';
import mixinGroupSwitch from '~/helpers/mixins/mixin-group-switch.js';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import BsGroupFeatureSwitch from '~/components/group/feature-switch.vue';
import BsSaveOutcome from '~/components/layout/bs-save-outcome.vue';

// Whether the logs of the company's AI invocations keep their content: the
// text sent, the instruction and the raw answer. Their metadata is logged
// either way. Set by whoever sets up the company's AI features, saved on its
// own, as the company's other switches.
export default {
  name: 'BsGroupAiLogContentOption',
  components: {
    BsFormSection,
    BsGroupFeatureSwitch,
    BsSaveOutcome,
    LucideScrollText: ScrollText,
  },
  mixins: [mixinGroupSwitch({ field: 'logSkillInvocationContent' })],
};
</script>

<template>
  <bs-form-section
    class="bs-group-ai-log-content-option"
    card
    :active="switchValue"
  >
    <template #icon>
      <lucide-scroll-text :size="20" />
    </template>
    <template #title>
      {{ $t('aiFeatures.logContent.title') }}
    </template>
    <template #description>
      {{ $t('aiFeatures.logContent.description') }}
    </template>
    <template #header-actions>
      <!-- The outcome of the switch, read beside it. -->
      <bs-save-outcome
        :outcome="outcome"
        :detail="outcomeDetail"
        @retry="save(!switchValue)"
      />
      <bs-group-feature-switch
        :value="switchValue"
        :label="$t('aiFeatures.logContent.switch')"
        :on-text="$t('aiFeatures.logContent.on')"
        :off-text="$t('aiFeatures.logContent.off')"
        :loading="loading"
        :disabled="loading"
        @change="save"
      />
    </template>

    <ul class="bs-group-ai-log-content-option__facts">
      <li>{{ $t('aiFeatures.logContent.alwaysLogged') }}</li>
      <li>{{ $t('aiFeatures.logContent.content') }}</li>
      <li>{{ $t('aiFeatures.logContent.nextCalls') }}</li>
    </ul>
  </bs-form-section>
</template>

<style lang="scss" scoped>
.bs-group-ai-log-content-option__facts {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.875rem;
  color: var(--gray-700);

  li + li {
    margin-top: 0.25rem;
  }
}
</style>
