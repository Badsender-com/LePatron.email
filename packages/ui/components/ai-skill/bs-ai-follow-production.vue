<script>
import { mapMutations } from 'vuex';
import { RefreshCw, Moon } from 'lucide-vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as api from '~/helpers/ai-skill-routes.js';
import { skillErrorMessage } from '~/helpers/ai-skill-errors.js';
import {
  followDetails,
  followDoneNotice,
  followFailureKey,
  followItemErrorKey,
  followLastKey,
  followLockKey,
  followOutcomes,
  followStatusColor,
} from '~/helpers/skills-follow.js';
import { copyStateOf } from '~/helpers/skills-copy.js';

// A copy following production (ADR 0019): shown only on a copy, configured
// with production's address and a read token. A super admin follows it now
// and reads how the last follow went, whether the night follows it on this
// instance, and the follow running now. Emits `followed` so the lists
// reload, and `state` once it knows whether this instance is a copy.
export default {
  name: 'BsAiFollowProduction',
  components: { LucideRefreshCw: RefreshCw, LucideMoon: Moon },
  data() {
    return {
      loading: false,
      loadError: false,
      configured: false,
      production: null,
      state: copyStateOf(null),
      last: null,
      // The report of the follow just made: it names each item.
      report: null,
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
    details() {
      return followDetails(this.report || this.last);
    },
    lock() {
      return this.state.lock;
    },
    shown() {
      return this.configured || this.state.isCopy || this.loadError;
    },
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    followStatusColor,
    followFailureKey,
    async fetchData() {
      this.loading = true;
      try {
        const answer = await this.$axios.$get(api.aiSkillsFollow());
        this.configured = answer.configured;
        this.production = answer.production;
        this.last = answer.last;
        this.state = copyStateOf(answer);
        this.loadError = false;
        this.$emit('state', this.state);
      } catch (error) {
        console.error(error);
        this.loadError = true;
        this.$emit('state', copyStateOf(null));
      } finally {
        this.loading = false;
      }
    },
    dateOf(value) {
      return this.$options.filters.preciseDateTime(value, this.$i18n.locale);
    },
    lastLabel() {
      return this.$t(followLastKey(this.last), {
        date: this.dateOf(this.last.at),
        by: this.last.by,
      });
    },
    lockLabel() {
      return this.$t(followLockKey(this.lock), {
        date: this.dateOf(this.lock.startedAt),
        by: this.lock.by,
      });
    },
    outcomeLabel({ outcome, count }) {
      return this.$tc(`aiSkills.follow.outcomes.${outcome}`, count, { count });
    },
    // A failed item says why in the application's words, never in the
    // server's own sentence.
    failureText(failure) {
      const key = followItemErrorKey(failure);
      return key && this.$te(key)
        ? this.$t(key, { id: failure.id, version: failure.version })
        : this.$t('aiSkills.follow.itemFailed');
    },
    warningText(warning) {
      const key = `aiSkills.follow.warnings.${warning.code}`;
      const values = {
        id: warning.id,
        ids: (warning.expertiseIds || []).join(', '),
      };
      return this.$te(key)
        ? this.$t(key, values)
        : this.$t('aiSkills.follow.warnings.other', values);
    },
    async followNow() {
      this.following = true;
      try {
        const { report, last } = await this.$axios.$post(api.aiSkillsFollow());
        this.last = last;
        this.report = report || null;
        if (last.status !== 'failed') {
          const { key, color } = followDoneNotice(last.status);
          this.showSnackbar({ text: this.$t(key), color });
          this.$emit('followed');
        }
      } catch (error) {
        console.error(error);
        this.tellRefused(error);
      } finally {
        this.following = false;
      }
    },
    // Another follow holds the lock: the tab says which, and since when.
    tellRefused(error) {
      const status = error && error.response && error.response.status;
      if (status !== 409) {
        this.showSnackbar({
          text: skillErrorMessage(this, error),
          color: 'error',
        });
        return;
      }
      const code = error.response.data && error.response.data.message;
      const key = code ? `aiSkills.errors.${code}` : null;
      this.showSnackbar({
        text:
          key && this.$te(key)
            ? this.$t(key)
            : this.$t('aiSkills.follow.alreadyRunning'),
        color: 'warning',
      });
      this.fetchData();
    },
  },
};
</script>

<template>
  <section
    v-if="shown"
    class="bs-ai-follow"
    :aria-label="$t('aiSkills.follow.title')"
    :aria-busy="following || !!lock ? 'true' : 'false'"
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
        <p v-if="!loadError" class="bs-ai-follow__nightly">
          <lucide-moon :size="14" aria-hidden="true" />
          {{
            state.nightly
              ? $t('aiSkills.follow.nightlyOn')
              : $t('aiSkills.follow.nightlyOff')
          }}
        </p>
      </div>
      <v-btn
        v-if="configured"
        color="accent"
        elevation="0"
        class="text-none bs-ai-follow__now"
        :loading="following"
        :disabled="following || !!lock"
        @click="followNow"
      >
        <lucide-refresh-cw :size="18" class="mr-2" />
        {{ $t('aiSkills.follow.now') }}
      </v-btn>
    </div>

    <v-alert v-if="loadError" type="error" outlined text>
      {{ $t('aiSkills.follow.loadError') }}
    </v-alert>
    <p
      v-else-if="lock"
      class="bs-ai-follow__lock"
      role="status"
      aria-live="polite"
    >
      <v-progress-circular indeterminate size="14" width="2" color="accent" />
      {{ lockLabel() }}
    </p>
    <div
      v-if="!loadError && last"
      class="bs-ai-follow__card"
      role="status"
      aria-live="polite"
    >
      <div class="bs-ai-follow__last">
        <v-chip small label dark :color="followStatusColor(last.status)">
          {{ $t(`aiSkills.follow.statuses.${last.status}`) }}
        </v-chip>
        <span class="bs-ai-follow__meta">{{ lastLabel() }}</span>
      </div>
      <p v-if="last.status === 'failed'" class="bs-ai-follow__message">
        {{ $t(followFailureKey(last)) }}
        {{ $t('aiSkills.follow.nothingWritten') }}
      </p>
      <template v-else>
        <p v-if="last.status === 'partial'" class="bs-ai-follow__message">
          {{ $t('aiSkills.follow.partialHint') }}
        </p>
        <ul class="bs-ai-follow__outcomes">
          <li
            v-for="outcome in outcomes"
            :key="outcome.outcome"
            :class="`bs-ai-follow__outcome--${outcome.outcome}`"
          >
            {{ outcomeLabel(outcome) }}
          </li>
        </ul>
      </template>

      <div v-if="details.moved.length" class="bs-ai-follow__details">
        <span class="bs-ai-follow__meta">
          {{ $t('aiSkills.follow.movedLabel') }}
        </span>
        <ul>
          <li
            v-for="item in details.moved"
            :key="`${item.kind}:${item.id}`"
            class="bs-ai-follow__moved"
          >
            {{ $t('aiSkills.follow.moved', { id: item.id }) }}
            <nuxt-link :to="item.to">{{ item.copyId }}</nuxt-link>
          </li>
        </ul>
      </div>
      <div v-if="details.kept.length" class="bs-ai-follow__details">
        <span class="bs-ai-follow__meta">
          {{ $t('aiSkills.follow.keptLabel') }}
        </span>
        <ul>
          <li
            v-for="item in details.kept"
            :key="`${item.kind}:${item.id}`"
            class="bs-ai-follow__kept"
          >
            <nuxt-link :to="item.to">{{ item.id }}</nuxt-link>
            — {{ $t('aiSkills.follow.productionChanged') }}
          </li>
        </ul>
      </div>
      <div v-if="details.removed.length" class="bs-ai-follow__details">
        <span class="bs-ai-follow__meta">
          {{ $t('aiSkills.follow.removedLabel') }}
        </span>
        <ul>
          <li
            v-for="item in details.removed"
            :key="item.key"
            class="bs-ai-follow__removed"
          >
            {{
              item.version
                ? $t('aiSkills.follow.removedDraft', item)
                : $t('aiSkills.follow.removedItem', item)
            }}
          </li>
        </ul>
      </div>
      <div v-if="details.warnings.length" class="bs-ai-follow__details">
        <span class="bs-ai-follow__meta">
          {{ $t('aiSkills.follow.warningsLabel') }}
        </span>
        <ul>
          <li
            v-for="(warning, i) in details.warnings"
            :key="`${warning.kind}:${warning.id}:${warning.code}:${i}`"
            class="bs-ai-follow__warning"
          >
            {{ warningText(warning) }}
          </li>
        </ul>
      </div>
      <div v-if="failures.length" class="bs-ai-follow__details">
        <span class="bs-ai-follow__meta">
          {{ $t('aiSkills.follow.failuresLabel') }}
        </span>
        <ul>
          <li
            v-for="failure in failures"
            :key="`${failure.kind}:${failure.id}`"
            class="bs-ai-follow__failure"
          >
            <code>{{ failure.id }}</code> — {{ failureText(failure) }}
          </li>
        </ul>
      </div>
    </div>
    <p v-else-if="!loadError && !loading" class="bs-ai-follow__meta">
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
  &__production,
  &__nightly {
    margin: 0.25rem 0 0;
    max-width: 640px;
    font-size: 0.875rem;
    color: var(--gray-800);
  }

  &__nightly,
  &__lock {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  &__lock {
    margin: 0;
    font-size: 0.875rem;
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    background: var(--surface);
    border: 1px solid var(--gray-300);
    border-radius: var(--r-md);
  }

  &__last {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__meta {
    font-size: 0.8125rem;
    color: var(--gray-700);
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

  &__details ul {
    margin: 0.25rem 0 0;
    font-size: 0.8125rem;
  }
}
</style>
