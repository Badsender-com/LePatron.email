<script>
// The test cases of a feature skill's version (ADR 0019): listed on every
// version, written on a draft only. The panel owns the draft; this component
// emits the whole new list, never mutating the one it was given.
import BsModalConfirm from '~/components/modal-confirm.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import {
  emptyTestCaseForm,
  testCaseToForm,
  formToTestCase,
} from '~/helpers/ai-skill-test-cases.js';
import { Plus, Pencil, Trash2, Eye } from 'lucide-vue';

export default {
  name: 'BsAiSkillTestCases',
  components: {
    BsModalConfirm,
    BsTextField,
    BsTextarea,
    LucidePlus: Plus,
    LucidePencil: Pencil,
    LucideTrash2: Trash2,
    LucideEye: Eye,
  },
  props: {
    testCases: { type: Array, default: () => [] },
    readonly: { type: Boolean, default: false },
  },
  data() {
    return {
      // Index of the case being edited, null for a new one.
      editingIndex: null,
      form: emptyTestCaseForm(),
      errors: {},
    };
  },
  computed: {
    modalTitle() {
      if (this.readonly) return this.form.name;
      return this.editingIndex === null
        ? this.$t('aiSkills.testCases.add')
        : this.$t('aiSkills.testCases.edit');
    },
  },
  methods: {
    errorFor(field) {
      const code = this.errors[field];
      return code ? this.$t(`aiSkills.testCases.errors.${code}`) : [];
    },
    openNew() {
      this.editingIndex = null;
      this.form = emptyTestCaseForm();
      this.errors = {};
      this.$refs.modal.open();
    },
    openCase(index) {
      this.editingIndex = index;
      this.form = testCaseToForm(this.testCases[index]);
      this.errors = {};
      this.$refs.modal.open();
    },
    save() {
      const { testCase, errors } = formToTestCase(this.form);
      this.errors = errors;
      if (!testCase) return;
      const next = [...this.testCases];
      if (this.editingIndex === null) next.push(testCase);
      else next.splice(this.editingIndex, 1, testCase);
      this.$emit('update:testCases', next);
      this.$refs.modal.close();
    },
    remove(index) {
      if (!confirm(this.$t('aiSkills.testCases.deleteConfirm'))) return;
      this.$emit(
        'update:testCases',
        this.testCases.filter((_testCase, i) => i !== index)
      );
    },
  },
};
</script>

<template>
  <div class="test-cases mb-3">
    <div class="d-flex align-center mb-1">
      <span class="text-subtitle-2">{{ $t('aiSkills.testCases.title') }}</span>
      <v-spacer />
      <v-btn v-if="!readonly" text small color="primary" @click="openNew">
        <lucide-plus :size="16" class="mr-1" />
        {{ $t('aiSkills.testCases.add') }}
      </v-btn>
    </div>
    <p class="text-caption text--secondary mb-2">
      {{ $t('aiSkills.testCases.help') }}
    </p>
    <p v-if="!testCases.length" class="text-caption text--disabled mb-0">
      {{ $t('aiSkills.testCases.empty') }}
    </p>
    <v-list v-else dense outlined class="py-0">
      <v-list-item v-for="(testCase, i) in testCases" :key="i">
        <v-list-item-content>
          <v-list-item-title>{{ testCase.name }}</v-list-item-title>
          <v-list-item-subtitle v-if="testCase.notes">
            {{ testCase.notes }}
          </v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action class="flex-row">
          <v-btn
            icon
            small
            :title="
              readonly
                ? $t('aiSkills.testCases.view')
                : $t('aiSkills.testCases.edit')
            "
            @click="openCase(i)"
          >
            <lucide-eye v-if="readonly" :size="16" />
            <lucide-pencil v-else :size="16" />
          </v-btn>
          <v-btn
            v-if="!readonly"
            icon
            small
            :title="$t('aiSkills.testCases.delete')"
            @click="remove(i)"
          >
            <lucide-trash2 :size="16" />
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>

    <bs-modal-confirm
      ref="modal"
      :title="modalTitle"
      :is-form="true"
      modal-width="700"
    >
      <bs-text-field
        v-if="!readonly"
        v-model="form.name"
        :label="$t('aiSkills.testCases.name')"
        :error-messages="errorFor('name')"
        required
      />
      <bs-textarea
        v-model="form.input"
        :label="$t('aiSkills.testCases.input')"
        :hint="$t('aiSkills.testCases.inputHint')"
        :error-messages="errorFor('input')"
        :readonly="readonly"
        :rows="6"
        monospace
        required
      />
      <bs-textarea
        v-model="form.expectedOutput"
        :label="$t('aiSkills.testCases.expectedOutput')"
        :hint="$t('aiSkills.testCases.expectedOutputHint')"
        :readonly="readonly"
        :rows="4"
      />
      <bs-textarea
        v-model="form.notes"
        :label="$t('aiSkills.testCases.notes')"
        :readonly="readonly"
        :rows="2"
      />
      <v-divider class="mt-4" />
      <div class="modal-actions">
        <v-btn text color="primary" @click="$refs.modal.close()">
          {{ readonly ? $t('global.close') : $t('global.cancel') }}
        </v-btn>
        <v-btn v-if="!readonly" color="accent" elevation="0" @click="save">
          {{ $t('aiSkills.testCases.save') }}
        </v-btn>
      </div>
    </bs-modal-confirm>
  </div>
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
