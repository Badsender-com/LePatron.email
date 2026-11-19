<script>
import { mapGetters } from 'vuex';
import { Smartphone } from 'lucide-vue';

import { groupsItemUsers } from '~/helpers/api-routes.js';
import mixinGroupSwitch from '~/helpers/mixins/mixin-group-switch.js';
import { CAN, USER } from '~/store/user';
import { countTwoFactorSetups } from '~/helpers/two-factor.js';
import { CAPABILITIES } from '../../../shared/access/roles.js';
import BsGroupSettingCard from '~/components/group/setting-card.vue';
import BsSaveOutcome from '~/components/layout/bs-save-outcome.vue';
import BsGroupFeatureSwitch from '~/components/group/feature-switch.vue';

// Every member of the group signs in with a second factor (ADR 0008).
// The last row of the Security section of the company settings (design
// system, CompanySettings). Unlike the rows above it, it is saved on its own:
// the change is confirmed with its impact, and its outcome is read where it
// was made, under the option, never in a toast. The save itself is the one of
// every company switch (mixinGroupSwitch), once the change is confirmed.
// A technical setting: a company admin reads it, a tech admin switches it.
export default {
  name: 'BsGroupTwoFactorOption',
  components: {
    BsGroupSettingCard,
    BsSaveOutcome,
    BsGroupFeatureSwitch,
    LucideSmartphone: Smartphone,
  },
  mixins: [mixinGroupSwitch({ field: 'requireTwoFactor' })],
  data() {
    return {
      // The value asked for, kept until it is confirmed (or tried again).
      asked: null,
      // The confirmation dialog; `confirmed` tells closing it by the action
      // from closing it any other way (cancel, Escape, a click outside).
      confirming: false,
      confirmed: false,
      members: [],
      // Bumped to draw the switch back on the saved state after a cancel:
      // the browser already flipped it, and `switchValue` never moved.
      switchKey: 0,
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
    counts() {
      return countTwoFactorSetups(this.members);
    },
    total() {
      return this.counts.total;
    },
    configured() {
      return this.counts.configured;
    },
    waiting() {
      return this.counts.waiting;
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
  // In the browser only: the server's render would fetch every member of the
  // company for counts it throws away.
  mounted() {
    this.loadMembers();
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
      this.clearOutcome();
      this.confirmed = false;
      this.confirming = true;
    },
    // Saved, the asked value is done with; failed, it stays for "Réessayer".
    async confirm() {
      this.confirmed = true;
      this.confirming = false;
      if (this.asked === null) return;
      if (await this.save(this.asked)) this.asked = null;
    },
    // Cancelled: the switch goes back to what is saved.
    cancel() {
      this.asked = null;
      this.switchKey += 1;
    },
  },
};
</script>

<template>
  <div class="bs-group-two-factor">
    <bs-group-setting-card>
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
          <bs-save-outcome
            class="mt-2"
            :outcome="outcome"
            :detail="outcomeDetail"
            @retry="ask(asked)"
          />
        </template>
      </template>
      <template #control>
        <template v-if="!isSaml">
          <bs-group-feature-switch
            v-if="canSwitch"
            :key="switchKey"
            :value="switchValue"
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
          {{
            asked
              ? $t('twoFactor.group.confirmOn.title')
              : $t('twoFactor.group.confirmOff.title')
          }}
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
      color: var(--success-ink);
    }
  }
}
</style>
