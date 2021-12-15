<script>
import * as userStatusHelpers from '~/helpers/user-status.js';
import { mapGetters } from 'vuex';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';

export default {
  name: 'BsUserMenu',
  props: {
    user: { type: Object, default: () => ({ group: {} }) },
    loading: { type: Boolean, default: false },
  },
  data() {
    return {
      dialog: false,
      dialogTitle: '',
      dialogText: '',
      dialogButton: '',
      dialogEventName: '',
    };
  },
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
    statusIcon() {
      return userStatusHelpers.getStatusIcon(this.user.status);
    },
    actionDisplay() {
      return userStatusHelpers.getStatusActions(this.user.status);
    },
    groupAdminUrl() {
      return `/groups/${this.$store.state.user?.info?.group?.id}`;
    },
  },
  methods: {
    showActivateDialog() {
      this.$emit('activate');
    },
    showDeactivateDialog() {
      this.$emit('deactivate');
    },
    showResetPasswordDialog() {
      this.$emit('resetPassword');
    },
    showSendPasswordDialog() {
      this.$emit('sendPassword');
    },
    showReSendPasswordDialog() {
      this.$emit('resendPassword');
    },
  },
};
</script>

<template>
  <v-row>
    <v-col cols="12">
      <v-list>
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
        <v-list-item
          link
          nuxt
          :to="`/groups/${user.group.id}`"
          :disabled="loading"
        >
          <v-list-item-avatar>
            <v-icon color="primary">
              group
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{ user.group.name }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-subheader>{{ $t('global.actions') }}</v-subheader>
        <v-list-item
          v-if="user.isDeactivated"
          link
          @click.stop="showActivateDialog"
        >
          <v-list-item-avatar>
            <v-icon color="accent">
              accessibility
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{ $t('global.enable') }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <template v-if="!user.isDeactivated">
          <!-- send password -->
          <v-list-item
            v-if="actionDisplay.sendPassword"
            link
            @click.stop="showSendPasswordDialog"
          >
            <v-list-item-avatar>
              <v-icon color="accent">
                vpn_key
              </v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>
                {{ $t('users.passwordTooltip.send') }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          <!-- re-send password -->
          <v-list-item
            v-if="actionDisplay.reSendPassword"
            link
            @click.stop="showReSendPasswordDialog"
          >
            <v-list-item-avatar>
              <v-icon color="accent">
                vpn_key
              </v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>
                {{ $t('users.passwordTooltip.resend') }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          <!-- reset password -->
          <v-list-item
            v-if="actionDisplay.resetPassword"
            link
            @click.stop="showResetPasswordDialog"
          >
            <v-list-item-avatar>
              <v-icon color="accent">
                vpn_key
              </v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>
                {{ $t('users.passwordTooltip.reset') }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          <!-- deactivate -->
          <v-list-item
            link
            :disabled="loading"
            color="accent"
            @click.stop="showDeactivateDialog"
          >
            <v-list-item-avatar>
              <v-icon color="accent">
                airline_seat_individual_suite
              </v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>{{ $t('global.disable') }}</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </template>
        <v-subheader>{{ $t('global.status') }}</v-subheader>
        <v-list-item>
          <v-list-item-avatar>
            <v-icon color="secondary">
              {{ statusIcon }}
            </v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>{{ user | userStatus }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-col>
  </v-row>
</template>

<style scoped>
.v-list-item__title {
  font-size: 0.875rem;
}
</style>
