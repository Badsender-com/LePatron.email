<script>
import { validationMixin } from 'vuelidate';
import { required, maxLength } from 'vuelidate/lib/validators';
import BsModalForm from '~/components/modal/bs-modal-form.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import { TAXONOMY_LIMITS } from '~/helpers/taxonomy.js';
import { buildDimensionPayload } from '~/helpers/taxonomy-builder.js';

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
    };
  },
  validations: {
    form: {
      label: { required, maxLength: maxLength(TAXONOMY_LIMITS.LABEL) },
      description: { maxLength: maxLength(TAXONOMY_LIMITS.DESCRIPTION) },
    },
  },
  computed: {
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
     * @param {Object} dimension the dimension whose wording to edit
     */
    open(dimension) {
      this.editingId = dimension.id;
      this.form = {
        name: dimension.name,
        label: dimension.label || '',
        description: dimension.description || '',
      };
      this.$v.$reset();
      this.$refs.modal.open();
    },

    close() {
      this.$refs.modal.close();
    },

    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;

      this.$emit('save', {
        id: this.editingId,
        payload: buildDimensionPayload(this.form),
      });
    },
  },
};
</script>

<template>
  <bs-modal-form
    ref="modal"
    :title="$t('taxonomy.dimensions.form.editTitle')"
    :submit-label="$t('global.save')"
    :loading="loading"
    width="600"
    persistent
    @submit="onSubmit"
  >
    <!-- Shown, never editable: templates read this name (ADR-0015). -->
    <bs-text-field
      :value="form.name"
      :label="$t('taxonomy.dimensions.form.name')"
      :hint="$t('taxonomy.dimensions.form.nameHint')"
      persistent-hint
      disabled
    />

    <bs-text-field
      v-model="form.label"
      :label="$t('taxonomy.form.label')"
      :error-messages="labelErrors"
      :disabled="loading"
      required
      autofocus
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
