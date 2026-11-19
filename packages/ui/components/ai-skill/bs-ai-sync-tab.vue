<script>
import BsAiFollowProduction from '~/components/ai-skill/bs-ai-follow-production.vue';
import BsAiReadTokens from '~/components/ai-skill/bs-ai-read-tokens.vue';

// Production and its copies (ADR 0019). On a copy, the follow of production
// comes first; production's read tokens follow, which a copy does not create.
// The tokens wait for the follow's state, so a copy never shows a button it
// hides a moment later.
export default {
  name: 'BsAiSyncTab',
  components: { BsAiFollowProduction, BsAiReadTokens },
  data() {
    return { stateKnown: false, isCopy: false };
  },
  methods: {
    onState({ isCopy }) {
      this.isCopy = !!isCopy;
      this.stateKnown = true;
    },
  },
};
</script>

<template>
  <div class="bs-ai-sync">
    <bs-ai-follow-production @state="onState" @followed="$emit('followed')" />
    <bs-ai-read-tokens v-if="stateKnown" :is-copy="isCopy" />
  </div>
</template>

<style lang="scss" scoped>
.bs-ai-sync {
  max-width: 880px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
</style>
