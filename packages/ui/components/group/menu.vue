<script>
import { mapGetters } from 'vuex';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '../../store/user';

export default {
  name: 'BsGroupMenu',
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
    groupId() {
      return this.$route.params.groupId;
    },
    newTemplateHref() {
      return `/groups/${this.groupId}/new-template`;
    },
    newUserHref() {
      return `/groups/${this.groupId}/new-user`;
    },
    newWorkspaceHref() {
      return `/groups/${this.groupId}/new-workspace`;
    },
    newProfileHref() {
      return `/groups/${this.groupId}/new-profile`;
    },
    newEmailsGroup() {
      return `/groups/${this.groupId}/new-emails-group`;
    },
  },
};
</script>

<template>
  <v-row>
    <v-col cols="12">
      <v-list dense>
        <v-list-item
          v-if="isGroupAdmin || isAdmin"
          nuxt
          class="mb-4"
          link
          to="/"
        >
          <v-list-item-avatar>
            <v-icon>arrow_back</v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>
              {{
                isAdmin ? $t('global.backToGroups') : $t('global.backToMails')
              }}
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>

        <v-subheader>{{ $tc('global.group', 1) }}</v-subheader>
        <v-list-item exact nuxt link :to="`/groups/${groupId}`">
          <v-list-item-avatar>
            <v-icon color="primary">
              info
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>
              {{ $t('groups.tabs.informations') }}
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-subheader>{{ $t('global.actions') }}</v-subheader>
        <v-list-item v-if="isAdmin" nuxt link :to="newTemplateHref">
          <v-list-item-avatar>
            <v-icon color="accent">
              web
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>
              {{ $t('global.newTemplate') }}
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item v-if="isGroupAdmin" nuxt link :to="newWorkspaceHref">
          <v-list-item-avatar>
            <v-icon color="accent">
              group_add
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>
              {{ $t('global.newWorkspace') }}
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item nuxt link :to="newUserHref">
          <v-list-item-avatar>
            <v-icon color="accent">
              person_add
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{ $t('global.newUser') }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item v-if="isAdmin" nuxt link :to="newProfileHref">
          <v-list-item-avatar>
            <v-icon color="accent">
              note_add
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{ $t('global.newProfile') }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item v-if="isGroupAdmin" nuxt link :to="newEmailsGroup">
          <v-list-item-avatar>
            <v-icon color="accent">
              mdi-email-plus
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>
              {{ $t('global.newEmailsGroup') }}
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-col>
  </v-row>
</template>
