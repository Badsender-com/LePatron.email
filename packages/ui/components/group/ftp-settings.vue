<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { groupTestFtpConnection } from '~/helpers/api-routes.js';
import { Cable } from 'lucide-vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';

const CREDENTIAL_MASK = '••••••••';

export default {
  name: 'BsFtpSettings',
  components: {
    LucideCable: Cable,
    BsTextField,
    BsSelect,
  },
  mixins: [validationMixin],
  httpOptions: ['http://', 'https://'],
  ftpOptions: ['sftp'],
  ftpAuthOptions: [
    { text: 'Password', value: 'password' },
    { text: 'SSH Key', value: 'ssh_key' },
  ],
  props: {
    value: { type: Object, required: true },
    groupId: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    isEdit: { type: Boolean, default: false },
  },
  data() {
    return {
      isReadOnlyActive: true,
      testingFtpConnection: false,
      ftpConnectionResult: null,
    };
  },
  computed: {
    localModel: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      },
    },
  },
  validations() {
    const ftpCredentialValidation =
      this.value.ftpAuthType === 'ssh_key'
        ? { ftpSshKey: { required } }
        : { ftpPassword: { required } };
    return {
      value: {
        ftpHost: { required },
        ftpUsername: { required },
        ...ftpCredentialValidation,
        ftpPort: { required },
        ftpPathOnServer: { required },
        ftpEndPoint: { required },
        ftpButtonLabel: { required },
      },
    };
  },
  methods: {
    requiredErrors(fieldName) {
      const errors = [];
      if (!this.$v.value[fieldName]?.$dirty) return errors;
      if (!this.$v.value[fieldName]?.required) {
        errors.push(this.$t('global.errors.required'));
      }
      return errors;
    },
    disableReadOnlyAttribute() {
      this.isReadOnlyActive = false;
    },
    validate() {
      this.$v.$touch();
      return !this.$v.$invalid;
    },
    async testFtpConnection() {
      this.testingFtpConnection = true;
      this.ftpConnectionResult = null;
      try {
        const payload = {
          ...this.localModel,
        };
        if (!payload.ftpSshKey || payload.ftpSshKey === CREDENTIAL_MASK)
          delete payload.ftpSshKey;
        if (!payload.ftpPassword || payload.ftpPassword === CREDENTIAL_MASK)
          delete payload.ftpPassword;

        const response = await this.$axios.$post(
          groupTestFtpConnection({ groupId: this.groupId }),
          payload
        );
        this.ftpConnectionResult = response;
      } catch (error) {
        this.ftpConnectionResult = {
          success: false,
          errorCode: error.response?.data?.message,
          message:
            error.response?.data?.message ||
            this.$t('global.errors.errorOccured'),
        };
      } finally {
        this.testingFtpConnection = false;
      }
    },
  },
};
</script>

