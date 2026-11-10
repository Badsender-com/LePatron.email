<script>
// What a feature skill's version holds (ADR 0013): the schemas a LePatron
// feature calls it with, its prompts and its input template, with the
// placeholders the input schema offers. The panel owns the draft and loads
// the schema descriptors; this component only emits the new values.
// A draft may name a schema the code of this instance does not have yet
// (ADR 0019): the field takes it, and says its publication waits for the
// code.
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsCombobox from '~/components/form/bs-combobox.vue';
import copyToClipboard from '~/helpers/copy-to-clipboard.js';
import { missingSchemaIds } from '~/helpers/ai-skill-schemas.js';
import { Check, AlertTriangle } from 'lucide-vue';

// How long a copied chip keeps its confirmation mark.
const COPIED_FEEDBACK_MS = 1500;

export default {
  name: 'BsAiSkillFeatureVersionFields',
  components: {
    BsTextarea,
    BsCombobox,
    LucideCheck: Check,
    LucideAlertTriangle: AlertTriangle,
  },
  props: {
    inputSchemaId: { type: String, default: '' },
    outputSchemaId: { type: String, default: '' },
    systemPrompt: { type: String, default: '' },
    skillBody: { type: String, default: '' },
    inputTemplate: { type: String, default: '' },
    // Schema ids from the zod registry — schemas are versioned (UX review §3).
    schemas: { type: Array, default: () => [] },
    // The input schema's descriptor, null while loading or unknown.
    descriptor: { type: Object, default: null },
    readonly: { type: Boolean, default: false },
  },
  data() {
    return {
      // Held in JS (not inline in the template): a literal `}}` inside a
      // mustache expression breaks the Vue template parser.
      expertiseToken: '{{input.expertise}}',
      // Token of the placeholder chip just copied, and whether the copy
      // failed — the panel has no access to the page snackbar, so the feedback
      // is local to the chip row.
      copiedToken: null,
      copyFailed: false,
    };
  },
  computed: {
    inputSchemas() {
      return this.schemas.filter((s) => /Input$/.test(s));
    },
    outputSchemas() {
      return this.schemas.filter((s) => /Output$/.test(s));
    },
    missingSchemas() {
      return missingSchemaIds(
        {
          inputSchemaId: this.inputSchemaId,
          outputSchemaId: this.outputSchemaId,
        },
        this.schemas
      );
    },
    // Placeholders usable in the input template, derived from the input
    // schema's descriptor (§C2). Null while the descriptor is loading or
    // unknown, so the helper block stays hidden.
    placeholders() {
      const d = this.descriptor;
      if (!d) return null;
      const tokens = (d.fields || []).map((f) => ({
        token: `{{input.${f.name}}}`,
        required: !!f.required,
      }));
      if (d.hasExpertiseField) {
        tokens.push({ token: '{{input.expertise}}', required: false });
      }
      return tokens.length ? tokens : null;
    },
    hasExpertise() {
      return !!(this.descriptor && this.descriptor.hasExpertiseField);
    },
  },
  beforeDestroy() {
    clearTimeout(this.copiedTimer);
  },
  methods: {
    // The placeholders are only ever valid in the input template (the schema's
    // pre('validate') hook rejects them in systemPrompt / skillBody), so the
    // chips just hand the token over — there is no ambiguity about the target
    // field, and nothing to retype by hand.
    async copyPlaceholder(token) {
      const copied = await copyToClipboard(token);
      clearTimeout(this.copiedTimer);
      this.copyFailed = !copied;
      this.copiedToken = copied ? token : null;
      if (copied) {
        this.copiedTimer = setTimeout(() => {
          this.copiedToken = null;
        }, COPIED_FEEDBACK_MS);
      }
    },
  },
};
</script>

