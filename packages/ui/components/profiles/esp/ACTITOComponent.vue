<script>
import { validationMixin } from 'vuelidate';
import { email, required } from 'vuelidate/lib/validators';
import { CONTENT_ESP_TYPES } from '~/helpers/constants/content-esp-type';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import { ENCODING_TYPE } from '~/helpers/constants/encoding-type';
import { getTableTargetList, getEntitiesList } from '~/helpers/api-routes';

import codes from 'iso-language-codes';

export default {
  name: 'ACTITOComponent',
  mixins: [validationMixin],
  model: { prop: 'profile', event: 'update' },
  props: {
    profileData: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false },
    isLoading: { type: Boolean, default: false },
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
        {
          text: ENCODING_TYPE.UTF_8,
          value: ENCODING_TYPE.UTF_8,
        },
        {
          text: ENCODING_TYPE.ISO_8601,
          value: ENCODING_TYPE.ISO_8601,
        },
      ],
      entities: [],
      targetTables: [],
      submitStatus: null,
      profile: {
        id: this.profileData.id ?? '',
        name: this.profileData.name ?? '',
        /**
         * Database entity (called "entityOfTarget" in Actito API)
         * This is the entity containing the profile tables
         */
        entity: this.profileData.entity ?? '',
        /**
         * Routing entity (called "entity" in Actito API URL path)
         * This is the brand-specific sending configuration
         * Falls back to entity (database entity) for backward compatibility
         */
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
        name: {
          required,
        },
        entity: {
          required,
        },
        targetTable: {
          required,
        },
        supportedLanguage: {
          required,
        },
        encodingType: {
          required,
        },
        apiKey: {
          validateApiKey() {
            if (this.errors.entities) {
              return false;
            }
            return true;
          },
          required,
        },
        senderMail: {
          required,
          email,
        },
        replyTo: {},
        type: {},
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
      if (!this.$v.profile.name.$dirty) return [];
      !this.$v.profile.name.required &&
        errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
    apiKeyErrors() {
      const errors = [];
      if (!this.$v.profile.apiKey.$dirty) return [];
      !this.$v.profile.apiKey.required &&
        errors.push(this.$t('global.errors.apiKeyRequired'));
      !this.$v.profile.apiKey.validateApiKey &&
        errors.push(this.$t('global.errors.apiKeyInvalid'));
      return errors;
    },
    entityErrors() {
      const errors = [];
      if (!this.$v.profile.entity.$dirty) return [];
      !this.$v.profile.entity.required &&
        errors.push(this.$t('global.errors.databaseEntityRequired'));
      return errors;
    },
    targetTableErrors() {
      const errors = [];
      if (!this.$v.profile.targetTable.$dirty) return [];
      !this.$v.profile.targetTable.required &&
        errors.push(this.$t('global.errors.targetTableRequired'));
      return errors;
    },
    senderNameErrors() {
      const errors = [];
      if (!this.$v.profile.senderName.$dirty) return [];
      !this.$v.profile.senderName.required &&
        errors.push(this.$t('global.errors.senderNameRequired'));
      return errors;
    },
    senderMailErrors() {
      const errors = [];
      if (!this.$v.profile.senderMail.$dirty) return [];
      !this.$v.profile.senderMail.required &&
        errors.push(this.$t('global.errors.senderMailRequired'));
      !this.$v.profile.senderMail.email &&
        errors.push(this.$t('forms.user.errors.email.valid'));
      return errors;
    },
    disableEntityField() {
      return this.loading.entities || this.entities.length === 0;
    },
    disableTargetTableField() {
      return this.loading.targetTables || this.targetTables.length === 0;
    },
  },
  async mounted() {
    if (!!this.profile.id && !!this.profile.apiKey && !!this.profile.entity) {
      await this.fetchEntitiesWithApiKey(this.profile.apiKey);
      await this.fetchTargetTables(this.profile.entity, this.profile.apiKey);
      // Initialize routingEntity with entity if not set (backward compatibility)
      if (!this.profile.routingEntity) {
        this.profile.routingEntity = this.profile.entity;
      }
    }
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) {
        console.log({ errors: this.$v });
        return;
      }
      this.$emit('submit', this.profile);
    },
    async fetchTargetTables(entity, apiKey) {
      try {
        const {
          $axios,
          $route: { params },
        } = this;
        this.groupId = params.groupId;
        this.loading.targetTables = true;
        const profileTablesResult = await $axios.$post(getTableTargetList(), {
          apiKey: apiKey,
          entity: entity,
        });
        this.targetTables = profileTablesResult?.result?.profileTableNames?.map(
          (profileTable) => ({
            text: profileTable.name,
            value: profileTable.name,
          })
        );
        this.errors.entities = false;
        this.loading.targetTables = false;
      } catch (e) {
        this.errors.entities = true;
        this.loading.targetTables = true;
      }
    },
    async fetchEntitiesWithApiKey(apiKey) {
      try {
        const {
          $axios,
          $route: { params },
        } = this;
        this.groupId = params.groupId;
        this.loading.entities = true;
        const entitiesResult = await $axios.$post(getEntitiesList(), {
          apiKey: apiKey,
        });
        this.entities = entitiesResult?.result?.entities?.map((entity) => ({
          text: entity.name,
          value: entity.name,
        }));
        this.loading.entities = false;
        this.errors.entities = false;
      } catch (e) {
        this.loading.entities = false;
        this.errors.entities = true;
      }
    },
    async handleApiKeyChange(event) {
      await this.fetchEntitiesWithApiKey(event);
    },
    async handleEntityChange(event) {
      await this.fetchTargetTables(event, this.profile.apiKey);
      // Pre-fill routingEntity with entity if not set
      if (!this.profile.routingEntity) {
        this.profile.routingEntity = event;
      }
    },
  },
};
</script>

