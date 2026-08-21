<script>
import { validationMixin } from 'vuelidate';
import { required, maxLength } from 'vuelidate/lib/validators';
import BsModalForm from '~/components/modal/bs-modal-form.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import {
  CANONICAL_TYPES,
  TAXONOMY_LIMITS,
  buildTaxonomyPayload,
} from '~/helpers/taxonomy.js';

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
  },
  mixins: [validationMixin],
  props: {
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      form: emptyItem(),
      editingId: null,
      maxDescriptionLength: TAXONOMY_LIMITS.DESCRIPTION,
      // A refusal the server alone can decide — a label already taken — shown next
      // to the field rather than in a snackbar at the other end of the screen.
      serverLabelError: null,
    };
  },
  validations: {
    form: {
      label: { required, maxLength: maxLength(TAXONOMY_LIMITS.LABEL) },
      description: { maxLength: maxLength(TAXONOMY_LIMITS.DESCRIPTION) },
    },
  },
  computed: {
    isEditing() {
      return this.editingId !== null;
    },
    title() {
      return this.isEditing
        ? this.$t('taxonomy.form.editTitle')
        : this.$t('taxonomy.form.createTitle');
    },
    submitLabel() {
      return this.isEditing ? this.$t('global.save') : this.$t('global.create');
    },
    canonicalTypeItems() {
      return CANONICAL_TYPES.map((value) => ({
        value,
        text: this.$t(`taxonomy.canonicalTypes.${value}`),
      }));
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
  methods: {
    /**
     * @param {Object|null} item the row to edit, or null to create
     * @param {number} [suggestedOrder] pre-filled order for a new item
     */
    open(item = null, suggestedOrder = 0) {
      this.editingId = item ? item.id : null;
      this.serverLabelError = null;
      this.form = item
        ? {
            label: item.label || '',
            description: item.description || '',
            canonicalType: item.canonicalType || null,
            isActive: item.isActive !== false,
            order: typeof item.order === 'number' ? item.order : 0,
          }
        : { ...emptyItem(), order: suggestedOrder };
      this.$v.$reset();
      this.$refs.modal.open();
    },

    /**
     * Attach a server-side refusal to the label field. Called by the parent, which
     * is the one that talks to the API.
     *
     * @param {string} message already translated
     */
    setLabelError(message) {
      this.serverLabelError = message;
      this.$v.form.label.$touch();
    },

    close() {
      this.$refs.modal.close();
    },

    onSubmit() {
      // A previous refusal must not survive a corrected label.
      this.serverLabelError = null;
      this.$v.$touch();
      if (this.$v.$invalid) return;

      this.$emit('save', {
        id: this.editingId,
        payload: buildTaxonomyPayload(this.form),
      });
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
      :placeholder="$t('taxonomy.form.labelPlaceholder')"
      :hint="$t('taxonomy.form.labelHint')"
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
      :placeholder="$t('taxonomy.form.descriptionPlaceholder')"
      :hint="$t('taxonomy.form.descriptionHint')"
      :error-messages="descriptionErrors"
      :counter="maxDescriptionLength"
      :disabled="loading"
      rows="4"
      @blur="$v.form.description.$touch()"
    />

    <bs-select
      v-model="form.canonicalType"
      :label="$t('taxonomy.form.canonicalType')"
      :items="canonicalTypeItems"
      :placeholder="$t('taxonomy.form.canonicalTypePlaceholder')"
      :hint="$t('taxonomy.form.canonicalTypeHint')"
      :disabled="loading"
      clearable
    />

    <!-- Two columns, each with its own label above the control, so this row reads
         like the fields above it rather than as a stray switch. -->
    <div class="taxonomy-form__row">
      <div class="taxonomy-form__col">
        <bs-text-field
          v-model="form.order"
          :label="$t('taxonomy.form.order')"
          :hint="$t('taxonomy.form.orderHint')"
          :disabled="loading"
          type="number"
        />
      </div>

      <!-- A fieldset rather than a bare span: the column needs a heading to line
           up with the label opposite, and a heading a screen reader ignores is
           decoration. -->
      <fieldset class="taxonomy-form__col taxonomy-form__fieldset">
        <legend class="taxonomy-form__label">
          {{ $t('taxonomy.form.status') }}
        </legend>
        <v-switch
          :input-value="form.isActive"
          :label="$t('taxonomy.form.isActive')"
          :disabled="loading"
          color="accent"
          inset
          hide-details
          class="taxonomy-form__switch"
          @change="form.isActive = Boolean($event)"
        />
        <p class="taxonomy-form__hint">
          {{ $t('taxonomy.form.isActiveHint') }}
        </p>
      </fieldset>
    </div>
  </bs-modal-form>
</template>

<style lang="scss" scoped>
.taxonomy-form {
  &__row {
    display: flex;
    align-items: flex-start;
    gap: 1.5rem;
  }

  &__col {
    flex: 1 1 0;
    min-width: 0;
  }

  &__fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }

  // Same typography as the bs-* field labels, so the two columns line up.
  &__label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--gray-700);
    margin-bottom: 0.375rem;
  }

  &__switch {
    margin-top: 0;
    padding-top: 0.375rem;
  }

  &__hint {
    font-size: 0.75rem;
    color: var(--field-placeholder);
    margin: 0.25rem 0 0 0;
    padding-left: 2px;
  }
}
</style>
