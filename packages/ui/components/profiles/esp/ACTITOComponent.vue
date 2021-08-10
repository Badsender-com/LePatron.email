<script>
import { validationMixin } from 'vuelidate';
import { email, required } from 'vuelidate/lib/validators';
import { CONTENT_ESP_TYPES } from '~/helpers/constants/content-esp-type';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import { getTableTargetList, getEntitiesList } from '~/helpers/api-routes';
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
      entities: [],
      targetTables: [],
      submitStatus: null,
      profile: {
        id: this.profileData.id ?? '',
        name: this.profileData.name ?? '',
        entity: this.profileData.entity ?? '',
        targetTable: this.profileData.targetTable ?? '',
        apiKey: this.profileData.apiKey ?? '',
        senderMail: this.profileData.senderMail ?? '',
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
    nameErrors() {
      const errors = [];
      if (!this.$v.profile.name.$dirty) return errors;
      !this.$v.profile.name.required &&
        errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
    apiKeyErrors() {
      const errors = [];
      if (!this.$v.profile.apiKey.$dirty) return errors;
      !this.$v.profile.apiKey.required &&
        errors.push(this.$t('global.errors.apiKeyRequired'));
      !this.$v.profile.apiKey.validateApiKey && errors.push('Api key invalide');
      return errors;
    },
    senderNameErrors() {
      const errors = [];
      if (!this.$v.profile.senderName.$dirty) return errors;
      !this.$v.profile.senderName.required &&
        errors.push(this.$t('global.errors.senderNameRequired'));
      return errors;
    },
    senderMailErrors() {
      const errors = [];
      if (!this.$v.profile.senderMail.$dirty) return errors;
      !this.$v.profile.senderMail.required &&
        errors.push(this.$t('global.errors.senderMailRequired'));
      !this.$v.profile.senderMail.email &&
        errors.push(this.$t('forms.user.errors.email.valid'));
      return errors;
    },
    disableEntityField() {
      return this.loading.entities || this.entities.length === 0;
    },
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) {
        return;
      }
      this.$emit('submit', this.profile);
    },
    async handleApiKeyChange(event) {
      try {
        const {
          $axios,
          $route: { params },
        } = this;
        this.groupId = params.groupId;
        this.loading.entities = true;
        const entitiesResult = await $axios.$post(getEntitiesList(), {
          apiKey: event,
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
    async handleEntityChange(event) {
      try {
        const {
          $axios,
          $route: { params },
        } = this;
        this.groupId = params.groupId;
        this.loading.targetTables = true;
        const profileTablesResult = await $axios.$post(getTableTargetList(), {
          apiKey: this.profile.apiKey,
          entity: event,
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
  },
};
</script>

<template>
  <v-card tag="form" :loading="isLoading" :disabled="isLoading">
    <v-card-text>
      <v-row>
        <v-col cols="11">
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
        <v-col cols="11">
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
        <v-col cols="11">
          <v-select
            v-model="profile.entity"
            :items="entities"
            label="Entity"
            solo
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
        <v-col cols="11">
          <v-select
            v-model="profile.targetTable"
            :items="targetTables"
            label="target Tables"
            solo
            :disabled="disableEntityField"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="11">
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
        <v-col cols="11">
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
      <v-btn
        text
        large
        :loading="isLoading"
        :disabled="disabled"
        color="primary"
        @click="onSubmit"
      >
        sauvegarde
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
