'use strict';

/**
 * Markup of the AI panel (ADR 0004), kept out of the component so neither file
 * grows past what is comfortable to read.
 *
 * Two views: the list of the actions that need no target, and the steps of the
 * picked action — instruction, proposals, pick, apply, then a confirmation that
 * keeps an undo, because the subject lives outside the editor's Ctrl+Z.
 */
module.exports = `
<section class="ai-panel" role="dialog" aria-modal="false" aria-labelledby="ai-panel-title">
  <header class="ai-panel__header">
    <div>
      <p class="ai-panel__eyebrow">{{ t('ai-panel-title') }}</p>
      <h2 id="ai-panel-title" ref="heading" tabindex="-1" class="ai-panel__title">
        {{ session ? t(labels.name) : t('ai-panel-actions') }}
      </h2>
    </div>
    <button type="button" class="qc-icon-button" :aria-label="t('Close')" :title="t('Close')" @click="close">
      <span class="lucide lucide-x" aria-hidden="true"></span>
    </button>
  </header>

  <div class="ai-panel__body">
    <template v-if="!session">
      <ul class="ai-panel__actions">
        <li v-for="item in actions" :key="item.id">
          <button type="button" class="ai-panel__action" @click="openAction(item.id)">
            <span class="lucide lucide-bot" aria-hidden="true"></span>
            <span>{{ t(nameOf(item.id)) }}</span>
          </button>
          <p v-if="!item.canApply" class="ai-panel__hint">{{ t('ai-panel-copy-only') }}</p>
        </li>
      </ul>
      <p class="ai-panel__invite">
        <span class="lucide lucide-info" aria-hidden="true"></span>
        {{ t('ai-panel-select-invite') }}
      </p>
    </template>

    <template v-else>
      <button type="button" class="ai-panel__back" @click="showList">
        <span class="lucide lucide-arrow-left" aria-hidden="true"></span>{{ t('ai-panel-all-actions') }}
      </button>

      <div v-if="state.error" class="ai-panel__error" role="alert">{{ t(state.error) }}</div>

      <div v-if="urgesSubjectFirst" class="ai-panel__notice">
        <p>{{ t('ai-panel-no-subject') }}</p>
        <button type="button" class="ai-panel__primary" @click="openAction(action.suggestFirst)">
          {{ t('ai-panel-subject-first') }}
        </button>
        <button type="button" class="ai-panel__link" @click="goOnAnyway = true">
          {{ t('ai-panel-preheader-anyway') }}
        </button>
      </div>

      <template v-else-if="state.applied">
        <div ref="applied" tabindex="-1" class="ai-panel__applied" role="status">
          <p>{{ t('text-generation-applied') }}</p>
          <p>{{ t(labels.applied) }} <strong>{{ appliedText }}</strong></p>
        </div>
        <div class="ai-panel__buttons">
          <button type="button" class="ai-panel__secondary" @click="undo">{{ t('text-generation-undo') }}</button>
          <button v-if="session.nextAction()" type="button" class="ai-panel__primary"
                  @click="openAction(session.nextAction())">
            {{ t('ai-panel-next-preheader') }}
          </button>
        </div>
      </template>

      <template v-else>
        <template v-if="!state.proposals.length">
          <p v-if="state.dropped" class="ai-panel__hint">{{ t('text-generation-none') }}</p>
          <label for="ai-panel-brief" class="ai-panel__label">{{ t('text-generation-brief-label') }}</label>
          <textarea id="ai-panel-brief" class="ai-panel__brief" v-model="brief" rows="3" maxlength="500"
                    :placeholder="t('text-generation-brief-placeholder')"></textarea>
          <button type="button" class="ai-panel__primary" :disabled="state.isLoading" @click="generate">
            {{ t('ai-panel-generate') }}
          </button>
        </template>

        <template v-else>
          <p class="ai-panel__intro" id="ai-panel-proposals">{{ t(labels.proposals) }}</p>
          <p v-if="!canApply" class="ai-panel__hint">{{ t(labels.copyHint) }}</p>
          <p v-if="state.dropped" class="ai-panel__hint">{{ t('text-generation-dropped', { count: state.dropped }) }}</p>
          <ul class="ai-panel__proposals" :role="canApply ? 'radiogroup' : 'list'" aria-labelledby="ai-panel-proposals">
            <li v-for="(proposal, index) in state.proposals" :key="proposal.text" class="ai-panel__proposal"
                :class="{ 'ai-panel__proposal--picked': state.selectedIndex === index }">
              <label v-if="canApply" class="ai-panel__choice">
                <input type="radio" name="ai-panel-proposal" :value="index"
                       :checked="state.selectedIndex === index" @change="session.select(index)" />
                <span class="ai-panel__text">{{ proposal.text }}</span>
              </label>
              <span v-else class="ai-panel__text">{{ proposal.text }}</span>
              <span class="ai-panel__angle">{{ proposal.angle }}</span>
              <span class="ai-panel__facts">
                {{ t('text-generation-length', { count: proposal.facts.length }) }}<template
                  v-if="proposal.facts.truncatedOnMobile"> — {{ t('text-generation-mobile', { preview: proposal.facts.mobilePreview }) }}</template><template
                  v-if="proposal.facts.tooShort"> — {{ t('text-generation-short') }}</template><template
                  v-if="proposal.facts.tooLong"> — {{ t('text-generation-long') }}</template>
              </span>
              <button v-if="!canApply" type="button" class="ai-panel__secondary ai-panel__copy" @click="copy(index)">
                {{ copiedIndex === index ? t('text-generation-copied') : t('text-generation-copy') }}
              </button>
            </li>
          </ul>
          <p v-if="copyError" class="ai-panel__error" role="alert">{{ t('text-generation-error-copy') }}</p>
          <div class="ai-panel__buttons">
            <button type="button" class="ai-panel__secondary" :disabled="state.isLoading" @click="more">
              {{ t('text-generation-more') }}
            </button>
            <button v-if="canApply" type="button" class="ai-panel__primary" :disabled="!picked || state.isLoading"
                    @click="apply">
              {{ t('text-generation-apply') }}
            </button>
          </div>
        </template>

        <p class="ai-panel__status" role="status" aria-live="polite">
          <template v-if="state.isLoading">
            <span class="lucide lucide-loader ai-panel__spinner" aria-hidden="true"></span>{{ t('ai-panel-loading') }}
          </template>
        </p>
      </template>
    </template>
  </div>
</section>
`;
