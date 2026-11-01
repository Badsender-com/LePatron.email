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
      isSending: false,
    };
  },
  head() {
    return { title: this.$t('oauthConsent.title', { client: this.client }) };
  },
  computed: {
    uid() {
      return this.$route.params.uid;
    },
    client() {
      return this.interaction?.client.name || '';
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
      const [first] = this.interaction.groups;
      this.groupId = first ? first.id : null;
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
    async answer(route, body) {
      this.isSending = true;
      try {
        const { redirectTo } = await this.$axios.$post(route, body);
        // Back to the authorization server, which hands the application its
        // answer.
        window.location.assign(redirectTo);
      } catch (err) {
        this.error = this.errorOf(err);
        this.isSending = false;
      }
    },
    allow() {
      return this.answer(apiRoutes.oauthInteractionConsent(this.uid), {
        groupId: this.groupId,
      });
    },
    deny() {
      return this.answer(apiRoutes.oauthInteractionDeny(this.uid));
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
          <v-alert type="warning" text class="mb-0">
            {{ error }}
          </v-alert>
        </v-card-text>
      </template>
      <template v-else>
        <v-toolbar flat>
          <v-toolbar-title class="pl-0">
            {{ $t('oauthConsent.title', { client }) }}
          </v-toolbar-title>
        </v-toolbar>
        <v-divider />
        <v-card-text>
          <p class="mb-1">{{ $t('oauthConsent.intro', { client }) }}</p>
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
          <v-btn text :disabled="isSending" @click="deny">
            {{ $t('oauthConsent.deny') }}
          </v-btn>
          <v-btn
            color="accent"
            elevation="0"
            :loading="isSending"
            :disabled="!groupId"
            @click="allow"
          >
            {{ $t('oauthConsent.allow') }}
          </v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </div>
</template>
