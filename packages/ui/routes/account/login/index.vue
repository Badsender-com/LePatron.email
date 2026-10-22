<script>
import { required } from 'vuelidate/lib/validators';
import * as apiRoutes from '~/helpers/api-routes.js';
import { mapMutations } from 'vuex';
import { ArrowLeft, Eye, EyeOff } from 'lucide-vue';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import { IS_BOOTSTRAP_ACCOUNT, USER, USER_SET } from '~/store/user';
import {
  signInStepOf,
  STEP_SIGNED_IN,
  STEP_VERIFY,
  STEP_RECOVERY_CODES,
} from '~/helpers/two-factor.js';
import { takeLogoutReason } from '~/helpers/logout-reason.js';
import BsLoginLogo from '~/components/account/login-logo.vue';
import BsTwoFactorCode from '~/components/account/two-factor-code.vue';
import BsTwoFactorSetup from '~/components/account/two-factor-setup.vue';
import BsRecoveryCodes from '~/components/account/recovery-codes.vue';

export default {
  name: 'BsPageLogin',
  meta: { acl: acls.ACL_NOT_CONNECTED },
  components: {
    BsLoginLogo,
    BsTwoFactorCode,
    BsTwoFactorSetup,
    BsRecoveryCodes,
    LucideArrowLeft: ArrowLeft,
    LucideEye: Eye,
    LucideEyeOff: EyeOff,
  },
  layout: 'centered',
  data() {
    return {
      username: '',
      password: '',
      submitted: false,
      userIsFound: false,
      isBasicAuthentication: true,
      isLoading: false,
      showPassword: false,
      // After the password, with two-factor authentication (ADR 0008): the
      // step the server asks, the member's method, and the account held
      // while its new recovery codes are shown.
      step: null,
      method: null,
      signedIn: null,
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return 'login';
    },
  },
  validations: {
    username: { required },
  },
  mounted() {
    // Check for logout reason cookie
    this.checkLogoutReason();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    checkLogoutReason() {
      const reason = takeLogoutReason();
      if (!reason) return;
      this.showSnackbar({
        text:
          reason === 'session-replaced'
            ? this.$t('global.errors.session.replaced')
            : this.$t('global.errors.session.expired'),
        color: reason === 'session-replaced' ? 'warning' : 'info',
      });
    },
    checkEmailForm: async function () {
      this.submitted = true;
      this.$v.$touch();
      if (this.$v.$invalid) {
        return;
      }

      // move to service
      try {
        this.isLoading = true;
        try {
          const profile = await this.$axios.$get(
            apiRoutes.getPublicProfile({ username: this.username })
          );
          this.isLoading = false;
          if (profile && profile.group && profile.group.isSAMLAuthentication) {
            window.location = `/account/SAML-login?email=${encodeURIComponent(
              this.username
            )}`;
          } else {
            this.isBasicAuthentication = true;
            this.userIsFound = true;
          }
        } catch (err) {
          this.isLoading = false;
          const errorMessage =
            err.response?.status === 429
              ? this.$t('global.errors.tooManyRequests')
              : this.$t('global.errors.errorOccured');
          this.showSnackbar({
            text: errorMessage,
            color: 'error',
          });
        }
      } catch (error) {
        console.error(error);
        this.isLoading = false;
      }
    },
    handleSubmit: async function () {
      try {
        // move to service
        const { $axios, username, password } = this;
        this.isLoading = true;
        try {
          const answer = await $axios.$post('/account/login', {
            username,
            password,
          });
          this.isLoading = false;
          await this.onAnswer(answer);
        } catch (err) {
          this.isLoading = false;
          const errorMessage =
            err.response?.status === 429
              ? this.$t('global.errors.tooManyRequests')
              : this.$t('global.errors.password.error.incorrect');
          this.showSnackbar({
            text: errorMessage,
            color: 'error',
          });
        }
      } catch (error) {
        console.error(error);
        this.isLoading = false;
      }
    },
    async onAnswer(answer) {
      const step = signInStepOf(answer);
      if (step === STEP_SIGNED_IN) return this.signIn(answer);
      if (step === STEP_VERIFY) this.method = answer.twoFactor.method;
      if (step === STEP_RECOVERY_CODES) this.signedIn = answer;
      this.step = step;
    },
    async signIn(user) {
      const { $router } = this;
      // Use action to fetch complete group data with module flags
      await this.$store.dispatch(`${USER}/${USER_SET}`, user);

      // Redirect to home page, which will handle routing to the first
      // enabled module; the bootstrap account, which has no role, stays
      // in the settings (ADR 0002, amended).
      if (this.$store.getters[`${USER}/${IS_BOOTSTRAP_ACCOUNT}`]) {
        await $router.push('/groups');
      } else {
        await $router.push('/');
      }
    },
    // The step ended (expired, too many wrong codes): the password again.
    backToPassword() {
      this.password = '';
      this.step = null;
      this.method = null;
    },
    back: function () {
      this.username = '';
      this.password = '';
      this.userIsFound = false;
      this.isBasicAuthentication = true;
      this.step = null;
      this.method = null;
    },
  },
};
</script>

