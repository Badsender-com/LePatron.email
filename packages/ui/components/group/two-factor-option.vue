<script>
import { mapGetters } from 'vuex';
import { Smartphone, Check } from 'lucide-vue';

import { groupsItem, groupsItemUsers } from '~/helpers/api-routes.js';
import { CAN, USER } from '~/store/user';
import { CAPABILITIES } from '../../../shared/access/roles.js';
import BsGroupSettingCard from '~/components/group/setting-card.vue';
import BsGroupFeatureSwitch from '~/components/group/feature-switch.vue';

// How long "Enregistré" stays under the option.
const SAVED_FOR_MS = 4000;

// Every member of the group signs in with a second factor (ADR 0008).
// The last row of the Security section of the company settings (design
// system, CompanySettings). Unlike the rows above it, it is saved on its own:
// the change is confirmed with its impact, and its outcome is read where it
// was made, under the option, never in a toast.
// A technical setting: a company admin reads it, a tech admin switches it.
export default {
  name: 'BsGroupTwoFactorOption',
  components: {
    BsGroupSettingCard,
    BsGroupFeatureSwitch,
    LucideSmartphone: Smartphone,
    LucideCheck: Check,
  },
  props: {
    group: { type: Object, required: true },
  },
  data() {
    return {
      loading: false,
      // 'saved' | 'failed' | null: the outcome of the last change.
      outcome: null,
      // The value asked for, kept until it is confirmed (or tried again).
      asked: null,
      // The confirmation dialog; `confirmed` tells closing it by the action
      // from closing it any other way (cancel, Escape, a click outside).
      confirming: false,
      confirmed: false,
      members: [],
      // Bumped to draw the switch back on the saved state after a refusal:
      // the browser already flipped it.
      switchKey: 0,
      savedTimer: null,
    };
  },
  computed: {
    ...mapGetters(USER, { can: CAN }),
    canSwitch() {
      return this.can(CAPABILITIES.GROUP_MANAGE_TECH);
    },
    required() {
      return this.group.requireTwoFactor === true;
    },
    // A SAML group leaves the second factor to its identity provider; as
    // the server reads it, an SSO without its certificate is not one.
    isSaml() {
      const { entryPoint, issuer, idpCert } = this.group;
      return Boolean(entryPoint && issuer && idpCert);
    },
    total() {
      return this.members.length;
    },
    configured() {
      return this.members.filter((member) => member.twoFactorMethod).length;
    },
    waiting() {
      return this.total - this.configured;
    },
    progress() {
      return this.total ? Math.round((this.configured / this.total) * 100) : 0;
    },
  },
  watch: {
    confirming(open) {
      if (!open && !this.confirmed) this.cancel();
    },
  },
  async created() {
    await this.loadMembers();
  },
  beforeDestroy() {
    clearTimeout(this.savedTimer);
  },
  methods: {
    // The counts are an aid: a failure leaves the row without them.
    async loadMembers() {
      try {
        const { items } = await this.$axios.$get(
          groupsItemUsers({ groupId: this.group.id })
        );
        this.members = items || [];
      } catch (error) {
        this.members = [];
      }
    },
    // A change that touches every member is confirmed first, with its impact.
    ask(value) {
      this.asked = Boolean(value);
      this.outcome = null;
      this.confirmed = false;
      this.confirming = true;
    },
    confirm() {
      this.confirmed = true;
      this.confirming = false;
      this.save();
    },
    // Cancelled: the switch goes back to what is saved.
    cancel() {
      this.asked = null;
      this.switchKey += 1;
    },
    async save() {
      const value = this.asked;
      if (value === null) return;
      this.loading = true;
      clearTimeout(this.savedTimer);
      try {
        const group = await this.$axios.$put(
          groupsItem({ groupId: this.group.id }),
          { requireTwoFactor: value }
        );
        this.$emit('update', group);
        this.asked = null;
        this.outcome = 'saved';
        this.savedTimer = setTimeout(() => {
          this.outcome = null;
        }, SAVED_FOR_MS);
      } catch (error) {
        this.outcome = 'failed';
        this.switchKey += 1;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <div class="bs-group-two-factor">
    <bs-group-setting-card title-id="two-factor-title">
      <template #icon><lucide-smartphone :size="28" /></template>
      <template #name>{{ $t('twoFactor.group.title') }}</template>
      <template #description>
        <template v-if="isSaml">{{ $t('twoFactor.group.saml') }}</template>
        <template v-else>
          {{ $t('twoFactor.group.description') }}
          <span v-if="total" class="d-block mt-2">
            <!-- At 0% the empty track reads as a divider: the sentence
                 alone says nobody has set it up. -->
            <v-progress-linear
              v-if="configured > 0"
              :value="progress"
              color="primary"
              background-color="grey lighten-2"
              height="4"
              rounded
              aria-hidden="true"
            />
            <span class="bs-group-two-factor__progress">
              {{
                $tc('twoFactor.group.progress', configured, {
                  n: configured,
                  total,
                })
              }}
            </span>
          </span>
          <span v-if="!canSwitch" class="d-block mt-2">
            {{ $t('twoFactor.group.managedByTech') }}
          </span>
          <!-- The outcome sits on the option: read where it was made. -->
          <span
            v-if="outcome === 'saved'"
            class="bs-group-two-factor__outcome bs-group-two-factor__outcome--saved"
            role="status"
          >
            <lucide-check :size="14" aria-hidden="true" />
            {{ $t('twoFactor.group.saved') }}
          </span>
          <span
            v-else-if="outcome === 'failed'"
            class="bs-group-two-factor__outcome bs-group-two-factor__outcome--failed"
            role="alert"
          >
            {{ $t('twoFactor.group.failed') }}
            <button type="button" @click="ask(asked)">
              {{ $t('twoFactor.group.retry') }}
            </button>
          </span>
        </template>
      </template>
      <template #control>
        <template v-if="!isSaml">
          <bs-group-feature-switch
            v-if="canSwitch"
            :key="switchKey"
            :value="required"
            :label="$t('twoFactor.group.switch')"
            :on-text="$t('twoFactor.group.on')"
            :off-text="$t('twoFactor.group.off')"
            :loading="loading"
            :disabled="loading"
            @change="ask"
          />
          <span
            v-else
            class="bs-group-two-factor__state"
            :class="{ 'bs-group-two-factor__state--on': required }"
          >
            {{
              required ? $t('twoFactor.group.on') : $t('twoFactor.group.off')
            }}
          </span>
        </template>
      </template>
    </bs-group-setting-card>

    <!-- The dialog of the app's other confirmations (integrations, ...). -->
    <v-dialog v-model="confirming" max-width="500">
      <v-card>
        <v-card-title>
          <span class="headline">
            {{
              asked
                ? $t('twoFactor.group.confirmOn.title')
                : $t('twoFactor.group.confirmOff.title')
            }}
          </span>
        </v-card-title>
        <v-card-text>
          <p v-if="asked">
            <template v-if="waiting > 0">
              {{
                $tc('twoFactor.group.confirmOn.pending', waiting, {
                  n: waiting,
                  total,
                })
              }}
            </template>
            {{ $t('twoFactor.group.confirmOn.everyone') }}
          </p>
          <p v-else>{{ $t('twoFactor.group.confirmOff.body') }}</p>
        </v-card-text>
        <v-divider />
        <div class="modal-actions">
          <v-btn text color="primary" @click="confirming = false">
            {{ $t('global.cancel') }}
          </v-btn>
          <v-btn
            :color="asked ? 'accent' : 'error'"
            elevation="0"
            @click="confirm"
          >
            {{
              asked
                ? $t('twoFactor.group.confirmOn.action')
                : $t('twoFactor.group.confirmOff.action')
            }}
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style lang="scss" scoped>
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
}

// The card is the last row of its section: the section spaces it, not the card.
.bs-group-two-factor ::v-deep .bs-group-setting-card {
  margin-bottom: 0;
}

.bs-group-two-factor {
  &__progress {
    display: block;
    margin-top: 6px;
    font-size: 13px;
  }

  &__state {
    font-size: 13px;
    font-weight: 500;
    color: var(--gray-600);

    &--on {
      color: #2e7d32;
    }
  }

  &__outcome {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    font-size: 13px;
    font-weight: 500;

    &--saved {
      color: #2e7d32;
    }

    &--failed {
      color: #c53a12;

      button {
        text-decoration: underline;
        font-weight: 500;
      }
    }
  }
}
</style>
