<script>
/**
 * BsAiPlaygroundInputForm — edits a scenario's input as an auto-generated
 * form (driven by the skill's schema descriptor) or as raw JSON (advanced
 * mode). Same contract as the previous JSON textarea: object in, `input` /
 * `valid` events out. Unknown keys are PRESERVED (warning, never silently
 * dropped). Validity is permissive: the server's zod validation stays the
 * authority and returns inline `fieldErrors`.
 */
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsAiPlaygroundInputField from './bs-ai-playground-input-field.vue';
import BsAiPlaygroundSkillChangeDialog from './bs-ai-playground-skill-change-dialog.vue';
import {
  fetchSchemaDescriptor,
  humanizeFieldLabel,
  fieldPlaceholder,
} from '~/helpers/schema-descriptor.js';
import {
  partitionInputKeys,
  cleanInput,
  EXPERTISE_KEY,
} from '~/helpers/input-form-reconcile.js';

export default {
  name: 'BsAiPlaygroundInputForm',
  components: {
    BsTextarea,
    BsAiPlaygroundInputField,
    BsAiPlaygroundSkillChangeDialog,
  },
  props: {
    value: { type: Object, default: () => ({}) },
    schemaId: { type: String, default: null },
    fieldErrors: { type: Array, default: () => [] },
    disabled: { type: Boolean, default: false },
  },
  data() {
    return {
      mode: 'json',
      descriptor: null,
      loading: false,
      jsonDraft: JSON.stringify(this.value || {}, null, 2),
      jsonError: null,
      dismissedFields: [],
      pendingDropped: null, // field names awaiting skill-change confirmation
    };
  },
  computed: {
    formCapable() {
      return !!(
        this.descriptor &&
        this.descriptor.fields.length &&
        this.descriptor.fields.every((f) => f.type !== 'unknown')
      );
    },
    knownFieldNames() {
      return this.descriptor ? this.descriptor.fields.map((f) => f.name) : [];
    },
    unknownKeys() {
      if (!this.descriptor) return [];
      return Object.keys(this.value || {}).filter(
        (k) => !this.knownFieldNames.includes(k) && k !== EXPERTISE_KEY
      );
    },
    // `expertise` typed by hand: accepted by the schema, but the runner
    // overwrites it as soon as the scenario resolves at least one expertise.
    // Worth saying explicitly instead of counting it as an unknown key.
    hasManualExpertiseKey() {
      return (
        !!this.descriptor &&
        this.descriptor.hasExpertiseField &&
        EXPERTISE_KEY in (this.value || {})
      );
    },
    activeFieldErrors() {
      return (this.fieldErrors || []).filter(
        (e) => !this.dismissedFields.includes(e.field)
      );
    },
    errorsByField() {
      const map = {};
      for (const e of this.activeFieldErrors) {
        if (!map[e.field]) map[e.field] = [];
        map[e.field].push(this.errorMessage(e));
      }
      return map;
    },
    // Errors that have no matching form field (unrecognized keys, <root>…):
    // shown as a list, like in JSON mode.
    looseErrors() {
      if (this.mode === 'json') return this.activeFieldErrors;
      return this.activeFieldErrors.filter(
        (e) => !this.knownFieldNames.includes(e.field)
      );
    },
    // Skeleton derived from the descriptor's fields — a starting point for
    // advanced JSON input (§6). Empty object when the schema exposes no fields.
    schemaTemplate() {
      const fields = (this.descriptor && this.descriptor.fields) || [];
      const skeleton = {};
      for (const f of fields) {
        skeleton[f.name] = this.templateValueFor(f.type);
      }
      return skeleton;
    },
    schemaTemplateJson() {
      return JSON.stringify(this.schemaTemplate, null, 2);
    },
  },
  watch: {
    schemaId: {
      immediate: true,
      handler(next, prev) {
        this.loadDescriptor(next, { isChange: !!prev && next !== prev });
      },
    },
    fieldErrors() {
      this.dismissedFields = [];
    },
    value(next) {
      if (this.mode !== 'json') return;
      let shown;
      try {
        shown = JSON.parse(this.jsonDraft || '{}');
      } catch (e) {
        // Draft is mid-edit and invalid — never clobber what is being typed.
        return;
      }
      // Only re-sync when the incoming object is not what the textarea already
      // says, so `onJsonInput` → parent → back here is not a reformat loop.
      if (JSON.stringify(shown) !== JSON.stringify(next || {})) {
        this.jsonDraft = JSON.stringify(next || {}, null, 2);
        this.jsonError = null;
      }
    },
  },
  methods: {
    fieldLabel(name) {
      return humanizeFieldLabel(this, name);
    },
    fieldPlaceholder(name) {
      return fieldPlaceholder(this, name);
    },
    errorMessage(e) {
      return this.$t(`aiPlayground.validation.${e.issue}`, {
        field: this.fieldLabel(e.field),
      });
    },
    async loadDescriptor(schemaId, { isChange }) {
      if (!schemaId) {
        this.descriptor = null;
        this.enterJsonMode();
        this.$emit('descriptor', null);
        return;
      }
      this.loading = true;
      try {
        // fresh on change: never build the form on a stale descriptor.
        this.descriptor = await fetchSchemaDescriptor(this.$axios, schemaId, {
          fresh: isChange,
        });
      } catch (e) {
        this.descriptor = null;
      } finally {
        this.loading = false;
      }
      this.$emit('descriptor', this.descriptor);
      if (!this.formCapable) {
        this.enterJsonMode();
        return;
      }
      if (isChange) {
        this.reconcileSkillChange();
      } else {
        this.mode = 'form';
        this.$emit('valid', true);
      }
    },
    reconcileSkillChange() {
      const { dropped, droppedNonEmpty } = partitionInputKeys(
        this.value,
        this.knownFieldNames,
        this.descriptor
      );
      if (droppedNonEmpty.length) {
        this.pendingDropped = droppedNonEmpty;
        return;
      }
      // Nothing valuable to lose: clean silently and show the form.
      if (dropped.length) this.emitCleanedInput();
      this.mode = 'form';
      this.$emit('valid', true);
    },
    emitCleanedInput() {
      this.$emit(
        'input',
        cleanInput(this.value, this.knownFieldNames, this.descriptor)
      );
    },
    confirmSkillChangeProceed() {
      this.pendingDropped = null;
      this.emitCleanedInput();
      this.mode = 'form';
      this.$emit('valid', true);
    },
    confirmSkillChangeKeepJson() {
      this.pendingDropped = null;
      this.enterJsonMode();
    },
    setFieldValue(name, val) {
      const next = { ...(this.value || {}) };
      if (val === undefined) delete next[name];
      else next[name] = val;
      if (!this.dismissedFields.includes(name)) {
        this.dismissedFields.push(name);
      }
      this.$emit('input', next);
      this.$emit('valid', true);
    },
    enterJsonMode() {
      this.jsonDraft = JSON.stringify(this.value || {}, null, 2);
      this.jsonError = null;
      this.mode = 'json';
      this.$emit('valid', true);
    },
    enterFormMode() {
      if (!this.formCapable || this.jsonError) return;
      this.mode = 'form';
      this.$emit('valid', true);
    },
    onJsonInput(text) {
      this.jsonDraft = text;
      try {
        this.$emit('input', JSON.parse(text || '{}'));
        this.jsonError = null;
        this.$emit('valid', true);
      } catch (e) {
        this.jsonError = e.message;
        this.$emit('valid', false);
      }
    },
    templateValueFor(type) {
      switch (type) {
        case 'number':
          return 0;
        case 'boolean':
          return false;
        case 'array':
          return [];
        case 'object':
          return {};
        default:
          return '';
      }
    },
    insertTemplate() {
      // Merge the skeleton under any keys the user already typed.
      const merged = { ...this.schemaTemplate, ...(this.value || {}) };
      this.jsonDraft = JSON.stringify(merged, null, 2);
      this.jsonError = null;
      this.$emit('input', merged);
      this.$emit('valid', true);
    },
  },
};
</script>

