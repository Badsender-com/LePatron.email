<script>
import { required } from 'vuelidate/lib/validators';
import * as apiRoutes from '~/helpers/api-routes.js';
import { mapMutations } from 'vuex';
import { ArrowRight, Eye, EyeOff, Lock, LogIn } from 'lucide-vue';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import { IS_BOOTSTRAP_ACCOUNT, USER, USER_SET } from '~/store/user';
import {
  signInStepOf,
  STEP_SIGNED_IN,
  STEP_VERIFY,
  STEP_SETUP,
  STEP_RECOVERY_CODES,
} from '~/helpers/two-factor.js';
import { takeLogoutReason } from '~/helpers/logout-reason.js';
import BsAuthCard from '~/components/account/auth-card.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsTwoFactorCode from '~/components/account/two-factor-code.vue';
import BsTwoFactorSetup from '~/components/account/two-factor-setup.vue';
import BsRecoveryCodes from '~/components/account/recovery-codes.vue';

export default {
  name: 'BsPageLogin',
  meta: { acl: acls.ACL_NOT_CONNECTED },
  components: {
    BsAuthCard,
    BsTextField,
    BsTwoFactorCode,
    BsTwoFactorSetup,
    BsRecoveryCodes,
    LucideArrowRight: ArrowRight,
    LucideEye: Eye,
    LucideEyeOff: EyeOff,
    LucideLock: Lock,
    LucideLogIn: LogIn,
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
      recoveryCodes: [],
      // The recovery codes end the setup, or follow the use of one.
      recoveryAfterSetup: false,
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
      if (step === STEP_RECOVERY_CODES) {
        // Shown once: the codes never reach the store.
        const { recoveryCodes, ...user } = answer;
        this.recoveryCodes = recoveryCodes;
        this.signedIn = user;
        this.recoveryAfterSetup = this.step === STEP_SETUP;
      }
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
  <div class="bs-page-login">
    <!-- Who signs in -->
    <bs-auth-card
      v-if="!userIsFound"
      :title="$t('forms.user.login')"
      :loading="isLoading"
    >
      <template #icon><lucide-log-in :size="26" /></template>
      <template #description>{{ $t('authCard.emailIntro') }}</template>
      <v-form id="check-email-form" @submit.prevent="checkEmailForm">
        <bs-text-field
          v-model="username"
          autofocus
          dense
          :label="$t('users.email')"
          name="username"
          type="email"
          autocomplete="username"
          required
        />
      </v-form>
      <template #actions>
        <v-btn
          :loading="isLoading"
          elevation="0"
          color="accent"
          form="check-email-form"
          type="submit"
        >
          {{ $t('authCard.next') }}
          <lucide-arrow-right :size="16" class="ml-2" />
        </v-btn>
      </template>
    </bs-auth-card>

    <!-- Password field -->
    <bs-auth-card
      v-if="userIsFound && isBasicAuthentication && !step"
      :title="$t('forms.user.login')"
      :email="username"
      :loading="isLoading"
      @change-account="back"
    >
      <template #icon><lucide-lock :size="26" /></template>
      <template #description>{{ $t('authCard.passwordIntro') }}</template>
      <v-form id="login-form" @submit.prevent="handleSubmit">
        <bs-text-field
          id="password"
          v-model="password"
          autofocus
          dense
          :label="$t('global.password')"
          name="password"
          autocomplete="current-password"
          :type="showPassword ? 'text' : 'password'"
          required
        >
          <template #append>
            <v-btn
              icon
              small
              :aria-label="
                showPassword
                  ? $t('authCard.hidePassword')
                  : $t('authCard.showPassword')
              "
              @click="showPassword = !showPassword"
            >
              <lucide-eye v-if="showPassword" :size="18" />
              <lucide-eye-off v-else :size="18" />
            </v-btn>
          </template>
        </bs-text-field>
        <nuxt-link to="/account/reset-password" class="bs-page-login__forgot">
          {{ $t('forms.user.forgottenPassword') }}
        </nuxt-link>
      </v-form>
      <template #actions>
        <v-btn
          :loading="isLoading"
          elevation="0"
          color="accent"
          form="login-form"
          type="submit"
        >
          {{ $t('forms.user.login') }}
        </v-btn>
      </template>
    </bs-auth-card>

    <!-- After the password (ADR 0008) -->
    <bs-two-factor-code
      v-if="step === 'verify'"
      :method="method"
      :email="username"
      @answer="onAnswer"
      @expired="backToPassword"
      @change-account="back"
    />
    <bs-two-factor-setup
      v-if="step === 'setup'"
      :email="username"
      @answer="onAnswer"
      @expired="backToPassword"
    />
    <bs-recovery-codes
      v-if="step === 'recovery-codes'"
      :codes="recoveryCodes"
      :after-setup="recoveryAfterSetup"
      @continue="signIn(signedIn)"
    />
  </div>
</template>

<style lang="scss" scoped>
.bs-page-login__forgot {
  display: inline-block;
  margin-top: 8px;
  color: var(--v-accent-darken1);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;

  &:hover,
  &:focus-visible {
    color: var(--v-primary-base);
    text-decoration: underline;
  }
}
</style>