<template>
  <div>
    <div class="schema-row">
      <bs-combobox
        :value="inputSchemaId"
        :items="inputSchemas"
        :label="$t('aiSkills.skill.inputSchemaId')"
        :readonly="readonly"
        :disabled="readonly"
        class="schema-input"
        @input="$emit('update:inputSchemaId', $event)"
      />
      <bs-combobox
        :value="outputSchemaId"
        :items="outputSchemas"
        :label="$t('aiSkills.skill.outputSchemaId')"
        :readonly="readonly"
        :disabled="readonly"
        class="schema-output"
        @input="$emit('update:outputSchemaId', $event)"
      />
    </div>
    <p v-if="missingSchemas.length" class="schema-missing" role="status">
      <lucide-alert-triangle :size="14" aria-hidden="true" />
      {{
        $tc('aiSkills.version.schemaNotInCode', missingSchemas.length, {
          ids: missingSchemas.join(', '),
        })
      }}
    </p>
    <p class="text-caption text--secondary schema-help">
      {{ $t('aiSkills.version.schemasHelp') }}
    </p>
    <bs-textarea
      :value="systemPrompt"
      :label="$t('aiSkills.version.systemPrompt')"
      :rows="3"
      :readonly="readonly"
      monospace
      @input="$emit('update:systemPrompt', $event)"
    />
    <bs-textarea
      :value="skillBody"
      :label="$t('aiSkills.version.skillBody')"
      :rows="5"
      :readonly="readonly"
      monospace
      @input="$emit('update:skillBody', $event)"
    />
    <p class="text-caption text--secondary output-format-note">
      {{ $t('aiSkills.version.outputFormatNote') }}
    </p>
    <bs-textarea
      :value="inputTemplate"
      :label="$t('aiSkills.version.inputTemplate')"
      :rows="3"
      :readonly="readonly"
      monospace
      @input="$emit('update:inputTemplate', $event)"
    />
    <div v-if="placeholders" class="placeholder-help mb-3">
      <span class="text-caption text--secondary">
        {{ $t('aiSkills.version.placeholdersHelp') }}
      </span>
      <div class="mt-1">
        <v-chip
          v-for="p in placeholders"
          :key="p.token"
          x-small
          label
          outlined
          class="mr-1 mb-1 placeholder-chip"
          :title="$t('aiSkills.version.placeholderCopyHint')"
          @click="copyPlaceholder(p.token)"
        >
          <code>{{ p.token }}</code>
          <span v-if="p.required" class="placeholder-required ml-1"> * </span>
          <lucide-check
            v-if="copiedToken === p.token"
            :size="12"
            class="ml-1 placeholder-copied"
          />
        </v-chip>
      </div>
      <span v-if="copyFailed" class="text-caption placeholder-copy-failed">
        {{ $t('aiSkills.version.placeholderCopyFailed') }}
      </span>
      <span class="text-caption text--disabled">
        {{ $t('aiSkills.version.placeholdersRequiredHint') }}
      </span>
      <p class="text-caption text--secondary mt-1 mb-0">
        {{ $t('aiSkills.version.placeholdersInvocationNote') }}
        <template v-if="hasExpertise">
          {{
            $t('aiSkills.version.placeholdersExpertiseNote', {
              token: expertiseToken,
            })
          }}
        </template>
      </p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.schema-row {
  display: flex;
  gap: 0.75rem;

  > * {
    flex: 1;
  }
}
.output-format-note {
  margin: -0.25rem 0 0.75rem;
}
.schema-help {
  margin: -0.25rem 0 0.75rem;
}
.schema-missing {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin: -0.25rem 0 0.75rem;
  font-size: 0.75rem;
  color: var(--v-warning-darken3);
}
.placeholder-help {
  margin-top: -0.25rem;

  code {
    font-size: 0.72rem;
    background: none;
    padding: 0;
  }
}
.placeholder-required {
  color: var(--v-error-base, #d32f2f);
  font-weight: 600;
}
.placeholder-chip {
  cursor: pointer;
}
.placeholder-copied {
  color: var(--v-success-base, #4caf50);
}
.placeholder-copy-failed {
  display: block;
  color: var(--v-error-base, #d32f2f);
}
</style>
