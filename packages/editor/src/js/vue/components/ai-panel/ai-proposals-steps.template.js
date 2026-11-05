'use strict';

/**
 * Markup of the steps of a "proposals" action (text generation): the
 * instruction, the proposals, pick, apply, then a confirmation that keeps an
 * undo. Its words come from the action's definition (ext/ai-panel/actions).
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
<div class="ai-panel__steps">
  <p v-if="state.error" class="qc-notice qc-notice--error" role="alert">{{ t(state.error) }}</p>

  <div v-if="urgesFirst" class="qc-notice ai-panel__notice">
    <span class="lucide lucide-info" aria-hidden="true"></span>
    <p class="qc-notice__text">{{ t(labels.firstNotice) }}</p>
    <div class="ai-panel__buttons">
      <button type="button" class="qc-button qc-button--cta" @click="$emit('open-action', action.suggestFirst)">
        {{ t(labelsOf(action.suggestFirst).first) }}
      </button>
      <button type="button" class="qc-link-button ai-panel__discreet" @click="goOn">
        {{ t(labels.firstAnyway) }}
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
  </template>

  <template v-else>
    <label for="ai-panel-brief" class="ai-panel__label">{{ t('text-generation-brief-label') }}</label>
    <textarea id="ai-panel-brief" ref="brief" class="ai-panel__brief" v-model="brief" rows="2" maxlength="500"
              :placeholder="t('text-generation-brief-placeholder')"></textarea>

    <!-- « Proposer », « Proposer d'autres », « Appliquer », « Annuler » and
         what comes next are the panel's foot (footerButtons). -->
    <p v-if="!state.proposals.length && state.dropped" class="ai-panel__hint">{{ t('text-generation-none') }}</p>

    <template v-if="state.proposals.length">
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
    </template>

    <p v-if="state.isLoading" class="ai-panel__status">
      <span class="qc-spinner" aria-hidden="true"></span>{{ t('ai-panel-loading') }}
    </p>
  </template>
</div>
`;
