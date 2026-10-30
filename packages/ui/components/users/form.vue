<script>
import { mapGetters } from 'vuex';
import { validationMixin } from 'vuelidate';
import { required, email } from 'vuelidate/lib/validators';
import BsTextField from '~/components/form/bs-text-field';
import BsSelect from '~/components/form/bs-select';
import { roleItems } from '~/helpers/constants/roles';
import { USER, USER_CAPABILITIES } from '~/store/user';
import { CAPABILITIES } from '../../../shared/access/roles.js';

export default {
  name: 'BsUserForm',
  components: { BsTextField, BsSelect },
  mixins: [validationMixin],
  model: { prop: 'user', event: 'update' },
  supportedLanguages: [
    { text: 'English', value: 'en' },
    { text: 'Français', value: 'fr' },
  ],
  props: {
    user: { type: Object, default: () => ({}) },
    flat: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    title: { type: String, default: '' },
    // Offers the super admin role: on, choosing another role is a demotion.
    includeSuperAdmin: { type: Boolean, default: false },
  },
  validations() {
    return {
      user: {
        email: { required, email },
        name: { required },
        role: { required },
        externalUsername: {},
      },
    };
  },
  computed: {
    ...mapGetters(USER, { capabilities: USER_CAPABILITIES }),
    roles() {
      return roleItems(this, {
        grantableWith: this.capabilities,
        currentRole: this.user.role,
        includeSuperAdmin: this.includeSuperAdmin,
      });
    },
    // Changing the address of an account that has set up two-factor
    // authentication is a tech admin's (ADR 0008): the server refuses it to
    // a company admin.
    emailLocked() {
      return (
        Boolean(this.user.twoFactorMethod) &&
        !this.capabilities.includes(CAPABILITIES.GROUP_MANAGE_TECH)
      );
    },
    localModel: {
      get() {
        return this.user;
      },
      set(updatedUser) {
        this.$emit('update', updatedUser);
      },
    },
    emailErrors() {
      const errors = [];
      if (!this.$v.user.email.$dirty) return errors;
      !this.$v.user.email.required &&
        errors.push(this.$t('forms.user.errors.email.required'));
      !this.$v.user.email.email &&
        errors.push(this.$t('forms.user.errors.email.valid'));
      return errors;
    },
    nameErrors() {
      const errors = [];
      if (!this.$v.user.name.$dirty) return errors;
      !this.$v.user.name.required &&
        errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
  },
  methods: {
    onSubmit() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      this.$emit('submit', this.user);
    },
  },
};
</script>

<template>
  <v-card flat tile tag="form">
    <v-card-title v-if="title">
      {{ title }}
    </v-card-title>
    <v-card-text>
      <v-row>
        <v-col cols="6">
          <bs-text-field
            id="email"
            v-model="localModel.email"
            :label="$t('users.email')"
            name="email"
            type="email"
            required
            :disabled="emailLocked"
            :hint="emailLocked ? $t('twoFactor.users.emailLocked') : ''"
            :error-messages="emailErrors"
            @input="$v.user.email.$touch()"
            @blur="$v.user.email.$touch()"
          />
        </v-col>
        <v-col cols="6">
          <bs-text-field
            id="name"
            v-model="localModel.name"
            :label="$t('forms.user.name')"
            name="name"
            :error-messages="nameErrors"
            @input="$v.user.name.$touch()"
            @blur="$v.user.name.$touch()"
          />
        </v-col>
        <v-col cols="6">
          <bs-text-field
            id="externalUsername"
            v-model="localModel.externalUsername"
            :label="
              $t('forms.user.externalUsername') + $t('forms.user.optional')
            "
            name="externalUsername"
            @input="$v.user.externalUsername.$touch()"
            @blur="$v.user.externalUsername.$touch()"
          />
        </v-col>
        <v-col cols="6">
          <bs-select
            id="lang"
            v-model="localModel.lang"
            :label="$t('users.lang')"
            name="lang"
            :items="$options.supportedLanguages"
          />
        </v-col>
        <v-col cols="6">
          <bs-select
            id="role"
            v-model="localModel.role"
            :label="$t('users.role')"
            name="role"
            :items="roles"
          />
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-spacer />
      <v-btn
        color="accent"
        elevation="0"
        :disabled="disabled"
        @click="onSubmit"
      >
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