<template>
  <div class="ftp-settings">
    <!-- Row 1: Server Connection -->
    <v-row>
      <v-col cols="12" md="2">
        <bs-select
          v-model="localModel.ftpProtocol"
          :label="$t('forms.group.ftpProtocol')"
          :disabled="disabled"
          :items="$options.ftpOptions"
        />
      </v-col>
      <v-col cols="12" md="4">
        <bs-text-field
          v-model="localModel.ftpHost"
          :label="$t('forms.group.host')"
          placeholder="ex: 127.0.0.1"
          :error-messages="requiredErrors('ftpHost')"
          :disabled="disabled"
          required
          @blur="$v.value.ftpHost.$touch()"
        />
      </v-col>
      <v-col cols="12" md="2">
        <bs-text-field
          v-model="localModel.ftpPort"
          :label="$t('forms.group.port')"
          placeholder="ex: 22"
          :error-messages="requiredErrors('ftpPort')"
          :disabled="disabled"
          required
          @blur="$v.value.ftpPort.$touch()"
        />
      </v-col>
    </v-row>

    <!-- Row 2: Authentication -->
    <v-row>
      <v-col cols="12" md="3">
        <bs-text-field
          v-model="localModel.ftpUsername"
          autocomplete="username"
          :label="$t('forms.group.username')"
          :error-messages="requiredErrors('ftpUsername')"
          :disabled="disabled"
          :readonly="isReadOnlyActive"
          required
          @focus="disableReadOnlyAttribute"
          @blur="$v.value.ftpUsername.$touch()"
        />
      </v-col>
      <v-col cols="12" md="3">
        <bs-select
          v-model="localModel.ftpAuthType"
          :label="$t('forms.group.ftpAuthType')"
          :disabled="disabled"
          :items="$options.ftpAuthOptions"
        />
      </v-col>
      <v-col
        v-if="!localModel.ftpAuthType || localModel.ftpAuthType === 'password'"
        cols="12"
        md="6"
      >
        <bs-text-field
          v-model="localModel.ftpPassword"
          :readonly="isReadOnlyActive"
          autocomplete="new-password"
          type="password"
          :label="$t('global.password')"
          :error-messages="requiredErrors('ftpPassword')"
          :disabled="disabled"
          required
          @focus="disableReadOnlyAttribute"
          @blur="$v.value.ftpPassword && $v.value.ftpPassword.$touch()"
        />
      </v-col>
      <v-col v-if="localModel.ftpAuthType === 'ssh_key'" cols="12" md="6">
        <div class="bs-textarea">
          <label class="bs-textarea__label">
            {{ $t('forms.group.ftpSshKey') }}
            <span class="bs-textarea__required">*</span>
          </label>
          <v-textarea
            v-model="localModel.ftpSshKey"
            :placeholder="$t('forms.group.ftpSshKeyPlaceholder')"
            rows="3"
            :error-messages="requiredErrors('ftpSshKey')"
            :disabled="disabled"
            solo
            flat
            hide-details="auto"
            class="bs-textarea__input"
            @blur="$v.value.ftpSshKey && $v.value.ftpSshKey.$touch()"
          />
        </div>
      </v-col>
    </v-row>

    <!-- Row 3: Paths & URLs -->
    <v-row>
      <v-col cols="12" md="4">
        <bs-text-field
          v-model="localModel.ftpPathOnServer"
          :label="$t('forms.group.path')"
          placeholder="ex: ./uploads/"
          :error-messages="requiredErrors('ftpPathOnServer')"
          :disabled="disabled"
          required
          @blur="$v.value.ftpPathOnServer.$touch()"
        />
      </v-col>
      <v-col cols="12" md="2">
        <bs-select
          v-model="localModel.ftpEndPointProtocol"
          :label="$t('forms.group.httpProtocol')"
          :disabled="disabled"
          :items="$options.httpOptions"
        />
      </v-col>
      <v-col cols="12" md="6">
        <bs-text-field
          v-model="localModel.ftpEndPoint"
          :label="$t('forms.group.endpoint')"
          placeholder="ex: images.example.com/uploads"
          :error-messages="requiredErrors('ftpEndPoint')"
          :disabled="disabled"
          required
          @blur="$v.value.ftpEndPoint.$touch()"
        />
      </v-col>
    </v-row>

    <!-- Row 4: Display Settings -->
    <v-row>
      <v-col cols="12" md="4">
        <bs-text-field
          v-model="localModel.ftpButtonLabel"
          :label="$t('forms.group.editorLabel')"
          placeholder="ex: HTML avec images"
          :error-messages="requiredErrors('ftpButtonLabel')"
          :disabled="disabled"
          required
          @blur="$v.value.ftpButtonLabel.$touch()"
        />
      </v-col>
    </v-row>

    <!-- Row 5: Test Connection -->
    <v-row v-if="isEdit && groupId">
      <v-col cols="12">
        <v-btn
          outlined
          color="accent"
          :loading="testingFtpConnection"
          :disabled="!localModel.ftpHost || !localModel.ftpUsername"
          @click="testFtpConnection"
        >
          <lucide-cable :size="18" class="mr-2" />
          {{ $t('forms.group.testFtpConnection') }}
        </v-btn>
        <span
          v-if="ftpConnectionResult"
          :class="ftpConnectionResult.success ? 'success--text' : 'error--text'"
          class="ml-3"
        >
          {{
            ftpConnectionResult.success
              ? $t('forms.group.ftpConnectionSuccess')
              : $te(`global.errors.${ftpConnectionResult.errorCode}`)
                ? $t(`global.errors.${ftpConnectionResult.errorCode}`)
                : ftpConnectionResult.message
          }}
        </span>
      </v-col>
    </v-row>
  </div>
</template>

<style lang="scss" scoped>
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
    color: #f04e23;
    margin-left: 2px;
  }

  &__input {
    &.v-textarea.v-text-field--solo {
      ::v-deep .v-input__slot {
        border: 1px solid rgba(0, 0, 0, 0.2);
        border-radius: 4px;
        background: #fff;
        min-height: 40px;
        padding: 8px 12px;
        transition: border-color 0.2s ease;

        &:hover {
          border-color: rgba(0, 0, 0, 0.4);
        }
      }

      &.v-input--is-focused ::v-deep .v-input__slot {
        border-color: #00acdc;
      }

      &.error--text ::v-deep .v-input__slot {
        border-color: #f04e23;
      }

      ::v-deep textarea {
        font-size: 0.875rem;
        line-height: 1.5;
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
}
</style>
