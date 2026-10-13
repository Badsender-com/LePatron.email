'use strict';

/**
 * Markup of the steps of a "corrections" action (ADR 0005): the analysis, then
 * the corrections to accept or ignore, « Tout accepter » first. Nothing is
 * written before « Accepter »; the editor's undo takes an accepted correction
 * back. A correction answered takes one line.
 */
module.exports = `
<div class="ai-panel__steps" @keydown="onKeydown">
  <p v-if="state.error" class="qc-notice qc-notice--error" role="alert">{{ t(state.error) }}</p>

  <p v-if="state.isLoading" class="ai-panel__status">
    <span class="qc-spinner" aria-hidden="true"></span>{{ t('ai-panel-correcting') }}
  </p>

  <p v-else-if="state.done && !state.corrections.length" ref="summary" tabindex="-1" class="qc-notice ai-panel__applied">
    <span class="lucide lucide-check" aria-hidden="true"></span>
    <span class="qc-notice__text">{{ t('ai-panel-no-correction') }}</span>
  </p>

  <template v-else-if="state.corrections.length">
    <div class="ai-panel__corrections-head">
      <p id="ai-panel-corrections" ref="summary" tabindex="-1" class="ai-panel__intro">
        {{ tCount('ai-panel-corrections-count', state.corrections.length) }}
      </p>
      <button v-if="open.length > 1" type="button" class="qc-button qc-button--cta qc-button--sm" @click="acceptAll">
        {{ t('ai-panel-accept-all') }}
      </button>
    </div>

    <ul class="ai-panel__corrections" aria-labelledby="ai-panel-corrections">
      <li v-for="correction in state.corrections" :key="correction.id" class="ai-panel__correction"
          :class="['ai-panel__correction--' + correction.status, { 'ai-panel__correction--answered': !isOpen(correction) }]">
        <p :id="'ai-correction-' + correction.id" class="ai-panel__change">
          <span class="qc-sr-only">{{ t('ai-panel-correction-before') }}</span>
          <del class="ai-panel__before">{{ correction.before }}</del>
          <span class="lucide lucide-arrow-right" aria-hidden="true"></span>
          <span class="qc-sr-only">{{ t('ai-panel-correction-after') }}</span>
          <ins class="ai-panel__after">{{ correction.after }}</ins>
        </p>
        <p v-if="isOpen(correction)" class="ai-panel__hint">{{ correction.reason }}</p>
        <p v-if="correction.status !== 'pending'" class="ai-panel__status-label">{{ t(STATUS_LABELS[correction.status]) }}</p>
        <div v-if="isOpen(correction)" class="ai-panel__buttons ai-panel__buttons--start">
          <button :ref="'accept-' + correction.id" type="button" class="qc-button qc-button--outline qc-button--sm"
                  :aria-describedby="'ai-correction-' + correction.id" @click="accept(correction)">
            {{ t('ai-panel-accept') }}
          </button>
          <button v-if="correction.status === 'pending'" type="button" class="qc-button qc-button--ghost qc-button--sm"
                  :aria-describedby="'ai-correction-' + correction.id" @click="ignore(correction)">
            {{ t('ai-panel-ignore') }}
          </button>
        </div>
      </li>
    </ul>

    <p v-if="state.dropped" class="ai-panel__hint">{{ tCount('ai-panel-corrections-dropped', state.dropped) }}</p>
    <p v-if="hasAccepted" class="ai-panel__hint">{{ t('ai-panel-correction-undo-hint', { keys: undoKeys }) }}</p>
  </template>
</div>
`;
