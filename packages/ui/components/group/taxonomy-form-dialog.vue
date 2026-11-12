<script>
import { validationMixin } from 'vuelidate';
import { required, maxLength } from 'vuelidate/lib/validators';
import BsModalForm from '~/components/modal/bs-modal-form.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsTaxonomyFormOrderStatus from '~/components/group/taxonomy-form-order-status.vue';
import BsTaxonomyAvailabilityField from '~/components/group/taxonomy-availability-field.vue';
import BsTaxonomyTokensField from '~/components/group/taxonomy-tokens-field.vue';
import BsTaxonomyCodeField from '~/components/group/taxonomy-code-field.vue';
import {
  TAXONOMY_LIMITS,
  buildTaxonomyPayload,
  canonicalTypeItems,
} from '~/helpers/taxonomy.js';
import { proposeIdentifier } from '~/helpers/taxonomy-builder.js';

function emptyItem() {
  return {
    label: '',
    description: '',
    canonicalType: null,
    isActive: true,
    order: 0,
  };
}

export default {
  name: 'BsTaxonomyFormDialog',
  components: {
    BsModalForm,
    BsTextField,
    BsSelect,
    BsTextarea,
    BsTaxonomyFormOrderStatus,
    BsTaxonomyAvailabilityField,
    BsTaxonomyTokensField,
    BsTaxonomyCodeField,
  },
  mixins: [validationMixin],
  props: {
    loading: { type: Boolean, default: false },
    // The email type maps a value onto the doctrine's six types; any other
    // dimension gives it an identifier of its own.
    isEmailType: { type: Boolean, default: true },
    // The values of the parent dimension, null when the dimension has none.
    parentValues: { type: Array, default: null },
    parentLabel: { type: String, default: '' },
    // The dimension's role: its values then carry a normalised code.
    role: { type: String, default: null },
  },
  data() {
    return {
      form: emptyItem(),
      editingId: null,
      // A refusal the server alone can decide — a label already taken — shown next
      // to the field rather than in a snackbar at the other end of the screen.
      serverLabelError: null,
      serverIdentifierError: null,
      // The identifier follows the label until the admin writes their own.
      identifierTouched: false,
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
    canonicalTypeItems() {
      return canonicalTypeItems(this.form.canonicalType, (key) => this.$t(key));
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
      if (this.isEmailType || this.isEditing || this.identifierTouched) return;
      this.form.canonicalType = proposeIdentifier(label) || null;
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
      this.form = item
        ? {
            label: item.label || '',
            description: item.description || '',
            canonicalType: item.canonicalType || null,
            isActive: item.isActive !== false,
            order: typeof item.order === 'number' ? item.order : 0,
            parentIds: (item._parents || []).map(String),
            tokens: { ...(item.tokens || {}) },
            code: item.code || null,
          }
        : {
            ...emptyItem(),
            order: suggestedOrder,
            parentIds: [],
            tokens: {},
            code: null,
          };
      this.$v.$reset();
      this.$refs.modal.open();
    },

    /**
     * Attach a server-side refusal to its field. Called by the parent, which is
     * the one that talks to the API.
     *
     * @param {string} field `label` or `canonicalType`
     * @param {string} message already translated
     * @returns {boolean} whether this form has that field
     */
    setFieldError(field, message) {
      if (field === 'label') {
        this.serverLabelError = message;
        this.$v.form.label.$touch();
        return true;
      }
      if (field === 'canonicalType' && !this.isEmailType) {
        this.serverIdentifierError = message;
        return true;
      }
      return false;
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

      const payload = buildTaxonomyPayload(this.form);
      if (this.parentValues) payload.parentIds = this.form.parentIds;
      payload.tokens = this.form.tokens;
      if (this.role) payload.code = this.form.code;
      this.$emit('save', { id: this.editingId, payload });
    },
  },
};
</script>

<template>
  <bs-modal-form
    ref="modal"
    :title="title"
    :submit-label="submitLabel"
    :loading="loading"
    width="600"
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

    <bs-select
      v-if="isEmailType"
      v-model="form.canonicalType"
      :label="$t('taxonomy.form.canonicalType')"
      :items="canonicalTypeItems"
      :placeholder="$t('taxonomy.form.canonicalTypePlaceholder')"
      :hint="$t('taxonomy.form.canonicalTypeHint')"
      :disabled="loading"
      clearable
    />
    <!-- Proposed from the label, and the admin's to change: templates compare
         against it, so it is worth reading before saving. -->
    <bs-text-field
      v-else
      :value="form.canonicalType"
      :label="$t('taxonomy.values.form.identifier')"
      :hint="$t('taxonomy.values.form.identifierHint')"
      :error-messages="serverIdentifierError ? [serverIdentifierError] : []"
      :disabled="loading"
      :maxlength="identifierMaxLength"
      persistent-hint
      @input="onIdentifierInput"
    />

    <bs-taxonomy-code-field
      v-if="role"
      v-model="form.code"
      :role="role"
      :disabled="loading"
    />

    <bs-taxonomy-availability-field
      v-if="parentValues"
      v-model="form.parentIds"
      :parent-values="parentValues"
      :parent-label="parentLabel"
      :disabled="loading"
    />

    <bs-taxonomy-tokens-field v-model="form.tokens" :disabled="loading" />

    <bs-taxonomy-form-order-status
      :order.sync="form.order"
      :is-active.sync="form.isActive"
      :active-hint="$t(`${wording}.form.isActiveHint`)"
      :loading="loading"
    />
  </bs-modal-form>
</template>
