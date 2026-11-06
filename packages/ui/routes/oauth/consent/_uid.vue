<script>
import {
  AlertTriangle,
  Ban,
  Building2,
  Check,
  Clock,
  Eye,
  Info,
  Link2,
  User,
} from 'lucide-vue';
import * as apiRoutes from '~/helpers/api-routes.js';
import * as acls from '~/helpers/pages-acls.js';
import BsLoginLogo from '~/components/account/login-logo.vue';

const WRITE_SCOPE = 'skills:write';

// Two letters for a name: the application's and the user's avatars.
const initialsOf = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// The consent of a connected application (ADR 0012): which application asks,
// what it will be able to do, and the company the connection is bound to.
// The login sends the user back here (shared/access/return-path.js).
export default {
  name: 'BsPageOAuthConsent',
  meta: { acl: acls.ACL_USER },
  components: {
    BsLoginLogo,
    LucideAlertTriangle: AlertTriangle,
    LucideBan: Ban,
    LucideBuilding2: Building2,
    LucideCheck: Check,
    LucideClock: Clock,
    LucideEye: Eye,
    LucideInfo: Info,
    LucideLink2: Link2,
    LucideUser: User,
  },
  layout: 'centered',
  data() {
    return {
      interaction: null,
      groupId: null,
      error: null,
      isLoading: true,
      // The answer being sent, 'allow' or 'deny', for its button to spin.
      sending: null,
      // Drafting is offered to a super admin, never assumed (ADR 0014).
      allowWrite: false,
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
    isSelfRegistered() {
      return this.interaction?.client.registration === 'dynamic';
    },
    // The name a client gave itself is quoted: it is only what it claims.
    client() {
      const name = this.interaction?.client.name || '';
      return name && this.isSelfRegistered
        ? this.$t('oauthConsent.claimedName', { client: name })
        : name;
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
    // Who vouches for the application's name, shown as a badge: the company
    // that registered it, the host that publishes its identity, or nobody.
    registrationBadge() {
      const client = this.interaction?.client;
      if (client?.registration === 'preRegistered') {
        return this.$t('oauthConsent.registration.preRegistered', {
          company: client.company,
        });
      }
      if (client?.registration === 'metadataDocument') {
        return this.$t('oauthConsent.registration.metadataDocument', {
          host: client.host,
        });
      }
      return this.isSelfRegistered
        ? this.$t('oauthConsent.registration.dynamicBadge')
        : '';
    },
    clientInitials() {
      return initialsOf(this.interaction?.client.name);
    },
    account() {
      return this.interaction?.account || {};
    },
    accountInitials() {
      return initialsOf(this.account.name || this.account.email);
    },
    canWrite() {
      return (this.interaction?.scopes || []).includes(WRITE_SCOPE);
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
      if (code === 'client_of_another_company') {
        return this.$t('oauthConsent.clientOfAnotherCompany');
      }
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
        allowWrite: this.canWrite && this.allowWrite,
      });
    },
    deny() {
      return this.answer('deny', apiRoutes.oauthInteractionDeny(this.uid));
    },
  },
};
</script>

