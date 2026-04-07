<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import BsModalConfirm from '~/components/modal-confirm';

export default {
  name: 'BsModalTagsForm',

  components: {
    BsModalConfirm,
  },
  mixins: [validationMixin],
  props: {
    inputLabel: { type: String, default: '' },
  },
  data() {
    return {
      text: null,
    };
  },
  computed: {
    tagNameErrors() {
      const errors = [];
      if (!this.$v.text.$dirty) return errors;
      !this.$v.text.required &&
        errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
  },
  validations() {
    return {
      text: { required },
    };
  },
  methods: {
    submit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit('confirm', this.text);
      this.close();
    },
    open() {
      this.$refs.deleteDialog.open();
    },
    close() {
      this.$refs.form?.reset();
      this.$refs.deleteDialog.close();
    },
  },
};
</script>
<template>
  <bs-modal-confirm
    ref="deleteDialog"
    :title="$t('tags.new')"
    :is-form="true"
    v-bind="$attrs"
  >
    <v-form ref="form" @submit.prevent="submit">
      <slot />
      <label class="form-label">
        {{ inputLabel }}
        <span class="form-label__required">*</span>
      </label>
      <v-text-field
        v-model="text"
        :error-messages="tagNameErrors"
        solo
        flat
        dense
        hide-details="auto"
        class="form-input"
        @input="$v.text.$touch()"
        @blur="$v.text.$touch()"
      />
      <v-divider class="mt-4" />
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn elevation="0" at color="accent" @click="submit">
          {{ $t('global.createTag') }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.form-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.6);
  margin-bottom: 0.375rem;

  &__required {
    color: #f04e23;
    margin-left: 2px;
  }
}

.form-input {
  &.v-text-field.v-text-field--solo {
    ::v-deep .v-input__slot {
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      background: #fff;
      min-height: 36px;
      padding: 0 12px;
      transition: border-color 0.2s ease;

      &:hover {
        border-color: rgba(0, 0, 0, 0.4);
      }
    }

    &.v-input--is-focused ::v-deep .v-input__slot {
      border-color: var(--v-accent-base);
    }

    &.error--text ::v-deep .v-input__slot {
      border-color: #f04e23;
    }

    ::v-deep input {
      font-size: 0.875rem;
      padding: 6px 0;
    }

    ::v-deep .v-text-field__details {
      padding: 4px 0 0 0;
      min-height: auto;
    }

    ::v-deep .v-messages__message {
      font-size: 0.75rem;
    }
  }
}
</style>