<template>
  <v-card flat tile tag="form" :loading="isLoading" :disabled="isLoading">
    <v-card-text>
      <v-row>
        <v-col cols="12">
          <v-text-field
            id="name"
            v-model="profile.name"
            :label="$t('global.profileName')"
            name="name"
            required
            :error-messages="nameErrors"
            @input="$v.profile.name.$touch()"
            @blur="$v.profile.name.$touch()"
          />
        </v-col>
      </v-row>
      <v-row align="center" justify="center">
        <v-col cols="12">
          <v-text-field
            id="apiKey"
            v-model="profile.apiKey"
            :label="$t('global.apiKey')"
            name="apiKey"
            required
            :error-messages="apiKeyErrors"
            @change="handleApiKeyChange"
            @input="$v.profile.apiKey.$touch()"
            @blur="$v.profile.apiKey.$touch()"
          />
        </v-col>
        <v-col cols="1">
          <v-progress-circular
            v-if="loading.entities"
            indeterminate
            color="primary"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <v-select
            v-model="profile.entity"
            :items="entities"
            :error-messages="entityErrors"
            :label="$t('global.databaseEntity')"
            :disabled="disableEntityField"
            @change="handleEntityChange"
          />
        </v-col>
        <v-col cols="1">
          <v-progress-circular
            v-if="loading.targetTables"
            indeterminate
            color="primary"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <v-select
            v-model="profile.targetTable"
            :items="targetTables"
            :error-messages="targetTableErrors"
            :label="$t('global.targetTable')"
            :disabled="disableTargetTableField"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <v-select
            v-model="profile.routingEntity"
            :items="entities"
            :label="$t('global.routingEntity')"
            :hint="$t('global.routingEntityHint')"
            :disabled="disableEntityField"
            persistent-hint
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <v-select
            v-model="profile.encodingType"
            :items="possibleEncodingType"
            :label="$t('global.encodingType')"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <v-select
            v-model="profile.supportedLanguage"
            :items="convertCountriesListPerNames"
            :label="$t('global.supportedLanguage')"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <v-text-field
            id="senderMail"
            v-model="profile.senderMail"
            :label="$t('profiles.senderMail')"
            name="senderMail"
            required
            :error-messages="senderMailErrors"
            @input="$v.profile.senderMail.$touch()"
            @blur="$v.profile.senderMail.$touch()"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="12">
          <v-text-field
            id="replyTo"
            v-model="profile.replyTo"
            :label="$t('profiles.replyTo')"
            name="replyTo"
            @input="$v.profile.replyTo.$touch()"
            @blur="$v.profile.replyTo.$touch()"
          />
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-spacer />
      <v-btn
        elevation="0"
        :loading="isLoading"
        :disabled="disabled"
        color="accent"
        @click="onSubmit"
      >
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
