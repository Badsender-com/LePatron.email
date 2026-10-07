'use strict';

/**
 * Markup of the AI panel (ADR 0004), kept out of the component so neither file
 * grows past what is comfortable to read. Header, buttons, notices and spinner
 * come from the right panels' shared kit (badsender-right-panel-ui.less).
 *
 * Two views: the list of the actions that need no target, and the steps of the
 * picked action — instruction, proposals, pick, apply, then a confirmation that
 * keeps an undo, because the subject lives outside the editor's Ctrl+Z.
 */

// The angle and the facts of a proposal, read with its radio or its text.
const meta = `
                <span class="ai-panel__angle">{{ proposal.angle }}</span>
                <ul class="ai-panel__facts">
                  <li>{{ t('text-generation-length', { count: proposal.facts.length }) }}</li>
                  <li v-if="proposal.facts.truncatedOnMobile">{{ t('text-generation-mobile', { preview: proposal.facts.mobilePreview }) }}</li>
                  <li v-if="proposal.facts.tooShort">{{ t('text-generation-short') }}</li>
                  <li v-if="proposal.facts.tooLong">{{ t('text-generation-long') }}</li>
                </ul>`;

module.exports = `
<section class="ai-panel" role="dialog" aria-modal="false" aria-labelledby="ai-panel-title">
  <header class="right-panel__header">
    <div>
      <p class="right-panel__eyebrow">{{ t('ai-panel-title') }}</p>
      <h2 id="ai-panel-title" ref="heading" tabindex="-1" class="right-panel__title">
        {{ session ? t(labels.name) : t('ai-panel-actions') }}
      </h2>
    </div>
    <button type="button" class="qc-icon-button" :aria-label="t('Close')" :title="t('Close')" @click="close">
      <span class="lucide lucide-x" aria-hidden="true"></span>
    </button>
  </header>

  <div class="ai-panel__body">
    <p class="qc-sr-only" aria-live="polite">{{ liveMessage }}</p>

    <template v-if="!session">
      <template v-if="target.kind !== 'email'">
        <p class="ai-panel__section">{{ t('ai-panel-selected-block') }}</p>
        <ul v-if="targetActions.length" class="ai-panel__actions">
          <li v-for="item in targetActions" :key="item.id">
            <button type="button" class="ai-panel__action" @click="openAction(item.id)">
              <span class="lucide lucide-bot" aria-hidden="true"></span>
              <span>{{ t(nameOf(item.id)) }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="ai-panel__hint">{{ t('ai-panel-no-action-yet') }}</p>
        <p class="ai-panel__section">{{ t('ai-panel-whole-email') }}</p>
      </template>
      <ul class="ai-panel__actions">
        <li v-for="item in actions" :key="item.id">
          <button type="button" class="ai-panel__action" @click="openAction(item.id)">
            <span class="lucide lucide-bot" aria-hidden="true"></span>
            <span>{{ t(nameOf(item.id)) }}</span>
          </button>
          <p v-if="!item.canApply" class="ai-panel__hint">{{ t('ai-panel-copy-only') }}</p>
        </li>
      </ul>
      <p v-if="target.kind === 'email'" class="ai-panel__invite">
        <span class="lucide lucide-info" aria-hidden="true"></span>
        {{ t('ai-panel-select-invite') }}
      </p>
    </template>

    <template v-else>
      <button type="button" class="qc-link-button ai-panel__back" @click="showList()">
        <span class="lucide lucide-arrow-left" aria-hidden="true"></span>{{ t('ai-panel-all-actions') }}
      </button>

      <p v-if="selectionChanged" class="qc-notice ai-panel__moved">
        <span class="qc-notice__text">{{ t('ai-panel-selection-changed') }}</span>
        <button type="button" class="qc-link-button" @click="showList(selectionChanged)">
          {{ t('ai-panel-see-its-actions') }}
        </button>
      </p>

      <p v-if="state.error" class="qc-notice qc-notice--error" role="alert">{{ t(state.error) }}</p>

      <div v-if="urgesSubjectFirst" class="qc-notice ai-panel__notice">
        <span class="lucide lucide-info" aria-hidden="true"></span>
        <p class="qc-notice__text">{{ t('ai-panel-no-subject') }}</p>
        <div class="ai-panel__buttons">
          <button type="button" class="qc-button qc-button--cta" @click="openAction(action.suggestFirst)">
            {{ t('ai-panel-subject-first') }}
          </button>
          <button type="button" class="qc-link-button ai-panel__discreet" @click="goOn">
            {{ t('ai-panel-preheader-anyway') }}
          </button>
        </div>
      </div>

      <template v-else-if="state.applied">
        <div ref="applied" tabindex="-1" class="qc-notice ai-panel__applied">
          <p class="qc-notice__text">
            {{ t('text-generation-applied') }}<br>
            {{ t(labels.applied) }} <strong>{{ appliedText }}</strong>
          </p>
        </div>
        <p v-if="undoRefused" class="qc-notice qc-notice--error" role="alert">{{ t('ai-panel-undo-changed') }}</p>
        <div class="ai-panel__buttons">
          <button type="button" class="qc-button qc-button--outline" @click="undo">{{ t('ai-panel-undo') }}</button>
          <button v-if="nextAction" type="button" class="qc-button qc-button--cta" @click="openAction(nextAction)">
            {{ t('ai-panel-next-preheader') }}
          </button>
        </div>
      </template>

      <template v-else>
        <label for="ai-panel-brief" class="ai-panel__label">{{ t('text-generation-brief-label') }}</label>
        <textarea id="ai-panel-brief" ref="brief" class="ai-panel__brief" v-model="brief" rows="2" maxlength="500"
                  :placeholder="t('text-generation-brief-placeholder')"></textarea>

        <template v-if="!state.proposals.length">
          <p v-if="state.dropped" class="ai-panel__hint">{{ t('text-generation-none') }}</p>
          <button type="button" class="qc-button qc-button--cta ai-panel__start" :disabled="state.isLoading" @click="generate">
            {{ t(labels.generate) }}
          </button>
        </template>

        <template v-else>
          <p id="ai-panel-proposals" ref="proposals" tabindex="-1" class="ai-panel__intro">{{ t(labels.proposals) }}</p>
          <p v-if="!canApply" class="ai-panel__hint">{{ t(labels.copyHint) }}</p>
          <p v-if="state.dropped" class="ai-panel__hint">{{ t('text-generation-dropped', { count: state.dropped }) }}</p>

          <div v-if="canApply" class="ai-panel__proposals" role="radiogroup" aria-labelledby="ai-panel-proposals">
            <div v-for="(proposal, index) in state.proposals" :key="proposal.text" class="ai-panel__proposal"
                 :class="{ 'ai-panel__proposal--picked': state.selectedIndex === index }">
              <label class="ai-panel__choice">
                <input type="radio" name="ai-panel-proposal" :value="index"
                       :ref="state.selectedIndex === index ? 'picked' : undefined"
                       :checked="state.selectedIndex === index" :aria-describedby="'ai-panel-meta-' + index"
                       @change="session.select(index)" />
                <span class="ai-panel__text">{{ proposal.text }}</span>
              </label>
              <div :id="'ai-panel-meta-' + index" class="ai-panel__meta">${meta}
              </div>
            </div>
          </div>

          <ul v-else class="ai-panel__proposals">
            <li v-for="(proposal, index) in state.proposals" :key="proposal.text" class="ai-panel__proposal"
                :class="{ 'ai-panel__proposal--picked': state.copiedIndex === index }">
              <span :id="'ai-panel-text-' + index" class="ai-panel__text">{{ proposal.text }}</span>
              <div class="ai-panel__meta">${meta}
              </div>
              <button type="button" class="qc-button qc-button--outline qc-button--sm ai-panel__copy"
                      :aria-describedby="'ai-panel-text-' + index" @click="copy(index)">
                {{ state.copiedIndex === index ? t('text-generation-copied') : t('text-generation-copy') }}
              </button>
            </li>
          </ul>

          <p v-if="copyError" class="qc-notice qc-notice--error" role="alert">{{ t('text-generation-error-copy') }}</p>
          <div class="ai-panel__buttons">
            <button type="button" class="qc-button qc-button--outline" :disabled="state.isLoading" @click="more">
              {{ t('text-generation-more') }}
            </button>
            <button v-if="canApply" type="button" class="qc-button qc-button--cta" :disabled="!picked || state.isLoading"
                    @click="apply">
              {{ t('text-generation-apply') }}
            </button>
            <button v-else-if="nextAction" type="button" class="qc-button qc-button--cta" @click="openAction(nextAction)">
              {{ t('ai-panel-next-preheader') }}
            </button>
          </div>
        </template>

        <p v-if="state.isLoading" class="ai-panel__status">
          <span class="qc-spinner" aria-hidden="true"></span>{{ t('ai-panel-loading') }}
        </p>
      </template>
    </template>
  </div>
</section>
`;
