<script>
import { validationMixin } from 'vuelidate';
import { required, maxLength } from 'vuelidate/lib/validators';
import BsModalForm from '~/components/modal/bs-modal-form.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsSelect from '~/components/form/bs-select.vue';
import { TAXONOMY_LIMITS } from '~/helpers/taxonomy.js';
import {
  buildDimensionPayload,
  buildNewDimensionPayload,
  isValidDimensionName,
  proposeDimensionName,
} from '~/helpers/taxonomy-builder.js';
import { roleOptions } from '~/helpers/taxonomy-roles.js';
import {
  changedDimensionFields,
  scopeIsFixed,
} from '~/helpers/taxonomy-dimension-form.js';
import BsTaxonomyScopeField from './taxonomy-scope-field.vue';

export default {
  name: 'BsTaxonomyDimensionFormDialog',
  components: {
    BsModalForm,
    BsTextField,
    BsTextarea,
    BsSelect,
    BsTaxonomyScopeField,
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
        role: null,
        scope: 'all',
      },
      // The structural fields as the dialog opened: only changes are sent.
      initial: {},
      editingId: null,
      // The standard dimensions open the list: neither hangs under anything.
      isStandard: false,
      // A name another dimension already holds: the server alone knows.
      serverNameError: null,
      // The name follows the label until the user writes one.
      nameTouched: false,
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
    scopeFixed() {
      return scopeIsFixed({ standard: this.isStandard, role: this.form.role });
    },
    roleItems() {
      return [
        { value: null, text: this.$t('taxonomy.dimensions.form.roleNone') },
        ...roleOptions(this.dimensions, { name: this.form.name }).map(
          (role) => ({
            value: role,
            text: this.$t(`taxonomy.dimensions.roles.${role}`),
          })
        ),
      ];
    },
    // Given by where the dimension is created; moved later on purpose only.
    parentLabel() {
      const parent = this.dimensions.find(
        (dimension) => dimension.name === this.form.parentName
      );
      return parent ? parent.label : '';
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
     * @param {Object} [place] where a new dimension goes
     * @param {string|null} [place.parentName] the dimension it hangs under
     * @param {Object} [place.preset] a suggestion: `{ label, name, role }`
     */
    open(dimension = null, { parentName = null, preset = null } = {}) {
      this.nameTouched = Boolean(preset);
      this.editingId = dimension ? dimension.id : null;
      this.serverNameError = null;
      this.isStandard = Boolean(dimension && dimension.standard);
      this.initial = {
        parentName: dimension ? dimension.parentName || null : null,
        precedence: (dimension && dimension.precedence) || 0,
        role: (dimension && dimension.role) || null,
        scope: (dimension && dimension.scope) || 'all',
      };
      this.form = {
        name: dimension ? dimension.name : '',
        label: dimension ? dimension.label || '' : '',
        description: dimension ? dimension.description || '' : '',
        ...this.initial,
        parentName: dimension ? this.initial.parentName : parentName,
        ...(preset || {}),
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

    onLabelInput(label) {
      if (this.isEditing || this.nameTouched) return;
      this.form.name = proposeDimensionName(label);
    },

    onSubmit() {
      this.serverNameError = null;
      this.$v.$touch();
      if (this.$v.$invalid) return;

      const payload = {
        ...(this.isEditing
          ? buildDimensionPayload(this.form)
          : buildNewDimensionPayload(this.form)),
        ...changedDimensionFields({
          form: this.form,
          initial: this.initial,
          isStandard: this.isStandard,
        }),
      };
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
    <p v-if="!isEditing && form.parentName" class="text-body-2 mb-4">
      {{ $t('taxonomy.dimensions.under', { parent: parentLabel }) }}
    </p>
    <!-- A suggestion's role, shown rather than asked: creating stays three
         fields, and the role is changed in the settings afterwards. -->
    <p v-if="!isEditing && form.role" class="text-body-2 mb-4">
      {{
        $t('taxonomy.dimensions.form.presetRole', {
          role: $t(`taxonomy.dimensions.roles.${form.role}`),
        })
      }}
    </p>

    <bs-text-field
      v-model="form.label"
      :label="$t('taxonomy.form.label')"
      :error-messages="labelErrors"
      :disabled="loading"
      required
      autofocus
      @input="onLabelInput"
      @blur="$v.form.label.$touch()"
    />

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
      @input="
        serverNameError = null;
        nameTouched = true;
      "
      @blur="$v.form.name.$touch()"
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

    <bs-select
      v-if="isEditing && !isStandard"
      v-model="form.role"
      :label="$t('taxonomy.dimensions.form.role')"
      :items="roleItems"
      :hint="$t('taxonomy.dimensions.form.roleHint')"
      :disabled="loading"
      persistent-hint
    />

    <bs-taxonomy-scope-field
      v-if="isEditing && !isStandard"
      v-model="form.scope"
      :fixed="scopeFixed"
      :disabled="loading"
    />
  </bs-modal-form>
</template>
