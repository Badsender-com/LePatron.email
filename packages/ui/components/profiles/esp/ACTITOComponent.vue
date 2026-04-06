<script>
import { validationMixin } from 'vuelidate';
import { email, required } from 'vuelidate/lib/validators';
import { CONTENT_ESP_TYPES } from '~/helpers/constants/content-esp-type';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import { ENCODING_TYPE } from '~/helpers/constants/encoding-type';
import { getTableTargetList, getEntitiesList } from '~/helpers/api-routes';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import { Settings, Mail, Database } from 'lucide-vue';
import codes from 'iso-language-codes';

export default {
  name: 'ACTITOComponent',
  components: {
    BsTextField,
    BsSelect,
    LucideSettings: Settings,
    LucideMail: Mail,
    LucideDatabase: Database,
  },
  mixins: [validationMixin],
  props: {
    profileData: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false },
    isLoading: { type: Boolean, default: false },
    isEdit: { type: Boolean, default: false },
  },
  data() {
    return {
      loading: {
        targetTables: false,
        entities: false,
      },
      errors: {
        targetTables: false,
        entities: false,
      },
      possibleEncodingType: [
        { text: ENCODING_TYPE.UTF_8, value: ENCODING_TYPE.UTF_8 },
        { text: ENCODING_TYPE.ISO_8601, value: ENCODING_TYPE.ISO_8601 },
      ],
      entities: [],
      targetTables: [],
      profile: {
        id: this.profileData.id ?? '',
        name: this.profileData.name ?? '',
        entity: this.profileData.entity ?? '',
        routingEntity: this.profileData.routingEntity ?? '',
        targetTable: this.profileData.targetTable ?? '',
        apiKey: this.profileData.apiKey ?? '',
        senderMail: this.profileData.senderMail ?? '',
        encodingType: this.profileData.encodingType ?? ENCODING_TYPE.UTF_8,
        supportedLanguage: this.profileData.supportedLanguage ?? 'fr',
        contentSendType: CONTENT_ESP_TYPES.MAIL,
        replyTo: this.profileData.replyTo ?? '',
        type: ESP_TYPES.ACTITO,
      },
    };
  },
  validations() {
    return {
      profile: {
        name: { required },
        entity: { required },
        targetTable: { required },
        supportedLanguage: { required },
        encodingType: { required },
        apiKey: {
          required,
          validateApiKey() {
            return !this.errors.entities;
          },
        },
        senderMail: { required, email },
        replyTo: {},
      },
    };
  },
  computed: {
    convertCountriesListPerNames() {
      const convertedCountriesSelectedObject = [];
      const firstElements = ['fr', 'en', 'pt', 'it', 'es', 'de', 'pl', 'ja'];
      for (const language of codes) {
        const convertedElement = {
          text: language.nativeName,
          value: language.iso639_1,
        };
        if (firstElements.includes(language.iso639_1)) {
          convertedCountriesSelectedObject.unshift(convertedElement);
        }
        convertedCountriesSelectedObject.push(convertedElement);
      }
      return convertedCountriesSelectedObject;
    },
    nameErrors() {
      const errors = [];
      if (!this.$v.profile.name.$dirty) return errors;
      if (!this.$v.profile.name.required) {
        errors.push(this.$t('global.errors.nameRequired'));
      }
      return errors;
    },
    apiKeyErrors() {
      const errors = [];
      if (!this.$v.profile.apiKey.$dirty) return errors;
      if (!this.$v.profile.apiKey.required) {
        errors.push(this.$t('global.errors.apiKeyRequired'));
      }
      if (!this.$v.profile.apiKey.validateApiKey) {
        errors.push(this.$t('global.errors.apiKeyInvalid'));
      }
      return errors;
    },
    entityErrors() {
      const errors = [];
      if (!this.$v.profile.entity.$dirty) return errors;
      if (!this.$v.profile.entity.required) {
        errors.push(this.$t('global.errors.databaseEntityRequired'));
      }
      return errors;
    },
    targetTableErrors() {
      const errors = [];
      if (!this.$v.profile.targetTable.$dirty) return errors;
      if (!this.$v.profile.targetTable.required) {
        errors.push(this.$t('global.errors.targetTableRequired'));
      }
      return errors;
    },
    senderMailErrors() {
      const errors = [];
      if (!this.$v.profile.senderMail.$dirty) return errors;
      if (!this.$v.profile.senderMail.required) {
        errors.push(this.$t('global.errors.senderMailRequired'));
      }
      if (!this.$v.profile.senderMail.email) {
        errors.push(this.$t('forms.user.errors.email.valid'));
      }
      return errors;
    },
    disableEntityField() {
      return this.loading.entities || this.entities.length === 0;
    },
    disableTargetTableField() {
      return this.loading.targetTables || this.targetTables.length === 0;
    },
    submitLabel() {
      return this.isEdit ? this.$t('global.save') : this.$t('global.create');
    },
  },
  async mounted() {
    if (this.profile.id && this.profile.apiKey && this.profile.entity) {
      await this.fetchEntitiesWithApiKey(this.profile.apiKey);
      await this.fetchTargetTables(this.profile.entity, this.profile.apiKey);
      if (!this.profile.routingEntity) {
        this.profile.routingEntity = this.profile.entity;
      }
    }
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) {
        return;
      }
      this.$emit('submit', this.profile);
    },
    onCancel() {
      this.$emit('cancel');
    },
    async fetchTargetTables(entity, apiKey) {
      try {
        const { $axios } = this;
        this.loading.targetTables = true;
        const profileTablesResult = await $axios.$post(getTableTargetList(), {
          apiKey,
          entity,
        });
        this.targetTables =
          profileTablesResult?.result?.profileTableNames?.map(
            (profileTable) => ({
              text: profileTable.name,
              value: profileTable.name,
            })
          ) || [];
        this.errors.entities = false;
      } catch (e) {
        this.errors.entities = true;
      } finally {
        this.loading.targetTables = false;
      }
    },
    async fetchEntitiesWithApiKey(apiKey) {
      try {
        const { $axios } = this;
        this.loading.entities = true;
        const entitiesResult = await $axios.$post(getEntitiesList(), {
          apiKey,
        });
        this.entities =
          entitiesResult?.result?.entities?.map((entity) => ({
            text: entity.name,
            value: entity.name,
          })) || [];
        this.errors.entities = false;
      } catch (e) {
        this.errors.entities = true;
      } finally {
        this.loading.entities = false;
      }
    },
    async handleApiKeyChange(event) {
      await this.fetchEntitiesWithApiKey(event);
    },
    async handleEntityChange(event) {
      await this.fetchTargetTables(event, this.profile.apiKey);
      if (!this.profile.routingEntity) {
        this.profile.routingEntity = event;
      }
    },
  },
};
</script>

