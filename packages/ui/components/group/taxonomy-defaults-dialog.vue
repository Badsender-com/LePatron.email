<script>
import BsModalConfirm from '~/components/modal-confirm';
import * as apiRoutes from '~/helpers/api-routes.js';

/**
 * Restoring the Badsender email types a company is missing. The email type's
 * alone: no other dimension has defaults.
 *
 * Emits `restored` with the number of types created, and `error` with the
 * failed request, which the parent reports like its own.
 */
export default {
  name: 'BsTaxonomyDefaultsDialog',
  components: { BsModalConfirm },
  data() {
    return {
      busy: false,
      // What the server said restoring the defaults would do. Held between the
      // preview call and the confirmation, so the dialog names the typologies
      // rather than announcing a count the user cannot check.
      plan: null,
    };
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    toCreate() {
      return (this.plan && this.plan.toCreate) || [];
    },
    // Types the server will not create because another typology already uses the
    // label. Named in the dialog rather than silently absent from the result: the
    // admin is the only one who can tell whether their "Éditorial" is the same
    // thing under a different definition.
    skipped() {
      return (this.plan && this.plan.skipped) || [];
    },
  },
  methods: {
    // Two calls, not one: the dialog announces what the server computed, and the
    // write recomputes it. Sending back a list of items to create would let the
    // client decide what goes into the taxonomy.
    //
    // Ignored while a call is in flight: a double click would otherwise fire two
    // previews and open the dialog on whichever answers last.
    async open() {
      if (this.busy) return;
      try {
        this.busy = true;
        this.plan = await this.$axios.$get(
          apiRoutes.taxonomyDefaultEmailTypes(this.groupId, {
            lang: this.$i18n.locale,
          })
        );
        this.$refs.modal.open();
      } catch (error) {
        this.$emit('error', error);
      } finally {
        this.busy = false;
      }
    },

    async restore() {
      try {
        this.busy = true;
        const {
          created,
        } = await this.$axios.$post(
          apiRoutes.taxonomyDefaultEmailTypesRestore(),
          { groupId: this.groupId, lang: this.$i18n.locale }
        );
        this.$emit('restored', (created || []).length);
      } catch (error) {
        this.$emit('error', error);
      } finally {
        this.plan = null;
        this.busy = false;
      }
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="modal"
    :title="$t('taxonomy.defaults.confirmTitle')"
    :action-label="$t('global.add')"
    action-button-color="accent"
    :display-submit-button="toCreate.length > 0"
    @confirm="restore"
  >
    <p v-if="toCreate.length === 0">
      {{ $t('taxonomy.defaults.confirmNothing') }}
    </p>
    <template v-else>
      <p>{{ $t('taxonomy.defaults.confirmIntro') }}</p>
      <ul class="taxonomy-defaults__list mb-3">
        <li v-for="item in toCreate" :key="item.canonicalType">
          {{ item.label }}
        </li>
      </ul>
    </template>
    <p v-if="skipped.length" class="taxonomy-defaults__hint mb-2">
      {{
        $t('taxonomy.defaults.confirmSkipped', {
          labels: skipped.map((item) => item.label).join(', '),
        })
      }}
    </p>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.taxonomy-defaults {
  &__list,
  &__hint {
    color: var(--gray-700);
    font-size: 0.875rem;
  }
}
</style>
