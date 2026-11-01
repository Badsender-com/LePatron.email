<script>
import { validationMixin } from 'vuelidate';
import { required, maxLength } from 'vuelidate/lib/validators';
import BsModalForm from '~/components/modal/bs-modal-form.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import { TAXONOMY_LIMITS } from '~/helpers/taxonomy.js';
import {
  buildDimensionPayload,
  buildNewDimensionPayload,
  isValidDimensionName,
} from '~/helpers/taxonomy-builder.js';

export default {
  name: 'BsTaxonomyDimensionFormDialog',
  components: {
    BsModalForm,
    BsTextField,
    BsTextarea,
  },
  mixins: [validationMixin],
  props: {
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      form: { name: '', label: '', description: '' },
      editingId: null,
      // A name another dimension already holds: the server alone knows.
      serverNameError: null,
    };
  },
  // A function, so the name is only checked on a creation: an existing name
  // is shown, never sent.
  validations() {
    return {
      form: {
        name: this.isEditing ? {} : { validName: isValidDimensionName },
        label: { required, maxLength: maxLength(TAXONOMY_LIMITS.LABEL) },
        description: { maxLength: maxLength(TAXONOMY_LIMITS.DESCRIPTION) },
      },
    };
  },
  computed: {
    isEditing() {
      return this.editingId !== null;
    },
    nameErrors() {
      const errors = [];
      if (this.serverNameError) errors.push(this.serverNameError);
      if (this.$v.form.name.$dirty && !this.$v.form.name.validName) {
        errors.push(this.$t('taxonomy.dimensions.form.nameInvalid'));
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
      this.form = {
        name: dimension ? dimension.name : '',
        label: dimension ? dimension.label || '' : '',
        description: dimension ? dimension.description || '' : '',
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

      this.$emit('save', {
        id: this.editingId,
        payload: this.isEditing
          ? buildDimensionPayload(this.form)
          : buildNewDimensionPayload(this.form),
      });
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
  </bs-modal-form>
</template>
