<script>
import * as apiRoutes from '~/helpers/api-routes.js';
import * as acls from '~/helpers/pages-acls.js';
import BsLoginLogo from '~/components/account/login-logo.vue';

// What each scope lets the application do, in the user's words.
const SCOPE_LABELS = {
  'mcp:read': 'oauthConsent.scopes.read',
  'skills:write': 'oauthConsent.scopes.write',
};

// The consent of a connected application (ADR 0012): which application asks,
// what it will be able to do, and the company the connection is bound to.
// The login sends the user back here (shared/access/return-path.js).
export default {
  name: 'BsPageOAuthConsent',
  meta: { acl: acls.ACL_USER },
  components: { BsLoginLogo },
  layout: 'centered',
  data() {
    return {
      interaction: null,
      groupId: null,
      error: null,
      isLoading: true,
      // The answer being sent, 'allow' or 'deny', for its button to spin.
      sending: null,
    };
  },
  head() {
    return {
      title: this.client
        ? this.$t('oauthConsent.title', { client: this.client })
        : this.$t('oauthConsent.pageTitle'),
    };
  },
  computed: {
    uid() {
      return this.$route.params.uid;
    },
    client() {
      return this.interaction?.client.name || '';
    },
    // Logging out comes back here, to consent with another account.
    switchAccountUrl() {
      return `/account/logout?next=${encodeURIComponent(this.$route.path)}`;
    },
    groupName() {
      const group = (this.interaction?.groups || []).find(
        (candidate) => candidate.id === this.groupId
      );
      return group ? group.name : '';
    },
    scopeLabels() {
      return (this.interaction?.scopes || [])
        .filter((scope) => SCOPE_LABELS[scope])
        .map((scope) => this.$t(SCOPE_LABELS[scope]));
    },
  },
  async mounted() {
    try {
      this.interaction = await this.$axios.$get(
        apiRoutes.oauthInteraction(this.uid)
      );
      // A choice of companies is the user's to make: none is picked for them.
      const { groups } = this.interaction;
      this.groupId = groups.length === 1 ? groups[0].id : null;
    } catch (err) {
      this.error = this.errorOf(err);
    } finally {
      this.isLoading = false;
    }
  },
  methods: {
    errorOf(err) {
      const status = err.response?.status;
      const code = err.response?.data?.code;
      // Expired, or started in another browser: the provider tells no more.
      if (status === 404) return this.$t('oauthConsent.expired');
      if (code === 'account_cannot_connect') {
        return this.$t('oauthConsent.accountCannotConnect');
      }
      if (status === 403) return this.$t('oauthConsent.noAccess');
      return this.$t('global.errors.errorOccured');
    },
    async answer(sending, route, body) {
      this.sending = sending;
      try {
        const { redirectTo } = await this.$axios.$post(route, body);
        // Back to the authorization server, which hands the application its
        // answer.
        window.location.assign(redirectTo);
      } catch (err) {
        this.error = this.errorOf(err);
        this.sending = null;
      }
    },
    allow() {
      return this.answer('allow', apiRoutes.oauthInteractionConsent(this.uid), {
        groupId: this.groupId,
      });
    },
    deny() {
      return this.answer('deny', apiRoutes.oauthInteractionDeny(this.uid));
    },
  },
};
</script>

<template>
  <div style="display: block; margin: 0 auto; text-align: center">
    <bs-login-logo />
    <p style="color: white; font-size: 0.875rem">Email Builder by Badsender</p>
    <v-card class="elevation-24 text-left">
      <v-progress-linear v-if="isLoading" indeterminate color="accent" />
      <template v-else-if="error">
        <v-card-text>
          <v-alert type="warning" text class="mb-2">
            {{ error }}
          </v-alert>
          <p class="text-body-2 mb-0">{{ $t('oauthConsent.closeHint') }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text color="primary" :href="switchAccountUrl">
            {{ $t('oauthConsent.switchAccount') }}
          </v-btn>
        </v-card-actions>
      </template>

      <template v-else>
        <v-card-title class="bs-oauth-consent__title">
          <h1 class="text-h6">
            {{ $t('oauthConsent.title', { client }) }}
          </h1>
        </v-card-title>
        <v-divider />
        <v-card-text>
          <p class="mb-1">{{ $t('oauthConsent.intro', { client }) }}</p>
          <p class="text-caption">
            {{
              $t('oauthConsent.account', { email: interaction.account.email })
            }}
            <a :href="switchAccountUrl">{{
              $t('oauthConsent.switchAccount')
            }}</a>
          </p>
          <p class="text-caption">
            {{
              $t('oauthConsent.redirectHost', {
                host: interaction.redirectHost,
              })
            }}
          </p>
          <p class="mb-1">
            {{ $t('oauthConsent.canDo') }}
          </p>
          <ul class="mb-4">
            <li v-for="label in scopeLabels" :key="label">
              {{ label }}
            </li>
          </ul>
          <v-select
            v-if="interaction.groups.length > 1"
            v-model="groupId"
            :items="interaction.groups"
            item-text="name"
            item-value="id"
            :placeholder="$t('oauthConsent.pickGroup')"
            :label="$t('oauthConsent.group')"
            :hint="$t('oauthConsent.groupHint')"
            persistent-hint
            outlined
            dense
          />
          <p v-else class="mb-0">
            <strong>{{ $t('oauthConsent.group') }}</strong>
            <br />
            {{ interaction.groups[0].name }}
            <br />
            <span class="text-caption">{{ $t('oauthConsent.groupHint') }}</span>
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            text
            color="primary"
            :loading="sending === 'deny'"
            :disabled="!!sending"
            @click="deny"
          >
            {{ $t('oauthConsent.deny') }}
          </v-btn>
          <v-btn
            color="accent"
            elevation="0"
            :loading="sending === 'allow'"
            :disabled="!groupId || !!sending"
            @click="allow"
          >
            {{
              groupName
                ? $t('oauthConsent.allowIn', { group: groupName })
                : $t('oauthConsent.allow')
            }}
          </v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </div>
</template>

<style scoped>
/* A long application name wraps rather than hides the end of it. */
.bs-oauth-consent__title h1 {
  word-break: break-word;
  line-height: 1.4;
}
</style>
