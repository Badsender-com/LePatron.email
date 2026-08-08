<script>
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import suggestIdentifier from '~/helpers/suggest-skill-identifier.js';
import { RefreshCw } from 'lucide-vue';

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
  components: {
    BsModalConfirm,
    BsTextField,
    BsSelect,
    BsTextarea,
    LucideRefreshCw: RefreshCw,
  },
  props: {
    schemas: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      skill: this.emptySkill(),
      identifierManuallyEdited: false,
    };
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
    suggestedIdentifier() {
      return suggestIdentifier({
        category: this.skill.category,
        title: this.skill.title,
      });
    },
    canSubmit() {
      return !!this.skill.skillId && !!this.skill.title;
    },
  },
  watch: {
    suggestedIdentifier(next) {
      if (!this.identifierManuallyEdited && next) {
        this.skill.skillId = next;
      }
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
      this.identifierManuallyEdited = false;
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
    onIdentifierInput(value) {
      this.skill.skillId = value;
      this.identifierManuallyEdited = true;
    },
    resetIdentifier() {
      this.identifierManuallyEdited = false;
      this.skill.skillId = this.suggestedIdentifier;
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
      <div class="identifier-row">
        <bs-text-field
          :value="skill.skillId"
          :label="$t('aiSkills.skill.id')"
          :hint="$t('aiSkills.skill.idHint')"
          placeholder="redaction.cta"
          :disabled="loading"
          required
          class="identifier-row__field"
          @input="onIdentifierInput"
        />
        <v-tooltip top>
          <template #activator="{ on, attrs }">
            <v-btn
              icon
              :disabled="loading || !suggestedIdentifier"
              class="identifier-row__reset"
              v-bind="attrs"
              v-on="on"
              @click="resetIdentifier"
            >
              <lucide-refresh-cw :size="18" />
            </v-btn>
          </template>
          <span>{{ $t('aiSkills.skill.idResetHint') }}</span>
        </v-tooltip>
      </div>
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
.identifier-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;

  &__field {
    flex: 1;
  }

  &__reset {
    margin-top: 1.6rem; // align with the input baseline
  }
}
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}
</style>
