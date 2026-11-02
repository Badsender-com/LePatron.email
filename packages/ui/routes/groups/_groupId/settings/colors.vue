<script>
import * as acls from '~/helpers/pages-acls.js';
import { safeFetchGroup } from '~/helpers/safe-fetch-group';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import mixinGroupSettingsSave from '~/helpers/mixins/mixin-group-settings-save.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsGroupColorsTab from '~/components/group/colors-tab.vue';

export default {
  name: 'BsPageSettingsColors',
  components: {
    BsPageHeader,
    BsGroupColorsTab,
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
};
</script>

<template>
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $t('settingsNav.colors') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <bs-group-colors-tab
          v-model="group"
          :disabled="loading"
          :loading="loading"
          @save="updateGroup"
        />
      </div>
    </v-container>
  </div>
</template>
