<script>
import { validationMixin } from 'vuelidate';
import { required, maxLength } from 'vuelidate/lib/validators';
import BsSidePanelForm from '~/components/modal/bs-side-panel-form.vue';
import BsTaxonomyIdentifierImpact from '~/components/group/taxonomy-identifier-impact.vue';
import mixinTaxonomyValueErrors from '~/helpers/mixins/mixin-taxonomy-value-errors.js';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsTaxonomyFormStatus from '~/components/group/taxonomy-form-status.vue';
import BsTaxonomyTokensField from '~/components/group/taxonomy-tokens-field.vue';
import BsTaxonomyCodeField from '~/components/group/taxonomy-code-field.vue';
import { TAXONOMY_LIMITS, doctrineTypeItems } from '~/helpers/taxonomy.js';
import { proposeIdentifier } from '~/helpers/taxonomy-builder.js';
import {
  valueFormFor,
  valuePayloadFrom,
} from '~/helpers/taxonomy-value-form.js';

export default {
  name: 'BsTaxonomyFormDialog',
  components: {
    BsSidePanelForm,
    BsTextField,
    BsSelect,
    BsTextarea,
    BsTaxonomyFormStatus,
    BsTaxonomyTokensField,
    BsTaxonomyCodeField,
    BsTaxonomyIdentifierImpact,
  },
  mixins: [validationMixin, mixinTaxonomyValueErrors],
  props: {
    loading: { type: Boolean, default: false },
    // An email type also carries its doctrine type (ADR-0030).
    isEmailType: { type: Boolean, default: true },
    // The dimension a value hangs under: its crossings are set in the matrix.
    parentLabel: { type: String, default: '' },
    // The dimension's role: its values then carry a normalised code.
    role: { type: String, default: null },
  },
  data() {
    return {
      form: valueFormFor(null),
      editingId: null,
      // The identifier follows the label until the admin writes their own.
      identifierTouched: false,
      // The identifier saved, and whether changing it was confirmed.
      initialIdentifier: null,
      identifierConfirmed: false,
      initialDoctrineType: undefined,
    };
  },
  validations: {
    form: {
      label: { required, maxLength: maxLength(TAXONOMY_LIMITS.LABEL) },
      description: { maxLength: maxLength(TAXONOMY_LIMITS.DESCRIPTION) },
    },
  },
  computed: {
    wording() {
      return this.isEmailType ? 'taxonomy' : 'taxonomy.values';
    },
    // An identifier changed on a saved value: its impact is shown first.
    identifierChanged() {
      return (
        !!this.editingId &&
        !!this.initialIdentifier &&
        this.form.canonicalType !== this.initialIdentifier
      );
    },
    identifierMaxLength() {
      return TAXONOMY_LIMITS.CANONICAL_TYPE;
    },
    isEditing() {
      return this.editingId !== null;
    },
    title() {
      return this.isEditing
        ? this.$t(`${this.wording}.form.editTitle`)
        : this.$t(`${this.wording}.form.createTitle`);
    },
    submitLabel() {
      return this.isEditing ? this.$t('global.save') : this.$t('global.create');
    },
    doctrineTypeItems() {
      return doctrineTypeItems((key) => this.$t(key));
    },
    labelErrors() {
      const errors = [];
      if (this.serverLabelError) errors.push(this.serverLabelError);
      if (!this.$v.form.label.$dirty) return errors;
      if (!this.$v.form.label.required) {
        errors.push(this.$t('taxonomy.form.labelRequired'));
      }
      if (!this.$v.form.label.maxLength) {
        errors.push(
          this.$t('taxonomy.form.labelTooLong', {
            max: TAXONOMY_LIMITS.LABEL,
          })
        );
      }
      return errors;
    },
    descriptionErrors() {
      const errors = [];
      if (!this.$v.form.description.$dirty) return errors;
      if (!this.$v.form.description.maxLength) {
        errors.push(
          this.$t('taxonomy.form.descriptionTooLong', {
            max: TAXONOMY_LIMITS.DESCRIPTION,
          })
        );
      }
      return errors;
    },
  },
  watch: {
    'form.label'(label) {
      if (this.isEditing || this.identifierTouched) return;
      this.form.canonicalType = proposeIdentifier(label) || null;
    },
    // Back to the saved identifier: a later change asks again.
    identifierChanged(changed) {
      if (!changed) this.identifierConfirmed = false;
    },
  },
  methods: {
    /**
     * @param {Object|null} item the row to edit, or null to create
     * @param {number} [suggestedOrder] pre-filled order for a new item
     */
    open(item = null, suggestedOrder = 0) {
      this.editingId = item ? item.id : null;
      this.serverLabelError = null;
      this.serverIdentifierError = null;
      this.identifierTouched = false;
      this.initialIdentifier = (item && item.canonicalType) || null;
      this.initialDoctrineType = item ? item.doctrineType : undefined;
      this.identifierConfirmed = false;
      this.form = valueFormFor(item, suggestedOrder);
      this.$v.$reset();
      this.$refs.modal.open();
    },

    onIdentifierInput(value) {
      this.identifierTouched = true;
      this.serverIdentifierError = null;
      this.form.canonicalType = value || null;
    },

    close() {
      this.$refs.modal.close();
    },

    onSubmit() {
      // A previous refusal must not survive a corrected field.
      this.serverLabelError = null;
      this.serverIdentifierError = null;
      this.$v.$touch();
      if (this.$v.$invalid) return;

      const payload = valuePayloadFrom(this.form, {
        role: this.role,
        isNew: !this.editingId,
        isEmailType: this.isEmailType,
        initialDoctrineType: this.initialDoctrineType,
      });
      if (this.identifierChanged) {
        payload.confirmIdentifierChange = this.identifierConfirmed;
      }
      this.$emit('save', { id: this.editingId, payload });
    },
  },
};
</script>

