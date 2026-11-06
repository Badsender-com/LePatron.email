<script>
// A draft written since the screen read it, by an assistant or another
// person (ADR 0014): the save or the publication was refused, and what the
// person typed is still on screen. Reloading shows the draft as it is now.
export default {
  name: 'BsAiDraftChangedAlert',
  props: {
    loading: { type: Boolean, default: false },
  },
};
</script>

<template>
  <v-alert type="warning" outlined dense class="mb-4">
    <div class="d-flex align-center flex-wrap">
      <span class="mr-4">{{
        $t('aiSkills.errors.SKILL_VERSION_CHANGED')
      }}</span>
      <v-spacer />
      <v-btn
        text
        small
        color="accent"
        :loading="loading"
        @click="$emit('reload')"
      >
        {{ $t('aiSkills.version.reload') }}
      </v-btn>
    </div>
  </v-alert>
</template>
