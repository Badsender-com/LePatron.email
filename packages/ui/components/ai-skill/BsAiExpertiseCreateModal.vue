<script>
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsCombobox from '~/components/form/bs-combobox.vue';

const CATEGORIES = [
  'redaction',
  'qc',
  'design',
  'html_integration',
  'deliverability',
  'translation',
  'other',
];

export default {
  name: 'BsAiExpertiseCreateModal',
  components: { BsModalConfirm, BsTextField, BsSelect, BsTextarea, BsCombobox },
  props: {
    loading: { type: Boolean, default: false },
  },
  data() {
    return { expertise: this.emptyExpertise() };
  },
  computed: {
    categoryOptions() {
      return CATEGORIES.map((value) => ({
        value,
        text: this.$t(`aiSkills.categories.${value}`),
      }));
    },
    canSubmit() {
      return !!this.expertise.expertiseId && !!this.expertise.title;
    },
  },
  methods: {
    emptyExpertise() {
      return {
        expertiseId: '',
        title: '',
        description: '',
        category: 'redaction',
        scope: [],
        appliesToEmailTypes: [],
        appliesToLanguages: [],
      };
    },
    open() {
      this.expertise = this.emptyExpertise();
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    onSubmit() {
      if (!this.canSubmit) return;
      this.$emit('submit', { ...this.expertise });
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('aiSkills.expertise.newExpertise')"
    :is-form="true"
    modal-width="600"
  >
    <v-form @submit.prevent="onSubmit">
      <bs-text-field
        v-model="expertise.expertiseId"
        :label="$t('aiSkills.expertise.id')"
        :hint="$t('aiSkills.expertise.idHint')"
        :disabled="loading"
        required
      />
      <bs-text-field
        v-model="expertise.title"
        :label="$t('global.title')"
        :disabled="loading"
        required
      />
      <bs-textarea
        v-model="expertise.description"
        :label="$t('global.description')"
        :rows="2"
        :disabled="loading"
      />
      <bs-select
        v-model="expertise.category"
        :items="categoryOptions"
        item-text="text"
        item-value="value"
        :label="$t('aiSkills.filters.category')"
        :disabled="loading"
      />
      <bs-combobox
        v-model="expertise.scope"
        :label="$t('aiSkills.expertise.scope')"
        :hint="$t('aiSkills.expertise.scopeHint')"
        multiple
        chips
        small-chips
        :disabled="loading"
      />
      <bs-combobox
        v-model="expertise.appliesToEmailTypes"
        :label="$t('aiSkills.expertise.appliesToEmailTypes')"
        multiple
        chips
        small-chips
        :disabled="loading"
      />
      <bs-combobox
        v-model="expertise.appliesToLanguages"
        :label="$t('aiSkills.expertise.appliesToLanguages')"
        multiple
        chips
        small-chips
        :disabled="loading"
      />
      <v-divider class="mt-4" />
      <div class="modal-actions">
        <v-btn text color="primary" :disabled="loading" @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn
          type="submit"
          color="accent"
          elevation="0"
          :loading="loading"
          :disabled="loading || !canSubmit"
        >
          {{ $t('global.create') }}
        </v-btn>
      </div>
    </v-form>
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
