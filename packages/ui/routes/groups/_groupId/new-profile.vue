<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';

import * as acls from '~/helpers/pages-acls.js';
import ProfileForm from '~/components/profiles/profile-form';
import BsGroupMenu from '~/components/group/menu.vue';

export default {
  name: 'PageNewProfile',
  components: { ProfileForm, BsGroupMenu },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_GROUP_ADMIN,
  },
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <bs-group-menu />
    </template>
    <profile-form />
  </bs-layout-left-menu>
</template>
