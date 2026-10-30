<script>
// Whether a member set up two-factor authentication, and how (ADR 0008).
export default {
  name: 'BsTwoFactorBadge',
  props: {
    method: { type: String, default: null },
  },
};
</script>

<template>
  <v-chip v-if="method" x-small outlined color="success">
    {{ $t(`twoFactor.users.methods.${method}`) }}
  </v-chip>
  <span v-else class="text--secondary text-caption">
    {{ $t('twoFactor.users.notSetUp') }}
  </span>
</template>
