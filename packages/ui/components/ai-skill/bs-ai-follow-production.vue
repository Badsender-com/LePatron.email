<script>
import { mapMutations } from 'vuex';
import { RefreshCw } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as api from '~/helpers/ai-skill-routes.js';
import { followOutcomes, followStatusColor } from '~/helpers/skills-follow.js';

// A copy following production (ADR 0019): shown only on a copy, configured
// with production's address and a read token. A super admin follows it now
// and reads how the last follow went. Emits `followed` so the lists reload.
export default {
  name: 'BsAiFollowProduction',
  components: { LucideRefreshCw: RefreshCw },
  data() {
    return {
      loading: false,
      loadError: false,
      configured: false,
      production: null,
      last: null,
      following: false,
    };
  },
  computed: {
    outcomes() {
      return followOutcomes(this.last);
    },
    failures() {
      return (this.last && this.last.failures) || [];
    },
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    followStatusColor,
    async fetchData() {
      this.loading = true;
      try {
        const answer = await this.$axios.$get(api.aiSkillsFollow());
        this.configured = answer.configured;
        this.production = answer.production;
        this.last = answer.last;
        this.loadError = false;
      } catch (error) {
        console.error(error);
        this.loadError = true;
      } finally {
        this.loading = false;
      }
    },
    lastLabel() {
      return this.$t('aiSkills.follow.last', {
        date: this.$options.filters.preciseDateTime(
          this.last.at,
          this.$i18n.locale
        ),
        by: this.last.by,
      });
    },
    async followNow() {
      this.following = true;
      try {
        const { last } = await this.$axios.$post(api.aiSkillsFollow());
        this.last = last;
        if (last.status !== 'failed') {
          this.showSnackbar({
            text: this.$t('aiSkills.follow.done'),
            color: 'success',
          });
          this.$emit('followed');
        }
      } catch (error) {
        console.error(error);
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.following = false;
      }
    },
  },
};
</script>

<template>
  <section
    v-if="configured || loadError"
    class="bs-ai-follow"
    :aria-label="$t('aiSkills.follow.title')"
    :aria-busy="following ? 'true' : 'false'"
  >
    <div class="bs-ai-follow__header">
      <div>
        <h2 class="bs-ai-follow__title">{{ $t('aiSkills.follow.title') }}</h2>
        <p class="bs-ai-follow__intro">
          {{ $t('aiSkills.follow.description') }}
        </p>
        <p v-if="production" class="bs-ai-follow__production">
          {{ $t('aiSkills.follow.production', { origin: production }) }}
        </p>
      </div>
      <v-btn
        v-if="configured"
        color="accent"
        elevation="0"
        class="text-none"
        :loading="following"
        :disabled="following"
        @click="followNow"
      >
        <lucide-refresh-cw :size="18" class="mr-2" />
        {{ $t('aiSkills.follow.now') }}
      </v-btn>
    </div>

    <v-alert v-if="loadError" type="error" outlined text>
      {{ $t('aiSkills.follow.loadError') }}
    </v-alert>
    <div v-else-if="last" class="bs-ai-follow__card" role="status">
      <div class="bs-ai-follow__last">
        <v-chip
          small
          label
          :color="followStatusColor(last.status)"
          text-color="white"
        >
          {{ $t(`aiSkills.follow.statuses.${last.status}`) }}
        </v-chip>
        <span class="bs-ai-follow__meta">{{ lastLabel() }}</span>
      </div>
      <p v-if="last.status === 'failed'" class="bs-ai-follow__message">
        {{ last.message }} {{ $t('aiSkills.follow.nothingWritten') }}
      </p>
      <ul v-else class="bs-ai-follow__outcomes">
        <li v-for="{ outcome, count } in outcomes" :key="outcome">
          {{ $t(`aiSkills.follow.outcomes.${outcome}`, { count }) }}
        </li>
      </ul>
      <div v-if="failures.length" class="bs-ai-follow__failures">
        <span class="bs-ai-follow__meta">
          {{ $t('aiSkills.follow.failuresLabel') }}
        </span>
        <ul>
          <li
            v-for="failure in failures"
            :key="`${failure.kind}:${failure.id}`"
          >
            <code>{{ failure.id }}</code> — {{ failure.message }}
          </li>
        </ul>
      </div>
    </div>
    <p v-else-if="!loading" class="bs-ai-follow__meta">
      {{ $t('aiSkills.follow.never') }}
    </p>
  </section>
</template>

<style lang="scss" scoped>
.bs-ai-follow {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  &__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  &__intro,
  &__production {
    margin: 0.25rem 0 0;
    max-width: 640px;
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.7);
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 10px;
  }

  &__last {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__meta {
    font-size: 0.8125rem;
    color: rgba(0, 0, 0, 0.6);
  }

  &__message {
    margin: 0;
    font-size: 0.875rem;
  }

  &__outcomes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.875rem;
  }

  &__failures ul {
    margin: 0.25rem 0 0;
    font-size: 0.8125rem;
  }
}
</style>
