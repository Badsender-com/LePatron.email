<script>
import { mapGetters } from 'vuex';
import { ShieldCheck, Check } from 'lucide-vue';

import { groupsItem, groupsItemUsers } from '~/helpers/api-routes.js';
import { CAN, USER } from '~/store/user';
import { CAPABILITIES } from '../../../shared/access/roles.js';
import BsSettingsRow from '~/components/layout/bs-settings-row.vue';
import BsGroupFeatureSwitch from '~/components/group/feature-switch.vue';
import BsModalConfirm from '~/components/modal-confirm.vue';

// How long "Enregistré" stays under the option.
const SAVED_FOR_MS = 4000;

// Every member of the group signs in with a second factor (ADR 0008).
// Saved on its own, the Security card of the company settings (design
// system, CompanySettings): the change is confirmed with its impact, and its
// outcome is read where it was made, under the option, never in a toast.
// A technical setting: a company admin reads it, a tech admin switches it.
export default {
  name: 'BsGroupTwoFactorOption',
  components: {
    BsSettingsRow,
    BsGroupFeatureSwitch,
    BsModalConfirm,
    LucideShieldCheck: ShieldCheck,
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
      const dialog = value ? 'confirmOnDialog' : 'confirmOffDialog';
      this.$refs[dialog].open();
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
  <section class="bs-group-two-factor" aria-labelledby="two-factor-section">
    <header class="bs-group-two-factor__header">
      <span class="bs-group-two-factor__tile" aria-hidden="true">
        <lucide-shield-check :size="20" />
      </span>
      <div>
        <h3 id="two-factor-section" class="bs-group-two-factor__title">
          {{ $t('twoFactor.group.sectionTitle') }}
        </h3>
        <p class="bs-group-two-factor__description">
          {{ $t('twoFactor.group.sectionDescription') }}
        </p>
      </div>
    </header>

    <ul class="bs-group-two-factor__rows">
      <bs-settings-row title-id="two-factor-title">
        <template #title>{{ $t('twoFactor.group.title') }}</template>
        <template #description>
          <template v-if="isSaml">{{ $t('twoFactor.group.saml') }}</template>
          <template v-else>
            {{ $t('twoFactor.group.description') }}
            <span v-if="total" class="d-block mt-2">
              <v-progress-linear
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
      </bs-settings-row>
    </ul>

    <bs-modal-confirm
      ref="confirmOnDialog"
      :title="$t('twoFactor.group.confirmOn.title')"
      :action-label="$t('twoFactor.group.confirmOn.action')"
      action-button-color="primary"
      @confirm="save"
      @cancel="cancel"
    >
      <template v-if="waiting > 0">
        {{
          $tc('twoFactor.group.confirmOn.pending', waiting, {
            n: waiting,
            total,
          })
        }}
      </template>
      {{ $t('twoFactor.group.confirmOn.everyone') }}
    </bs-modal-confirm>
    <bs-modal-confirm
      ref="confirmOffDialog"
      :title="$t('twoFactor.group.confirmOff.title')"
      :action-label="$t('twoFactor.group.confirmOff.action')"
      action-button-color="primary"
      @confirm="save"
      @cancel="cancel"
    >
      {{ $t('twoFactor.group.confirmOff.body') }}
    </bs-modal-confirm>
  </section>
</template>

<style lang="scss" scoped>
// A feature card of the design system (FeatureCard): white, a 1px border, no
// shadow; its rows are SettingsRows.
.bs-group-two-factor {
  background: #fff;
  border: 1px solid var(--gray-300);
  border-radius: 10px;
  max-width: 880px;

  &__header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px 24px;
  }

  &__tile {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 7px;
    background: var(--tint-accent);
    color: var(--v-accent-darken1);
  }

  &__title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--gray-900);
  }

  &__description {
    margin: 0;
    font-size: 13px;
    color: var(--gray-600);
  }

  &__rows {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--gray-200);

    // A row inside a flush card (design system, SettingsRow): 16px / 24px,
    // aligned with the header. The hairline under the header is the card's;
    // the row draws its own only from the second one.
    ::v-deep .bs-settings-row {
      padding: 16px 24px;

      &:first-child {
        border-top: none;
      }
    }
  }

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