<template>
  <div class="bs-ai-playground-input-form">
    <v-btn-toggle :value="mode" mandatory dense class="mb-2">
      <v-btn
        value="form"
        small
        text
        :disabled="!formCapable || !!jsonError"
        @click="enterFormMode"
      >
        {{ $t('aiPlayground.input.modeForm') }}
      </v-btn>
      <v-btn value="json" small text @click="enterJsonMode">
        {{ $t('aiPlayground.input.modeJson') }}
      </v-btn>
    </v-btn-toggle>

    <v-skeleton-loader v-if="loading" type="paragraph" />

    <template v-else>
      <v-alert
        v-if="descriptor && !formCapable"
        type="info"
        dense
        outlined
        class="mb-3"
      >
        {{ $t('aiPlayground.input.unknownTypeFallback') }}
      </v-alert>

      <v-alert
        v-if="unknownKeys.length"
        type="warning"
        dense
        outlined
        class="mb-3"
      >
        {{
          $t('aiPlayground.input.unknownKeysWarning', {
            keys: unknownKeys.join(', '),
          })
        }}
      </v-alert>

      <v-alert
        v-if="hasManualExpertiseKey"
        type="info"
        dense
        outlined
        class="mb-3"
      >
        {{ $t('aiPlayground.input.manualExpertiseKey') }}
      </v-alert>

      <v-alert
        v-if="looseErrors.length"
        type="error"
        dense
        outlined
        class="mb-3"
      >
        <div v-for="e in looseErrors" :key="e.field">
          {{ errorMessage(e) }}
        </div>
      </v-alert>

      <template v-if="mode === 'form' && descriptor">
        <p
          v-if="descriptor.hasExpertiseField"
          class="text-caption text--secondary mb-2"
        >
          {{ $t('aiPlayground.input.expertiseInjected') }}
        </p>
        <bs-ai-playground-input-field
          v-for="field in descriptor.fields"
          :key="field.name"
          :field="field"
          :value="value ? value[field.name] : undefined"
          :label="fieldLabel(field.name)"
          :placeholder="fieldPlaceholder(field.name)"
          :error-messages="errorsByField[field.name] || []"
          :disabled="disabled"
          @input="setFieldValue(field.name, $event)"
        />
      </template>

      <template v-if="mode === 'json'">
        <bs-textarea
          :value="jsonDraft"
          :rows="8"
          monospace
          :error-messages="
            jsonError ? [$t('aiPlayground.form.inputInvalid')] : []
          "
          :disabled="disabled"
          @input="onJsonInput"
        />
        <div
          v-if="descriptor && descriptor.fields.length"
          class="template-help mt-2"
        >
          <div class="d-flex align-center" style="gap: 0.5rem">
            <span class="text-caption text--secondary">
              {{ $t('aiPlayground.input.templateHelp') }}
            </span>
            <v-btn
              x-small
              text
              color="primary"
              :disabled="disabled"
              @click="insertTemplate"
            >
              {{ $t('aiPlayground.input.insertTemplate') }}
            </v-btn>
          </div>
          <pre class="template-skeleton">{{ schemaTemplateJson }}</pre>
        </div>
      </template>
    </template>

    <bs-ai-playground-skill-change-dialog
      :dropped-fields="pendingDropped"
      @keep-json="confirmSkillChangeKeepJson"
      @proceed="confirmSkillChangeProceed"
    />
  </div>
</template>

<style lang="scss" scoped>
.template-skeleton {
  background: #f5f5f5;
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  margin: 0.25rem 0 0;
  overflow-x: auto;
}
</style>
