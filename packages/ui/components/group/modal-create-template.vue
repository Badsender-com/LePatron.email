<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import BsModalConfirm from '~/components/modal-confirm';
import BsTextField from '~/components/form/bs-text-field.vue';

export default {
  name: 'BsModalCreateTemplate',
  components: {
    BsModalConfirm,
    BsTextField,
  },
  mixins: [validationMixin],
  props: {
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      template: {
        name: '',
        description: '',
      },
    };
  },
  validations() {
    return {
      template: {
        name: { required },
      },
    };
  },
  computed: {
    nameErrors() {
      const errors = [];
      if (!this.$v.template.name.$dirty) return errors;
      !this.$v.template.name.required &&
        errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
  },
  methods: {
    open() {
      this.template = { name: '', description: '' };
      this.$v.$reset();
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit('submit', { ...this.template });
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('global.newTemplate')"
    :is-form="true"
    modal-width="500"
  >
    <v-form @submit.prevent="onSubmit">
      <bs-text-field
        v-model="template.name"
        :label="$t('global.name')"
        :error-messages="nameErrors"
        :disabled="loading"
        autofocus
        required
        @blur="$v.template.name.$touch()"
      />

      <div class="bs-textarea">
        <label class="bs-textarea__label">
          {{ $t('global.description') }}
        </label>
        <v-textarea
          v-model="template.description"
          :disabled="loading"
          auto-grow
          rows="2"
          solo
          flat
          hide-details
          class="bs-textarea__input"
        />
      </div>

      <v-divider class="mt-4" />
      <div class="modal-actions">
        <v-btn text color="primary" :disabled="loading" @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn
          type="submit"
          color="accent"
          elevation="0"
          :loading="loading"
          :disabled="loading"
        >
          {{ $t('global.create') }}
        </v-btn>
      </div>
    </v-form>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}

.bs-textarea {
  margin-bottom: 1rem;

  &__label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0.375rem;
  }

  &__input {
    ::v-deep .v-input__slot {
      border: 1px solid rgba(0, 0, 0, 0.2) !important;
      border-radius: 4px;
      background: #fff !important;
      min-height: 40px;
      padding: 8px 12px;
      transition: border-color 0.2s ease;

      &:hover {
        border-color: rgba(0, 0, 0, 0.4) !important;
      }
    }

    &.v-input--is-focused ::v-deep .v-input__slot {
      border-color: #00acdc !important;
    }

    ::v-deep textarea {
      font-size: 0.875rem;
      line-height: 1.5;
    }
  }
}
</style>
