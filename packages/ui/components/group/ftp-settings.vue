<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { groupTestFtpConnection } from '~/helpers/api-routes.js';

const CREDENTIAL_MASK = '••••••••';

export default {
  name: 'BsFtpSettings',
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
          ftpAuthType: this.localModel.ftpAuthType,
          ftpHost: this.localModel.ftpHost,
          ftpPort: this.localModel.ftpPort,
          ftpUsername: this.localModel.ftpUsername,
          ftpProtocol: this.localModel.ftpProtocol,
          ftpPathOnServer: this.localModel.ftpPathOnServer,
        };
        if (
          this.localModel.ftpSshKey &&
          this.localModel.ftpSshKey !== CREDENTIAL_MASK
        ) {
          payload.ftpSshKey = this.localModel.ftpSshKey;
        }
        if (
          this.localModel.ftpPassword &&
          this.localModel.ftpPassword !== CREDENTIAL_MASK
        ) {
          payload.ftpPassword = this.localModel.ftpPassword;
        }
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
        <v-select
          id="ftpProtocol"
          v-model="localModel.ftpProtocol"
          :label="$t('forms.group.ftpProtocol')"
          name="ftpProtocol"
          :disabled="disabled"
          :items="$options.ftpOptions"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-text-field
          id="ftpHost"
          v-model="localModel.ftpHost"
          :label="$t('forms.group.host')"
          placeholder="ex: 127.0.0.1"
          name="ftpHost"
          :error-messages="requiredErrors('ftpHost')"
          :disabled="disabled"
          @input="$v.value.ftpHost.$touch()"
          @blur="$v.value.ftpHost.$touch()"
        />
      </v-col>
      <v-col cols="12" md="2">
        <v-text-field
          id="ftpPort"
          v-model="localModel.ftpPort"
          :label="$t('forms.group.port')"
          placeholder="ex: 22"
          name="ftpPort"
          :error-messages="requiredErrors('ftpPort')"
          :disabled="disabled"
          @input="$v.value.ftpPort.$touch()"
          @blur="$v.value.ftpPort.$touch()"
        />
      </v-col>
    </v-row>

    <!-- Row 2: Authentication -->
    <v-row>
      <v-col cols="12" md="3">
        <v-text-field
          id="ftpUsername"
          v-model="localModel.ftpUsername"
          autocomplete="username"
          :label="$t('forms.group.username')"
          name="ftpUsername"
          :error-messages="requiredErrors('ftpUsername')"
          :disabled="disabled"
          :readonly="isReadOnlyActive"
          @focus="disableReadOnlyAttribute"
          @input="$v.value.ftpUsername.$touch()"
          @blur="$v.value.ftpUsername.$touch()"
        />
      </v-col>
      <v-col cols="12" md="3">
        <v-select
          id="ftpAuthType"
          v-model="localModel.ftpAuthType"
          :label="$t('forms.group.ftpAuthType')"
          name="ftpAuthType"
          :disabled="disabled"
          :items="$options.ftpAuthOptions"
        />
      </v-col>
      <v-col
        v-if="!localModel.ftpAuthType || localModel.ftpAuthType === 'password'"
        cols="12"
        md="6"
      >
        <v-text-field
          id="ftpPassword"
          v-model="localModel.ftpPassword"
          :readonly="isReadOnlyActive"
          autocomplete="new-password"
          type="password"
          :label="$t('global.password')"
          name="ftpPassword"
          :error-messages="requiredErrors('ftpPassword')"
          :disabled="disabled"
          @focus="disableReadOnlyAttribute"
          @input="$v.value.ftpPassword && $v.value.ftpPassword.$touch()"
          @blur="$v.value.ftpPassword && $v.value.ftpPassword.$touch()"
        />
      </v-col>
      <v-col v-if="localModel.ftpAuthType === 'ssh_key'" cols="12" md="6">
        <v-textarea
          id="ftpSshKey"
          v-model="localModel.ftpSshKey"
          :label="$t('forms.group.ftpSshKey')"
          :placeholder="$t('forms.group.ftpSshKeyPlaceholder')"
          name="ftpSshKey"
          rows="3"
          :error-messages="requiredErrors('ftpSshKey')"
          :disabled="disabled"
          @input="$v.value.ftpSshKey && $v.value.ftpSshKey.$touch()"
          @blur="$v.value.ftpSshKey && $v.value.ftpSshKey.$touch()"
        />
      </v-col>
    </v-row>

    <!-- Row 3: Paths & URLs -->
    <v-row>
      <v-col cols="12" md="4">
        <v-text-field
          id="ftpPathOnServer"
          v-model="localModel.ftpPathOnServer"
          :label="$t('forms.group.path')"
          placeholder="ex: ./uploads/"
          name="ftpPathOnServer"
          :error-messages="requiredErrors('ftpPathOnServer')"
          :disabled="disabled"
          @input="$v.value.ftpPathOnServer.$touch()"
          @blur="$v.value.ftpPathOnServer.$touch()"
        />
      </v-col>
      <v-col cols="12" md="2">
        <v-select
          id="ftpEndPointProtocol"
          v-model="localModel.ftpEndPointProtocol"
          :label="$t('forms.group.httpProtocol')"
          name="ftpEndPointProtocol"
          :disabled="disabled"
          :items="$options.httpOptions"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          id="ftpEndPoint"
          v-model="localModel.ftpEndPoint"
          :label="$t('forms.group.endpoint')"
          placeholder="ex: images.example.com/uploads"
          name="ftpEndPoint"
          :error-messages="requiredErrors('ftpEndPoint')"
          :disabled="disabled"
          @input="$v.value.ftpEndPoint.$touch()"
          @blur="$v.value.ftpEndPoint.$touch()"
        />
      </v-col>
    </v-row>

    <!-- Row 4: Display Settings -->
    <v-row>
      <v-col cols="12" md="4">
        <v-text-field
          id="ftpButtonLabel"
          v-model="localModel.ftpButtonLabel"
          :label="$t('forms.group.editorLabel')"
          placeholder="ex: HTML avec images"
          name="ftpButtonLabel"
          :error-messages="requiredErrors('ftpButtonLabel')"
          :disabled="disabled"
          @input="$v.value.ftpButtonLabel.$touch()"
          @blur="$v.value.ftpButtonLabel.$touch()"
        />
      </v-col>
    </v-row>

    <!-- Row 5: Test Connection -->
    <v-row v-if="isEdit && groupId">
      <v-col cols="12">
        <v-btn
          outlined
          color="primary"
          :loading="testingFtpConnection"
          :disabled="!localModel.ftpHost || !localModel.ftpUsername"
          @click="testFtpConnection"
        >
          <v-icon left>
            mdi-connection
          </v-icon>
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
