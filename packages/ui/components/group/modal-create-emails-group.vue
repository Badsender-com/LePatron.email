<script>
import { validationMixin } from 'vuelidate';
import { required, email } from 'vuelidate/lib/validators';
import BsModalConfirm from '~/components/modal-confirm';
import BsTextField from '~/components/form/bs-text-field.vue';

export default {
  name: 'BsModalCreateEmailsGroup',
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
      emailsGroup: {
        name: '',
        emails: '',
      },
    };
  },
  validations() {
    return {
      emailsGroup: {
        name: { required },
        emails: {
          required,
          emailsValid: (val) =>
            val
              ?.split(';')
              ?.map((element) => email(element.trim()))
              ?.every((emailValid) => emailValid === true),
        },
      },
    };
  },
  computed: {
    nameErrors() {
      const errors = [];
      if (!this.$v.emailsGroup.name.$dirty) return errors;
      !this.$v.emailsGroup.name.required &&
        errors.push(this.$t('forms.emailsGroup.errors.name.required'));
      return errors;
    },
    emailsErrors() {
      const errors = [];
      if (!this.$v.emailsGroup.emails.$dirty) return errors;
      !this.$v.emailsGroup.emails.required &&
        errors.push(this.$t('forms.emailsGroup.errors.emails.required'));
      !this.$v.emailsGroup.emails.emailsValid &&
        errors.push(this.$t('forms.emailsGroup.errors.emails.emailsValid'));
      return errors;
    },
  },
  methods: {
    open() {
      this.emailsGroup = { name: '', emails: '' };
      this.$v.$reset();
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit('submit', { ...this.emailsGroup });
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('global.newEmailsGroup')"
    :is-form="true"
    modal-width="500"
  >
    <v-form @submit.prevent="onSubmit">
      <bs-text-field
        v-model="emailsGroup.name"
        :label="$t('global.name')"
        :error-messages="nameErrors"
        :disabled="loading"
        autofocus
        required
        @blur="$v.emailsGroup.name.$touch()"
      />

      <div
        class="bs-textarea"
        :class="{ 'bs-textarea--error': emailsErrors.length > 0 }"
      >
        <label class="bs-textarea__label">
          {{ $t('forms.emailsGroup.emails') }}
          <span class="bs-textarea__required">*</span>
        </label>
        <v-textarea
          v-model="emailsGroup.emails"
          :placeholder="$t('forms.emailsGroup.emailsPlaceholder')"
          :disabled="loading"
          rows="3"
          solo
          flat
          hide-details
          class="bs-textarea__input"
          @input="$v.emailsGroup.emails.$touch()"
          @blur="$v.emailsGroup.emails.$touch()"
        />
        <div v-if="emailsErrors.length > 0" class="bs-textarea__errors">
          <span v-for="(error, index) in emailsErrors" :key="index">{{
            error
          }}</span>
        </div>
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

  &__required {
    color: #f44336;
    margin-left: 2px;
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

      &::placeholder {
        color: rgba(0, 0, 0, 0.38);
        font-size: 0.875rem;
      }
    }
  }

  &__errors {
    margin-top: 4px;
    font-size: 0.75rem;
    color: #f44336;
    display: flex;
    flex-direction: column;
  }

  &--error &__input ::v-deep .v-input__slot {
    border-color: #f44336 !important;
  }
}
</style>
