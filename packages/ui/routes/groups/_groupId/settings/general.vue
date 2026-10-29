<script>
import { CAPABILITIES } from '../../../../../shared/access/roles.js';
import * as acls from '~/helpers/pages-acls.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import mixinGroupSettingsSave from '~/helpers/mixins/mixin-group-settings-save.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsGroupForm from '~/components/group/form.vue';
import BsGroupTwoFactorOption from '~/components/group/two-factor-option.vue';

export default {
  name: 'BsPageSettingsGeneral',
  components: {
    BsPageHeader,
    BsGroupForm,
    BsGroupTwoFactorOption,
  },
  mixins: [mixinSettingsTitle, mixinGroupSettingsSave],
  meta: {
    acl: acls.ACL_GROUP_MANAGE,
  },
  async asyncData(nuxtContext) {
    return safeFetchGroup(nuxtContext);
  },
  head() {
    return { title: this.settingsTitle };
  },
  computed: {
    // Two-factor authentication for every member is a technical setting
    // (ADR 0008): a company admin does not see it.
    canManageTech() {
      return this.can(CAPABILITIES.GROUP_MANAGE_TECH);
    },
  },
};
</script>

<template>
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $t('groups.tabs.general') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>

    <v-container fluid>
      <bs-group-form
        v-model="group"
        :is-edit="true"
        elevation="0"
        :disabled="loading"
        :loading="loading"
        @submit="updateGroup"
      />
      <bs-group-two-factor-option
        v-if="group.id && canManageTech"
        class="mt-6"
        :group="group"
        @update="group.requireTwoFactor = $event.requireTwoFactor"
      />
    </v-container>
  </div>
</template>