<template>
  <div class="esp-form">
    <!-- API Configuration Section -->
    <div class="form-section">
      <div class="form-section__header">
        <lucide-settings :size="20" class="form-section__icon" />
        <div>
          <h3 class="form-section__title">
            {{ $t('profiles.apiConfiguration') }}
          </h3>
          <p class="form-section__description">
            {{ $t('profiles.apiConfigurationDescription') }}
          </p>
        </div>
      </div>
      <div class="form-section__content">
        <v-row>
          <v-col cols="12" md="6">
            <bs-text-field
              v-model="profile.name"
              :label="$t('global.profileName')"
              :error-messages="nameErrors"
              :disabled="isLoading"
              required
              @blur="$v.profile.name.$touch()"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <div class="field-with-loader">
              <bs-text-field
                v-model="profile.apiKey"
                :label="$t('global.apiKey')"
                :error-messages="apiKeyErrors"
                :disabled="isLoading"
                required
                @change="handleApiKeyChange"
                @blur="$v.profile.apiKey.$touch()"
              />
              <v-progress-circular
                v-if="loading.entities"
                indeterminate
                color="accent"
                size="24"
                width="2"
                class="field-with-loader__spinner"
              />
            </div>
          </v-col>
        </v-row>
      </div>
    </div>

    <!-- Database Configuration Section -->
    <div class="form-section">
      <div class="form-section__header">
        <lucide-database :size="20" class="form-section__icon" />
        <div>
          <h3 class="form-section__title">
            {{ $t('profiles.databaseConfiguration') }}
          </h3>
          <p class="form-section__description">
            {{ $t('profiles.databaseConfigurationDescription') }}
          </p>
        </div>
      </div>
      <div class="form-section__content">
        <v-row>
          <v-col cols="12" md="6">
            <div class="field-with-loader">
              <bs-select
                v-model="profile.entity"
                :items="entities"
                :error-messages="entityErrors"
                :label="$t('global.databaseEntity')"
                :disabled="disableEntityField || isLoading"
                @change="handleEntityChange"
              />
              <v-progress-circular
                v-if="loading.targetTables"
                indeterminate
                color="accent"
                size="24"
                width="2"
                class="field-with-loader__spinner"
              />
            </div>
          </v-col>
          <v-col cols="12" md="6">
            <bs-select
              v-model="profile.targetTable"
              :items="targetTables"
              :error-messages="targetTableErrors"
              :label="$t('global.targetTable')"
              :disabled="disableTargetTableField || isLoading"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <bs-select
              v-model="profile.routingEntity"
              :items="entities"
              :label="$t('global.routingEntity')"
              :hint="$t('global.routingEntityHint')"
              :disabled="disableEntityField || isLoading"
              persistent-hint
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <bs-select
              v-model="profile.encodingType"
              :items="possibleEncodingType"
              :label="$t('global.encodingType')"
              :disabled="isLoading"
            />
          </v-col>
          <v-col cols="12" md="6">
            <bs-select
              v-model="profile.supportedLanguage"
              :items="convertCountriesListPerNames"
              :label="$t('global.supportedLanguage')"
              :disabled="isLoading"
            />
          </v-col>
        </v-row>
      </div>
    </div>

    <!-- Sender Configuration Section -->
    <div class="form-section">
      <div class="form-section__header">
        <lucide-mail :size="20" class="form-section__icon" />
        <div>
          <h3 class="form-section__title">
            {{ $t('profiles.senderConfiguration') }}
          </h3>
          <p class="form-section__description">
            {{ $t('profiles.senderConfigurationDescription') }}
          </p>
        </div>
      </div>
      <div class="form-section__content">
        <v-row>
          <v-col cols="12" md="6">
            <bs-text-field
              v-model="profile.senderMail"
              :label="$t('profiles.senderMail')"
              :error-messages="senderMailErrors"
              :disabled="isLoading"
              type="email"
              required
              @blur="$v.profile.senderMail.$touch()"
            />
          </v-col>
          <v-col cols="12" md="6">
            <bs-text-field
              v-model="profile.replyTo"
              :label="$t('profiles.replyTo')"
              :disabled="isLoading"
              type="email"
            />
          </v-col>
        </v-row>
      </div>
    </div>

    <!-- Form Actions -->
    <div class="form-actions">
      <v-btn text color="primary" :disabled="isLoading" @click="onCancel">
        {{ $t('global.cancel') }}
      </v-btn>
      <v-btn
        color="accent"
        elevation="0"
        :loading="isLoading"
        :disabled="disabled"
        @click="onSubmit"
      >
        {{ submitLabel }}
      </v-btn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.esp-form {
  margin-top: 1rem;
}

.form-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);

  &:last-of-type {
    border-bottom: none;
  }

  &__header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  &__icon {
    color: var(--v-accent-base);
    margin-top: 2px;
    flex-shrink: 0;
  }

  &__title {
    font-size: 1rem;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.87);
    margin: 0 0 0.25rem 0;
  }

  &__description {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
    margin: 0;
  }

  &__content {
    padding-left: 2rem;
  }
}

.field-with-loader {
  position: relative;

  &__spinner {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 1rem;
  margin-top: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
