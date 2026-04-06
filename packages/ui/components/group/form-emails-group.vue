<script>
import { validationMixin } from 'vuelidate';
import { required, email } from 'vuelidate/lib/validators';
import BsTextField from '~/components/form/bs-text-field.vue';

export default {
  name: 'FormEmailGroup',
  components: {
    BsTextField,
  },
  mixins: [validationMixin],
  model: { prop: 'emailsGroup', event: 'update' },
  props: {
    emailsGroup: { type: Object, default: () => ({}) },
    loading: { type: Boolean, default: false },
  },
  validations: () => ({
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
  }),
  computed: {
    localModel: {
      get() {
        return this.emailsGroup;
      },
      set(updatedEmailsGroup) {
        this.$emit('update', updatedEmailsGroup);
      },
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
    nameErrors() {
      const errors = [];
      if (!this.$v.emailsGroup.name.$dirty) return errors;
      !this.$v.emailsGroup.name.required &&
        errors.push(this.$t('forms.emailsGroup.errors.name.required'));
      return errors;
    },
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit('submit', this.emailsGroup);
    },
    onCancel() {
      this.$emit('cancel');
    },
  },
};
</script>

<template>
  <div class="emails-group-form">
    <v-form @submit.prevent="onSubmit">
      <v-row>
        <v-col cols="12" md="6">
          <bs-text-field
            v-model="localModel.name"
            :label="$t('global.name')"
            :error-messages="nameErrors"
            :disabled="loading"
            required
            @blur="$v.emailsGroup.name.$touch()"
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <div
            class="bs-textarea"
            :class="{ 'bs-textarea--error': emailsErrors.length > 0 }"
          >
            <label class="bs-textarea__label">
              {{ $t('forms.emailsGroup.emails') }}
              <span class="bs-textarea__required">*</span>
            </label>
            <v-textarea
              v-model="localModel.emails"
              :placeholder="$t('forms.emailsGroup.emailsPlaceholder')"
              :disabled="loading"
              rows="4"
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
            <p class="bs-textarea__hint">
              {{ $t('forms.emailsGroup.emailsHint') }}
            </p>
          </div>
        </v-col>
      </v-row>

      <!-- Form Actions -->
      <v-divider class="mt-4" />
      <div class="form-actions">
        <v-btn text color="primary" :disabled="loading" @click="onCancel">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn
          type="submit"
          color="accent"
          elevation="0"
          :loading="loading"
          :disabled="loading"
        >
          {{ $t('global.save') }}
        </v-btn>
      </div>
    </v-form>
  </div>
</template>

<style lang="scss" scoped>
.emails-group-form {
  max-width: 800px;
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 0;
}

.bs-textarea {
  margin-bottom: 0.5rem;

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

  &__hint {
    margin-top: 4px;
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.6);
  }

  &--error &__input ::v-deep .v-input__slot {
    border-color: #f44336 !important;
  }
}
</style>
