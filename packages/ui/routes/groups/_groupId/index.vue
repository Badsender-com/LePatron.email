<script>
import * as acls from '~/helpers/pages-acls.js';

export default {
  name: 'BsPageGroupRedirect',
  meta: {
    acl: acls.ACL_GROUP_MANAGE,
  },
  middleware({ route, redirect }) {
    // Redirect to the new settings page structure
    const groupId = route.params.groupId;
    return redirect(`/groups/${groupId}/settings/general`);
  },
};
</script>

<template>
  <div />
</template>