<template>
  <bs-side-panel-form
    ref="modal"
    :title="title"
    :submit-label="submitLabel"
    :loading="loading"
    width="460"
    persistent
    @submit="onSubmit"
    @cancel="$emit('cancel')"
  >
    <bs-text-field
      v-model="form.label"
      :label="$t('taxonomy.form.label')"
      :placeholder="$t(`${wording}.form.labelPlaceholder`)"
      :hint="$t(`${wording}.form.labelHint`)"
      :error-messages="labelErrors"
      :disabled="loading"
      required
      autofocus
      @input="serverLabelError = null"
      @blur="$v.form.label.$touch()"
    />

    <!-- The definition is the real editorial value of a taxonomy — the company's
         own words for what this typology means — and the future LLM context, so
         it gets room to breathe rather than a single-line field. -->
    <bs-textarea
      v-model="form.description"
      :label="$t('taxonomy.form.description')"
      :placeholder="$t(`${wording}.form.descriptionPlaceholder`)"
      :hint="$t(`${wording}.form.descriptionHint`)"
      :error-messages="descriptionErrors"
      :disabled="loading"
      rows="4"
      @blur="$v.form.description.$touch()"
    />

    <bs-text-field
      :value="form.canonicalType"
      :label="$t('taxonomy.values.form.identifier')"
      :hint="$t('taxonomy.values.form.identifierHint')"
      :error-messages="serverIdentifierError ? [serverIdentifierError] : []"
      :disabled="loading"
      :maxlength="identifierMaxLength"
      persistent-hint
      @input="onIdentifierInput"
    />
    <bs-taxonomy-identifier-impact
      v-if="identifierChanged"
      v-model="identifierConfirmed"
      :item-id="editingId"
      :label="form.label"
      :previous="initialIdentifier"
      :next="form.canonicalType || ''"
      @keep="form.canonicalType = initialIdentifier"
    />

    <bs-select
      v-if="isEmailType"
      v-model="form.doctrineType"
      :label="$t('taxonomy.form.doctrineType')"
      :items="doctrineTypeItems"
      :placeholder="$t('taxonomy.form.doctrineTypeNone')"
      :hint="$t('taxonomy.form.doctrineTypeHint')"
      :disabled="loading"
      persistent-hint
      clearable
    />

    <bs-taxonomy-code-field
      v-if="role"
      v-model="form.code"
      :role="role"
      :disabled="loading"
    />

    <p v-if="!isEmailType" class="taxonomy-form__elsewhere">
      {{
        parentLabel
          ? $t('taxonomy.values.form.crossingsElsewhere', {
              parent: parentLabel,
            })
          : $t('taxonomy.values.form.defaultElsewhere')
      }}
    </p>

    <bs-taxonomy-tokens-field v-model="form.tokens" :disabled="loading" />

    <bs-taxonomy-form-status
      :is-active.sync="form.isActive"
      :active-hint="$t(`${wording}.form.isActiveHint`)"
      :loading="loading"
    />
  </bs-side-panel-form>
</template>

<style lang="scss" scoped>
.taxonomy-form__elsewhere {
  margin: 0 0 16px;
  font-size: 0.75rem;
  color: var(--gray-700);
}
</style>
