'use strict';

/**
 * Markup of the steps of a "corrections" action (ADR 0005): the analysis, then
 * the corrections to accept or ignore, « Tout accepter » first. Nothing is
 * written before « Accepter »; the editor's undo takes an accepted correction
 * back. A correction answered takes one line. On the whole email, the
 * corrections show block by block as they come, each block with its own
 * « Tout accepter » and « Aller au bloc ».
 */

// One correction: its field, the change, the reason, and what the user did.
const correction = `
        <li v-for="correction in group.corrections" :key="correction.id" class="ai-panel__correction"
            :class="['ai-panel__correction--' + correction.status, { 'ai-panel__correction--answered': !isOpen(correction) }]">
          <p v-if="isOpen(correction) && state.target.kind !== 'blockField' && ROLE_LABELS[correction.role]" class="ai-panel__field-label">
            {{ t(ROLE_LABELS[correction.role]) }}
          </p>
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
        </li>`;

module.exports = `
<div class="ai-panel__steps" @keydown="onKeydown">
  <p v-if="state.error" class="qc-notice qc-notice--error" role="alert">{{ t(state.error) }}</p>

  <p v-if="state.pausedFor" class="qc-notice">
    <span class="lucide lucide-info" aria-hidden="true"></span>
    <span class="qc-notice__text">{{ t('ai-panel-correction-paused', { seconds: state.pausedFor }) }}</span>
  </p>

  <div v-if="state.isLoading" class="ai-panel__status">
    <span class="qc-spinner" aria-hidden="true"></span>
    <span v-if="state.progress">
      {{ t('ai-panel-correcting-blocks', { done: Math.min(state.progress.done + 1, state.progress.total), total: state.progress.total }) }}
    </span>
    <span v-else>{{ t('ai-panel-correcting') }}</span>
    <button v-if="state.progress && !state.stopped" type="button" class="qc-button qc-button--ghost qc-button--sm" @click="stop">
      {{ t('ai-panel-correction-stop') }}
    </button>
  </div>

  <p v-if="state.done && state.stopped" class="qc-notice">
    <span class="qc-notice__text">
      {{ t(state.progress.done === 1 ? 'ai-panel-correction-stopped-one' : 'ai-panel-correction-stopped', { done: state.progress.done, total: state.progress.total }) }}
    </span>
  </p>

  <p v-if="state.nothingToCorrect" ref="summary" tabindex="-1" class="qc-notice ai-panel__applied">
    <span class="lucide lucide-info" aria-hidden="true"></span>
    <span class="qc-notice__text">{{ t('ai-panel-nothing-to-correct') }}</span>
  </p>

  <p v-else-if="state.done && !state.corrections.length && !state.stopped" ref="summary" tabindex="-1" class="qc-notice ai-panel__applied">
    <span class="lucide lucide-check" aria-hidden="true"></span>
    <span class="qc-notice__text">{{ t('ai-panel-no-correction') }}</span>
  </p>

  <template v-if="state.corrections.length">
    <div class="ai-panel__corrections-head">
      <p id="ai-panel-corrections" ref="summary" tabindex="-1" class="ai-panel__intro">
        {{ tCount('ai-panel-corrections-count', state.corrections.length) }}
      </p>
      <button v-if="open.length > 1 && !state.isLoading" type="button" class="qc-button qc-button--cta qc-button--sm" @click="acceptAll">
        {{ t('ai-panel-accept-all') }}
      </button>
    </div>

    <section v-for="group in groups" :key="group.blockId || 'one'" class="ai-panel__group">
      <div v-if="group.label" class="ai-panel__group-head">
        <h3 class="ai-panel__section">{{ group.label }}</h3>
        <button v-if="session.canGoToBlock(group.blockId)" type="button" class="qc-button qc-button--outline qc-button--sm"
                @click="goToBlock(group.blockId)">
          {{ t('ai-panel-go-to-block') }}<span class="lucide lucide-arrow-right" aria-hidden="true"></span>
        </button>
      </div>
      <ul class="ai-panel__corrections" :aria-label="group.label || null" :aria-labelledby="group.label ? null : 'ai-panel-corrections'">${correction}
      </ul>
      <button v-if="group.label && group.open > 1" type="button" class="qc-button qc-button--outline qc-button--sm ai-panel__accept-block"
              @click="acceptBlock(group)">
        {{ t('ai-panel-accept-block') }}
      </button>
    </section>

    <p v-if="hasAccepted" class="ai-panel__hint">{{ t('ai-panel-correction-undo-hint', { keys: undoKeys }) }}</p>
  </template>

  <template v-if="state.done || state.corrections.length">
    <p v-if="state.failedBlocks.length" class="qc-notice qc-notice--error" role="alert">
      {{ t('ai-panel-blocks-failed', { blocks: failedLabels }) }}
    </p>
    <p v-if="state.leftOut && state.leftOut.sample" class="ai-panel__hint">
      {{ tCount('ai-panel-left-out-sample', state.leftOut.sample) }}
    </p>
    <p v-if="state.tooLong" class="ai-panel__hint">{{ tCount('ai-panel-left-out-too-long', state.tooLong) }}</p>
    <p v-if="state.dropped" class="ai-panel__hint">{{ tCount('ai-panel-corrections-dropped', state.dropped) }}</p>
  </template>
</div>
`;
