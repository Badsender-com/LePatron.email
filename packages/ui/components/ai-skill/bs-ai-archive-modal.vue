<script>
import BsModalConfirm from '~/components/modal-confirm.vue';

// Archiving a skill or an expertise. One a feature uses says which features
// stop using it (ADR 0019); a skill a feature calls is archived only once
// that is confirmed explicitly.
export default {
  name: 'BsAiArchiveModal',
  components: { BsModalConfirm },
  props: {
    title: { type: String, required: true },
    body: { type: String, required: true },
    loading: { type: Boolean, default: false },
    // The features that use it, as the server sent them.
    usedBy: { type: Array, default: () => [] },
    // Whether archiving it while a feature uses it is confirmed first.
    confirmUsedBy: { type: Boolean, default: false },
  },
  data() {
    return { confirmed: false };
  },
  computed: {
    features() {
      return this.usedBy.map((f) => f.description).join(', ');
    },
    mustConfirm() {
      return this.confirmUsedBy && this.usedBy.length > 0;
    },
  },
  methods: {
    open() {
      this.confirmed = false;
      this.$refs.modal.open();
    },
    archive() {
      this.$emit('confirm', {
        confirmUsedBy: this.mustConfirm && this.confirmed,
      });
    },
    close() {
      this.$refs.modal.close();
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="title"
    :is-form="true"
    modal-width="450"
  >
    <p>{{ body }}</p>
    <v-alert
      v-if="usedBy.length"
      type="warning"
      dense
      outlined
      class="bs-ai-archive-used-by"
    >
      {{ $t('aiSkills.archiveUsedBy', { features }) }}
      <v-checkbox
        v-if="mustConfirm"
        :input-value="confirmed"
        :label="$t('aiSkills.archiveConfirmUsedBy')"
        :disabled="loading"
        dense
        hide-details
        class="mt-2"
        @change="confirmed = $event === true"
      />
    </v-alert>
    <v-divider class="mt-4" />
    <div class="modal-actions">
      <v-btn text color="primary" :disabled="loading" @click="close">
        {{ $t('global.cancel') }}
      </v-btn>
      <v-btn
        color="error"
        elevation="0"
        :loading="loading"
        :disabled="mustConfirm && !confirmed"
        @click="archive"
      >
        {{ $t('aiSkills.actions.archive') }}
      </v-btn>
    </div>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}
</style>
