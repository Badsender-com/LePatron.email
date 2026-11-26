<script>
import { validationMixin } from 'vuelidate';
import { required, maxLength, integer } from 'vuelidate/lib/validators';
import BsModalForm from '~/components/modal/bs-modal-form.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsSelect from '~/components/form/bs-select.vue';
import { TAXONOMY_LIMITS } from '~/helpers/taxonomy.js';
import {
  STANDARD_DIMENSIONS,
  buildDimensionPayload,
  buildNewDimensionPayload,
  isValidDimensionName,
  isReservedDimensionName,
  parentCandidates,
} from '~/helpers/taxonomy-builder.js';

export default {
  name: 'BsTaxonomyDimensionFormDialog',
  components: {
    BsModalForm,
    BsTextField,
    BsTextarea,
    BsSelect,
  },
  mixins: [validationMixin],
  props: {
    loading: { type: Boolean, default: false },
    // Every dimension of the company, for the parent a dimension hangs under.
    dimensions: { type: Array, default: () => [] },
  },
  data() {
    return {
      form: {
        name: '',
        label: '',
        description: '',
        parentName: null,
        precedence: 0,
      },
      initialPrecedence: 0,
      editingId: null,
      // The standard dimensions open the list: neither hangs under anything.
      isStandard: false,
      // Sent only when changed: a parent deactivated since must not block an
      // edit of the wording.
      initialParentName: null,
      // A name another dimension already holds: the server alone knows.
      serverNameError: null,
    };
  },
  // A function, so the name is only checked on a creation: an existing name
  // is shown, never sent.
  validations() {
    return {
      form: {
        name: this.isEditing
          ? {}
          : {
              validName: isValidDimensionName,
              notReserved: (name) => !isReservedDimensionName(name),
              maxLength: maxLength(TAXONOMY_LIMITS.DIMENSION_NAME),
            },
        label: { required, maxLength: maxLength(TAXONOMY_LIMITS.LABEL) },
        description: { maxLength: maxLength(TAXONOMY_LIMITS.DESCRIPTION) },
        // Emptied, the field is refused rather than sent as 0.
        precedence: this.carriesTokens ? { required, integer } : {},
      },
    };
  },
  computed: {
    isEditing() {
      return this.editingId !== null;
    },
    // The trigger carries no design token: no precedence to set.
    carriesTokens() {
      return this.form.name !== STANDARD_DIMENSIONS.TRIGGER;
    },
    precedenceErrors() {
      const field = this.$v.form.precedence;
      if (!field.$dirty || !field.$invalid) return [];
      return [this.$t('taxonomy.dimensions.form.precedenceInvalid')];
    },
    parentItems() {
      const byName = new Map(
        this.dimensions.map((dimension) => [dimension.name, dimension])
      );
      const names = parentCandidates(this.dimensions, { name: this.form.name });
      // The parent it hangs under stays shown once deactivated, marked so: the
      // card still says "Under Market", and the select must not show blank.
      // Kept unchanged, it is not sent (onSubmit).
      const current = byName.get(this.initialParentName);
      if (current && !names.includes(current.name)) names.push(current.name);
      return [
        { value: null, text: this.$t('taxonomy.dimensions.form.parentNone') },
        ...names.map((name) => {
          const { label, isActive } = byName.get(name);
          return {
            value: name,
            text: isActive
              ? label
              : this.$t('taxonomy.dimensions.form.parentDeactivated', {
                  label,
                }),
          };
        }),
      ];
    },
    nameErrors() {
      const errors = [];
      if (this.serverNameError) errors.push(this.serverNameError);
      if (!this.$v.form.name.$dirty) return errors;
      if (!this.$v.form.name.validName) {
        errors.push(this.$t('taxonomy.dimensions.form.nameInvalid'));
      }
      if (!this.$v.form.name.notReserved) {
        errors.push(this.$t('taxonomy.errors.dimensionNameReserved'));
      }
      if (!this.$v.form.name.maxLength) {
        errors.push(
          this.$t('taxonomy.errors.dimensionNameTooLong', {
            limit: TAXONOMY_LIMITS.DIMENSION_NAME,
          })
        );
      }
      return errors;
    },
    labelErrors() {
      const errors = [];
      if (!this.$v.form.label.$dirty) return errors;
      if (!this.$v.form.label.required) {
        errors.push(this.$t('taxonomy.form.labelRequired'));
      }
      if (!this.$v.form.label.maxLength) {
        errors.push(
          this.$t('taxonomy.form.labelTooLong', { max: TAXONOMY_LIMITS.LABEL })
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
     * @param {Object|null} dimension the dimension whose wording to edit, or
     *   null to declare one
     */
    open(dimension = null) {
      this.editingId = dimension ? dimension.id : null;
      this.serverNameError = null;
      this.isStandard = Boolean(dimension && dimension.standard);
      this.initialParentName = (dimension && dimension.parentName) || null;
      this.initialPrecedence = (dimension && dimension.precedence) || 0;
      this.form = {
        name: dimension ? dimension.name : '',
        label: dimension ? dimension.label || '' : '',
        description: dimension ? dimension.description || '' : '',
        parentName: this.initialParentName,
        precedence: this.initialPrecedence,
      };
      this.$v.$reset();
      this.$refs.modal.open();
    },

    /**
     * Attach a server-side refusal to its field, when this form has it.
     *
     * @param {string} field
     * @param {string} message already translated
     * @returns {boolean}
     */
    setFieldError(field, message) {
      if (field !== 'name' || this.isEditing) return false;
      this.serverNameError = message;
      return true;
    },

    close() {
      this.$refs.modal.close();
    },

    onSubmit() {
      this.serverNameError = null;
      this.$v.$touch();
      if (this.$v.$invalid) return;

      const payload = this.isEditing
        ? buildDimensionPayload(this.form)
        : buildNewDimensionPayload(this.form);
      if (!this.isStandard && this.form.parentName !== this.initialParentName) {
        payload.parentName = this.form.parentName || null;
      }
      const precedence = Number(this.form.precedence);
      if (this.carriesTokens && precedence !== this.initialPrecedence) {
        payload.precedence = precedence;
      }
      this.$emit('save', { id: this.editingId, payload });
    },
  },
};
</script>

<template>
  <bs-modal-form
    ref="modal"
    :title="
      isEditing
        ? $t('taxonomy.dimensions.form.editTitle')
        : $t('taxonomy.dimensions.form.createTitle')
    "
    :submit-label="isEditing ? $t('global.save') : $t('global.create')"
    :loading="loading"
    width="600"
    persistent
    @submit="onSubmit"
  >
    <!-- Written once, then shown and never editable: templates read this
         name (ADR-0015). -->
    <bs-text-field
      v-if="isEditing"
      :value="form.name"
      :label="$t('taxonomy.dimensions.form.name')"
      :hint="$t('taxonomy.dimensions.form.nameHint')"
      persistent-hint
      disabled
    />
    <bs-text-field
      v-else
      v-model="form.name"
      :label="$t('taxonomy.dimensions.form.name')"
      :placeholder="$t('taxonomy.dimensions.form.namePlaceholder')"
      :hint="$t('taxonomy.dimensions.form.nameCreateHint')"
      :error-messages="nameErrors"
      :disabled="loading"
      persistent-hint
      required
      autofocus
      @input="serverNameError = null"
      @blur="$v.form.name.$touch()"
    />

    <bs-text-field
      v-model="form.label"
      :label="$t('taxonomy.form.label')"
      :error-messages="labelErrors"
      :disabled="loading"
      required
      :autofocus="isEditing"
      @blur="$v.form.label.$touch()"
    />

    <bs-textarea
      v-model="form.description"
      :label="$t('taxonomy.form.description')"
      :hint="$t('taxonomy.dimensions.form.descriptionHint')"
      :error-messages="descriptionErrors"
      :disabled="loading"
      rows="4"
      @blur="$v.form.description.$touch()"
    />

    <!-- The trigger carries no design token: nothing to win. -->
    <bs-text-field
      v-if="carriesTokens"
      v-model="form.precedence"
      :label="$t('taxonomy.dimensions.form.precedence')"
      :hint="$t('taxonomy.dimensions.form.precedenceHint')"
      :error-messages="precedenceErrors"
      :disabled="loading"
      type="number"
      step="1"
      persistent-hint
      @blur="$v.form.precedence.$touch()"
    />

    <bs-select
      v-if="!isStandard"
      v-model="form.parentName"
      :label="$t('taxonomy.dimensions.form.parent')"
      :items="parentItems"
      :hint="$t('taxonomy.dimensions.form.parentHint')"
      :disabled="loading"
    />
  </bs-modal-form>
</template>