<template>
  <div class="bs-oauth-consent">
    <div class="bs-oauth-consent__brand">
      <bs-login-logo />
      <span>Email Builder by Badsender</span>
    </div>

    <v-card class="bs-oauth-consent__card">
      <v-progress-linear v-if="isLoading" indeterminate color="accent" />

      <template v-else-if="error">
        <div class="bs-oauth-consent__header">
          <span class="bs-oauth-consent__state bs-oauth-consent__state--error">
            <lucide-ban :size="26" />
          </span>
          <h1 class="bs-oauth-consent__heading">
            {{ $t('oauthConsent.errorTitle') }}
          </h1>
          <p class="bs-oauth-consent__message">{{ error }}</p>
          <p class="bs-oauth-consent__note">
            <lucide-info :size="16" />
            <span>{{ $t('oauthConsent.closeHint') }}</span>
          </p>
        </div>
        <div class="bs-oauth-consent__actions">
          <v-btn
            outlined
            color="primary"
            class="text-none"
            :href="switchAccountUrl"
          >
            <lucide-user :size="16" class="mr-2" />
            {{ $t('oauthConsent.switchAccount') }}
          </v-btn>
        </div>
      </template>

      <template v-else>
        <!-- First, when nobody vouches for the name. -->
        <div
          v-if="isSelfRegistered"
          role="alert"
          class="bs-oauth-consent__banner"
        >
          <lucide-alert-triangle :size="18" />
          <span>
            <strong>{{ $t('oauthConsent.registration.dynamicTitle') }}</strong>
            {{ $t('oauthConsent.registration.dynamic') }}
          </span>
        </div>

        <div class="bs-oauth-consent__header">
          <div class="bs-oauth-consent__link" aria-hidden="true">
            <span
              :class="[
                'bs-oauth-consent__tile',
                { 'bs-oauth-consent__tile--unverified': isSelfRegistered },
              ]"
            >
              <span
                class="bs-oauth-consent__avatar bs-oauth-consent__avatar--app"
              >
                {{ clientInitials }}
              </span>
            </span>
            <span class="bs-oauth-consent__chain">
              <span><lucide-link2 :size="16" /></span>
            </span>
            <span class="bs-oauth-consent__tile">
              <img src="/pique_aiguille.svg" alt="" height="36" />
            </span>
          </div>
          <h1 class="bs-oauth-consent__heading">
            {{ $t('oauthConsent.heading', { client }) }}
          </h1>
          <span
            v-if="registrationBadge"
            :class="[
              'bs-oauth-consent__badge',
              isSelfRegistered
                ? 'bs-oauth-consent__badge--warning'
                : 'bs-oauth-consent__badge--success',
            ]"
          >
            <lucide-alert-triangle v-if="isSelfRegistered" :size="12" />
            <lucide-check v-else :size="12" />
            {{ registrationBadge }}
          </span>
        </div>

        <div class="bs-oauth-consent__body">
          <div class="bs-oauth-consent__account">
            <span class="bs-oauth-consent__avatar">{{ accountInitials }}</span>
            <span class="bs-oauth-consent__who">
              <strong>{{ account.name || account.email }}</strong>
              <span v-if="account.name">{{ account.email }}</span>
            </span>
            <a :href="switchAccountUrl">{{
              $t('oauthConsent.changeAccount')
            }}</a>
          </div>

          <section class="bs-oauth-consent__section">
            <h2 class="bs-oauth-consent__label">
              {{ $t('oauthConsent.canDo') }}
            </h2>
            <ul class="bs-oauth-consent__rights">
              <li>
                <span
                  class="bs-oauth-consent__icon bs-oauth-consent__icon--accent"
                >
                  <lucide-eye :size="16" />
                </span>
                <span>
                  <strong>{{ $t('oauthConsent.rights.read') }}</strong>
                  <span>{{ $t('oauthConsent.rights.readHint') }}</span>
                </span>
              </li>
              <li v-if="!canWrite">
                <span class="bs-oauth-consent__icon">
                  <lucide-ban :size="16" />
                </span>
                <span>
                  <strong>{{ $t('oauthConsent.rights.readOnly') }}</strong>
                  <span>{{ $t('oauthConsent.rights.readOnlyHint') }}</span>
                </span>
              </li>
            </ul>
            <label
              v-if="canWrite"
              :class="[
                'bs-oauth-consent__write',
                { 'bs-oauth-consent__write--on': allowWrite },
              ]"
            >
              <input v-model="allowWrite" type="checkbox" />
              <span>
                <strong>{{ $t('oauthConsent.allowWrite') }}</strong>
                <span>{{ $t('oauthConsent.allowWriteHint') }}</span>
              </span>
            </label>
          </section>

          <section class="bs-oauth-consent__section">
            <h2 class="bs-oauth-consent__label">
              {{ $t('oauthConsent.group') }}
            </h2>
            <v-select
              v-if="interaction.groups.length > 1"
              v-model="groupId"
              :items="interaction.groups"
              item-text="name"
              item-value="id"
              :placeholder="$t('oauthConsent.pickGroup')"
              :aria-label="$t('oauthConsent.group')"
              outlined
              dense
              hide-details
            />
            <div v-else class="bs-oauth-consent__company">
              <lucide-building2 :size="18" />
              <strong>{{ interaction.groups[0].name }}</strong>
            </div>
            <p class="bs-oauth-consent__hint">
              {{ $t('oauthConsent.groupHint') }}
            </p>
          </section>

          <p class="bs-oauth-consent__hint bs-oauth-consent__footnote">
            <lucide-clock :size="14" />
            <span>
              {{
                $t('oauthConsent.footnote', { host: interaction.redirectHost })
              }}
            </span>
          </p>
        </div>

        <div class="bs-oauth-consent__actions">
          <v-btn
            text
            color="primary"
            class="text-none"
            :loading="sending === 'deny'"
            :disabled="!!sending"
            @click="deny"
          >
            {{ $t('oauthConsent.deny') }}
          </v-btn>
          <v-btn
            color="accent"
            elevation="0"
            class="text-none"
            :loading="sending === 'allow'"
            :disabled="!groupId || !!sending"
            @click="allow"
          >
            <lucide-check :size="16" class="mr-2" />
            {{
              groupName
                ? $t('oauthConsent.allowIn', { group: groupName })
                : $t('oauthConsent.allow')
            }}
          </v-btn>
        </div>
      </template>
    </v-card>
  </div>
</template>

