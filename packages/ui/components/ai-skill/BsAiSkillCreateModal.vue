<script>
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';

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
  name: 'BsAiSkillCreateModal',
  components: { BsModalConfirm, BsTextField, BsSelect, BsTextarea },
  props: {
    schemas: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },
  data() {
    return { skill: this.emptySkill() };
  },
  computed: {
    categoryOptions() {
      return CATEGORIES.map((value) => ({
        value,
        text: this.$t(`aiSkills.categories.${value}`),
      }));
    },
    inputSchemas() {
      return this.schemas.filter((s) => /Input$/.test(s));
    },
    outputSchemas() {
      return this.schemas.filter((s) => /Output$/.test(s));
    },
    canSubmit() {
      return !!this.skill.skillId && !!this.skill.title;
    },
  },
  methods: {
    emptySkill() {
      return {
        skillId: '',
        title: '',
        description: '',
        category: 'redaction',
        inputSchemaId: '',
        outputSchemaId: '',
      };
    },
    open() {
      this.skill = this.emptySkill();
      if (this.inputSchemas.length > 0) {
        this.skill.inputSchemaId = this.inputSchemas[0];
      }
      if (this.outputSchemas.length > 0) {
        this.skill.outputSchemaId = this.outputSchemas[0];
      }
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    onSubmit() {
      if (!this.canSubmit) return;
      this.$emit('submit', { ...this.skill });
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('aiSkills.skill.newSkill')"
    :is-form="true"
    modal-width="600"
  >
    <v-form @submit.prevent="onSubmit">
      <bs-text-field
        v-model="skill.skillId"
        :label="$t('aiSkills.skill.id')"
        :hint="$t('aiSkills.skill.idHint')"
        :disabled="loading"
        required
      />
      <bs-text-field
        v-model="skill.title"
        :label="$t('global.title')"
        :disabled="loading"
        required
      />
      <bs-textarea
        v-model="skill.description"
        :label="$t('global.description')"
        :rows="2"
        :disabled="loading"
      />
      <bs-select
        v-model="skill.category"
        :items="categoryOptions"
        item-text="text"
        item-value="value"
        :label="$t('aiSkills.filters.category')"
        :disabled="loading"
      />
      <bs-select
        v-model="skill.inputSchemaId"
        :items="inputSchemas"
        :label="$t('aiSkills.skill.inputSchemaId')"
        :disabled="loading"
      />
      <bs-select
        v-model="skill.outputSchemaId"
        :items="outputSchemas"
        :label="$t('aiSkills.skill.outputSchemaId')"
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
