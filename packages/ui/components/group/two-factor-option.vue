<script>
import { mapGetters, mapMutations } from 'vuex';

import { groupsItem } from '~/helpers/api-routes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { CAN, USER } from '~/store/user';
import { CAPABILITIES } from '../../../shared/access/roles.js';

// Every member of the group signs in with a second factor (ADR 0008).
// Saved on its own: switching it never carries the rest of the form. A
// technical setting: a company admin reads it, a tech admin switches it.
export default {
  name: 'BsGroupTwoFactorOption',
  props: {
    group: { type: Object, required: true },
  },
  data() {
    return { loading: false };
  },
  computed: {
    ...mapGetters(USER, { can: CAN }),
    canSwitch() {
      return this.can(CAPABILITIES.GROUP_MANAGE_TECH);
    },
    // A SAML group leaves the second factor to its identity provider; as
    // the server reads it, an SSO without its certificate is not one.
    isSaml() {
      const { entryPoint, issuer, idpCert } = this.group;
      return Boolean(entryPoint && issuer && idpCert);
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async save(value) {
      this.loading = true;
      try {
        const group = await this.$axios.$put(
          groupsItem({ groupId: this.group.id }),
          { requireTwoFactor: Boolean(value) }
        );
        this.$emit('update', group);
        this.showSnackbar({
          text: this.$t('twoFactor.group.updated'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <section class="bs-group-two-factor-option">
    <h3 class="text-subtitle-1 font-weight-medium">
      {{ $t('twoFactor.group.title') }}
    </h3>
    <p v-if="isSaml" class="text-body-2 text--secondary">
      {{ $t('twoFactor.group.saml') }}
    </p>
    <template v-else>
      <p class="text-body-2 text--secondary">
        {{ $t('twoFactor.group.description') }}
      </p>
      <v-switch
        v-if="canSwitch"
        :input-value="group.requireTwoFactor === true"
        :label="$t('twoFactor.group.switch')"
        :loading="loading"
        :disabled="loading"
        inset
        @change="save"
      />
      <p v-else class="text-body-2">
        {{
          group.requireTwoFactor === true
            ? $t('twoFactor.group.required')
            : $t('twoFactor.group.notRequired')
        }}
        {{ $t('twoFactor.group.managedByTech') }}
      </p>
    </template>
  </section>
</template>