<template>
  <div style="display: block; margin: 0 auto; text-align: center">
    <bs-login-logo />
    <p style="color: white; font-size: 0.875rem">Email Builder by Badsender</p>
    <v-card class="elevation-24">
      <v-toolbar flat>
        <v-btn
          v-if="userIsFound && isBasicAuthentication"
          color="accent"
          icon
          @click="back"
        >
          <lucide-arrow-left :size="20" />
        </v-btn>
        <v-toolbar-title class="pl-0">
          {{ $t('forms.user.login') }}
        </v-toolbar-title>
      </v-toolbar>
      <v-divider />
      <div v-if="!userIsFound">
        <v-card-text>
          <v-form id="check-email-form" @submit.prevent="checkEmailForm">
            <v-text-field
              v-model="username"
              autofocus
              :label="$t('users.email')"
              name="username"
              prepend-icon="email"
              type="text"
              required
            />
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            :loading="isLoading"
            elevation="0"
            color="accent"
            dark
            form="check-email-form"
            type="submit"
          >
            {{ $t('forms.user.login') }}
          </v-btn>
        </v-card-actions>
      </div>

      <!-- Password field  -->
      <div v-if="userIsFound && isBasicAuthentication && !step">
        <v-card-text>
          <v-form id="login-form" @submit.prevent="handleSubmit">
            <v-text-field
              id="password"
              v-model="password"
              autofocus
              :label="$t('global.password')"
              name="password"
              prepend-icon="lock"
              :type="showPassword ? 'text' : 'password'"
              required
            >
              <template #append>
                <v-btn icon small @click="showPassword = !showPassword">
                  <lucide-eye v-if="showPassword" :size="18" />
                  <lucide-eye-off v-else :size="18" />
                </v-btn>
              </template>
            </v-text-field>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn nuxt text color="primary" to="/account/reset-password">
            {{ $t('forms.user.forgottenPassword') }}
          </v-btn>
          <v-btn
            :loading="isLoading"
            elevation="0"
            color="accent"
            form="login-form"
            type="submit"
          >
            {{ $t('forms.user.login') }}
          </v-btn>
        </v-card-actions>
      </div>

      <!-- After the password (ADR 0008) -->
      <bs-two-factor-code
        v-if="step === 'verify'"
        :method="method"
        @answer="onAnswer"
        @expired="backToPassword"
      />
      <bs-two-factor-setup
        v-if="step === 'setup'"
        @answer="onAnswer"
        @expired="backToPassword"
      />
      <bs-recovery-codes
        v-if="step === 'recovery-codes'"
        :codes="signedIn.recoveryCodes"
        @continue="signIn(signedIn)"
      />
    </v-card>
  </div>
</template>
