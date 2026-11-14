<script>
import { Eye, EyeOff, Lock } from 'lucide-vue';

import BsAuthCard from '~/components/account/auth-card.vue';
import BsTextField from '~/components/form/bs-text-field.vue';

// The password, once the address is known: who signs in, the field with a
// button to show it, and the link to set a new one.
export default {
  name: 'BsLoginPassword',
  components: {
    BsAuthCard,
    BsTextField,
    LucideEye: Eye,
    LucideEyeOff: EyeOff,
    LucideLock: Lock,
  },
  props: {
    value: { type: String, default: '' },
    email: { type: String, required: true },
    loading: { type: Boolean, default: false },
  },
  data() {
    return { showPassword: false };
  },
};
</script>

<template>
  <bs-auth-card
    :title="$t('forms.user.login')"
    :email="email"
    :loading="loading"
    @change-account="$emit('change-account')"
  >
    <template #icon><lucide-lock :size="26" /></template>
    <template #description>{{ $t('authCard.passwordIntro') }}</template>
    <v-form id="login-form" @submit.prevent="$emit('submit')">
      <bs-text-field
        id="password"
        :value="value"
        autofocus
        dense
        :label="$t('global.password')"
        name="password"
        autocomplete="current-password"
        :type="showPassword ? 'text' : 'password'"
        required
        @input="$emit('input', $event)"
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
      <nuxt-link to="/account/reset-password" class="bs-login-password__forgot">
        {{ $t('forms.user.forgottenPassword') }}
      </nuxt-link>
    </v-form>
    <template #actions>
      <v-btn
        :loading="loading"
        elevation="0"
        color="accent"
        form="login-form"
        type="submit"
      >
        {{ $t('forms.user.login') }}
      </v-btn>
    </template>
  </bs-auth-card>
</template>

<style lang="scss" scoped>
.bs-login-password__forgot {
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
