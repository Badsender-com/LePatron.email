<script>
import { validationMixin } from 'vuelidate';
import { required, maxLength } from 'vuelidate/lib/validators';
import BsModalForm from '~/components/modal/bs-modal-form.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';

// Mirrors the server-side bounds (taxonomy.service.js) so the user is told before
// the request rather than by a 400.
const MAX_LABEL_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;

// Kept in sync with packages/server/constant/email-type-canonical.js. Neither side
// constrains the stored value: the AI skills vocabulary evolves and already falls
// back on the raw string.
const CANONICAL_TYPES = ['promo', 'newsletter', 'transactional'];

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
      maxDescriptionLength: MAX_DESCRIPTION_LENGTH,
    };
  },
  validations: {
    form: {
      label: { required, maxLength: maxLength(MAX_LABEL_LENGTH) },
      description: { maxLength: maxLength(MAX_DESCRIPTION_LENGTH) },
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
      if (!this.$v.form.label.$dirty) return errors;
      if (!this.$v.form.label.required) {
        errors.push(this.$t('taxonomy.form.labelRequired'));
      }
      if (!this.$v.form.label.maxLength) {
        errors.push(
          this.$t('taxonomy.form.labelTooLong', { max: MAX_LABEL_LENGTH })
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
            max: MAX_DESCRIPTION_LENGTH,
          })
        );
      }
      return errors;
    },
  },
  methods: {
    /**
     * @param {Object|null} item the row to edit, or null to create
     */
    open(item = null) {
      this.editingId = item ? item._id || item.id : null;
      this.form = item
        ? {
            label: item.label || '',
            description: item.description || '',
            canonicalType: item.canonicalType || null,
            isActive: item.isActive !== false,
            order: typeof item.order === 'number' ? item.order : 0,
          }
        : emptyItem();
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
        payload: {
          label: this.form.label.trim(),
          // Null rather than '' so an emptied field clears the value server-side
          // instead of storing a blank.
          description: this.form.description ? this.form.description : null,
          canonicalType: this.form.canonicalType || null,
          isActive: this.form.isActive,
          order: Number(this.form.order) || 0,
        },
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

    <div class="taxonomy-form__row">
      <bs-text-field
        v-model="form.order"
        :label="$t('taxonomy.form.order')"
        :hint="$t('taxonomy.form.orderHint')"
        :disabled="loading"
        type="number"
        class="taxonomy-form__order"
      />

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
    </div>
    <p class="taxonomy-form__hint">
      {{ $t('taxonomy.form.isActiveHint') }}
    </p>
  </bs-modal-form>
</template>

<style lang="scss" scoped>
.taxonomy-form {
  &__row {
    display: flex;
    align-items: flex-start;
    gap: 1.5rem;
  }

  &__order {
    max-width: 140px;
  }

  &__switch {
    margin-top: 1.75rem;
  }

  &__hint {
    color: rgba(0, 0, 0, 0.6);
    font-size: 13px;
    margin: 0;
  }
}
</style>
