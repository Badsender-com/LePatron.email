<script>
import { validationMixin } from 'vuelidate';
import { email, required } from 'vuelidate/lib/validators';
import { CONTENT_ESP_TYPES } from '~/helpers/constants/content-esp-type';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import { ENCODING_TYPE } from '~/helpers/constants/encoding-type';
import { getTableTargetList, getEntitiesList } from '~/helpers/api-routes';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import { Settings, Mail, Database } from 'lucide-vue';
import codes from 'iso-language-codes';

export default {
  name: 'ACTITOComponent',
  components: {
    BsTextField,
    BsSelect,
    BsFormSection,
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
  <v-card flat tile class="esp-form">
    <v-card-text>
      <!-- API Configuration Section -->
      <bs-form-section>
        <template #icon>
          <lucide-settings :size="20" />
        </template>
        <template #title>
          {{ $t('profiles.apiConfiguration') }}
        </template>
        <template #description>
          {{ $t('profiles.apiConfigurationDescription') }}
        </template>
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
      </bs-form-section>

      <!-- Database Configuration Section -->
      <bs-form-section>
        <template #icon>
          <lucide-database :size="20" />
        </template>
        <template #title>
          {{ $t('profiles.databaseConfiguration') }}
        </template>
        <template #description>
          {{ $t('profiles.databaseConfigurationDescription') }}
        </template>
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
      </bs-form-section>

      <!-- Sender Configuration Section -->
      <bs-form-section last>
        <template #icon>
          <lucide-mail :size="20" />
        </template>
        <template #title>
          {{ $t('profiles.senderConfiguration') }}
        </template>
        <template #description>
          {{ $t('profiles.senderConfigurationDescription') }}
        </template>
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
      </bs-form-section>
    </v-card-text>

    <v-divider />

    <v-card-actions>
      <v-spacer />

      <v-btn
        color="accent"
        elevation="0"
        :loading="isLoading"
        :disabled="disabled"
        @click="onSubmit"
      >
        {{ submitLabel }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<style lang="scss" scoped>
.esp-form {
  margin-top: 1rem;
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
</style>