<style lang="scss" scoped>
// The consent of a connected application, after the LePatron design system:
// a flat white card on the sign-in backdrop, accent for the one action.
.bs-oauth-consent {
  // Out of the login layout's narrow column: 480px, centred on the page.
  position: relative;
  left: 50%;
  width: min(480px, calc(100vw - 32px));
  transform: translateX(-50%);
  color: rgba(0, 0, 0, 0.87);

  &__brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-bottom: 24px;
    color: #cfdbe1;
    font-size: 12px;
  }

  &__card.v-card {
    border-radius: var(--r-md);
    box-shadow: 0 12px 32px rgba(13, 43, 62, 0.18);
    overflow: hidden;
  }

  &__banner {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 16px 32px;
    background: rgba(255, 180, 0, 0.14);
    border-bottom: 1px solid rgba(255, 180, 0, 0.35);
    font-size: 13px;
    line-height: 1.5;

    svg {
      flex-shrink: 0;
      margin-top: 1px;
      color: #b07400;
    }

    strong {
      display: block;
      font-size: 14px;
    }
  }

  &__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 32px 32px 24px;
    text-align: center;
  }

  &__link {
    display: flex;
    align-items: center;
  }

  &__tile {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    box-sizing: border-box;
    border: 1px solid var(--gray-200);
    border-radius: 7px;
    background: #f9fafb;

    &--unverified {
      border: 1px dashed var(--gray-400);
    }
  }

  &__chain {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 88px;

    &::before {
      content: '';
      position: absolute;
      left: 8px;
      right: 8px;
      top: 50%;
      border-top: 2px dashed var(--gray-300);
    }

    span {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 1px solid var(--gray-300);
      border-radius: var(--r-pill);
      background: #fff;
      color: #0091b8;
    }
  }

  &__avatar {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--v-primary-base);
    color: #fff;
    font-size: 14px;
    font-weight: 600;

    &--app {
      width: 40px;
      height: 40px;
      background: #265090;
      font-size: 15px;
    }
  }

  &__heading {
    margin: 0;
    color: var(--v-primary-base);
    font-size: 20px;
    font-weight: 600;
    line-height: 1.3;
    word-break: break-word;
  }

  &__message {
    max-width: 360px;
    margin: 0;
    color: var(--gray-700);
    font-size: 14px;
  }

  &__state {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: var(--r-pill);

    &--error {
      background: rgba(240, 78, 35, 0.12);
      color: #c53a12;
    }
  }

  &__note {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    width: 100%;
    margin: 0;
    padding: 12px 16px;
    box-sizing: border-box;
    border: 1px solid var(--gray-200);
    border-radius: 7px;
    background: #f9fafb;
    color: var(--gray-700);
    font-size: 13px;
    text-align: left;

    svg {
      flex-shrink: 0;
      margin-top: 2px;
    }
  }

  &__badge {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    padding: 3px 8px;
    border-radius: var(--r-pill);
    font-size: 11px;
    font-weight: 500;
    line-height: 1.3;

    &--success {
      background: rgba(76, 175, 80, 0.12);
      color: #2e7d32;
    }

    &--warning {
      background: rgba(255, 180, 0, 0.16);
      color: #8a5b00;
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 0 32px 24px;
  }

  &__account {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
    border: 1px solid var(--gray-200);
    border-radius: 7px;
    background: #f9fafb;

    a {
      color: #0091b8;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;

      &:hover {
        color: var(--v-primary-base);
      }
    }
  }

  &__who {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-width: 0;
    font-size: 14px;

    strong {
      font-weight: 500;
    }

    span {
      overflow-wrap: anywhere;
      color: var(--gray-600);
      font-size: 12px;
    }
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__label {
    margin: 0;
    color: var(--gray-600);
    font-size: 11px;
    font-weight: 500;
    line-height: 1.3;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__rights {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;

    li {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    li > span:last-child {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 13px;
      color: var(--gray-600);
    }

    strong {
      color: var(--gray-900);
      font-size: 14px;
      font-weight: 500;
    }
  }

  &__icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--r-pill);
    background: var(--gray-100);
    color: var(--gray-700);

    &--accent {
      background: rgba(0, 172, 220, 0.12);
      color: #0091b8;
    }
  }

  &__write {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-top: 4px;
    padding: 12px 16px;
    border: 1px solid var(--gray-300);
    border-radius: 7px;
    cursor: pointer;

    &--on {
      border-color: var(--v-accent-base);
      background: var(--accent-tint-selected);
    }

    input {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      margin-top: 1px;
      accent-color: var(--v-accent-base);
    }

    span {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: var(--gray-600);
      font-size: 12px;
    }

    strong {
      color: var(--gray-900);
      font-size: 14px;
      font-weight: 500;
    }
  }

  &__company {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
    border: 1px solid var(--gray-300);
    border-radius: 7px;
    font-size: 14px;

    strong {
      font-weight: 500;
    }
  }

  &__hint {
    margin: 0;
    color: var(--gray-600);
    font-size: 12px;
  }

  &__footnote {
    display: flex;
    gap: 8px;
    align-items: flex-start;

    svg {
      flex-shrink: 0;
      margin-top: 2px;
    }
  }

  &__actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 16px 32px;
    border-top: 1px solid var(--gray-200);
  }

  // On a phone, the actions take the width, the one to allow on top.
  @media (max-width: 480px) {
    &__header,
    &__body,
    &__actions,
    &__banner {
      padding-left: 20px;
      padding-right: 20px;
    }

    &__actions {
      flex-direction: column-reverse;

      .v-btn {
        width: 100%;
      }
    }
  }
}
</style>
