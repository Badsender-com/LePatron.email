'use strict';

/**
 * Markup of the steps of a "corrections" action (ADR 0011): the analysis, then
 * the corrections to accept or ignore, « Tout accepter » first. Nothing is
 * written before « Accepter »; the editor's undo takes an accepted correction
 * back. A correction answered takes one line. On the whole email, the
 * corrections show block by block as they come, each block with its own
 * « Tout accepter » and « Aller au bloc ». A rewrite says so, and is left out
 * of « Tout accepter ».
 */

// One correction: its field, the change, the reason, and what the user did.
const correction = `
        <li v-for="correction in group.corrections" :key="correction.id" class="ai-panel__correction"
            :class="['ai-panel__correction--' + correction.status, { 'ai-panel__correction--answered': !isOpen(correction) }]">
          <p v-if="isOpen(correction) && state.target.kind !== 'blockField' && ROLE_LABELS[correction.role]" class="ai-panel__field-label">
            {{ t(ROLE_LABELS[correction.role]) }}
          </p>
          <p v-if="correction.rewrite && isOpen(correction)" :id="'ai-rewrite-' + correction.id" class="ai-panel__rewrite"
             :title="t('ai-panel-correction-rewrite-hint')">
            <span class="ai-panel__rewrite-badge">{{ t('ai-panel-correction-rewrite') }}</span>
            <span class="qc-sr-only">{{ t('ai-panel-correction-rewrite-hint') }}</span>
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
                    :aria-describedby="'ai-correction-' + correction.id + (correction.rewrite ? ' ai-rewrite-' + correction.id : '')"
                    @click="accept(correction)">
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
    <span class="qc-notice__text">{{ t('ai-panel-correction-paused', { seconds: pauseSeconds }) }}</span>
  </p>

  <div v-if="state.isLoading" ref="status" tabindex="-1" class="ai-panel__status">
    <span class="qc-spinner" aria-hidden="true"></span>
    <span v-if="state.progress">
      {{ t('ai-panel-correcting-blocks', { done: Math.min(state.progress.done + 1, state.progress.total), total: state.progress.total }) }}
    </span>
    <span v-else>{{ t('ai-panel-correcting') }}</span>
    <button v-if="state.progress && !state.stopped" ref="stop" type="button" class="qc-button qc-button--ghost qc-button--sm" @click="stop">
      {{ t('ai-panel-correction-stop') }}
    </button>
  </div>

  <p v-if="!state.isLoading && stoppedLabel" class="qc-notice">
    <span class="qc-notice__text">{{ stoppedLabel }}</span>
  </p>

  <p v-if="emptyOutcome" ref="summary" tabindex="-1" class="qc-notice ai-panel__applied">
    <span class="lucide" :class="emptyOutcome === 'ai-panel-no-correction' ? 'lucide-check' : 'lucide-info'" aria-hidden="true"></span>
    <span class="qc-notice__text">{{ t(emptyOutcome) }}</span>
  </p>

  <div v-if="canResume || canRestart" class="ai-panel__buttons ai-panel__buttons--start">
    <button v-if="canResume" ref="resume" type="button" class="qc-button qc-button--outline qc-button--sm" @click="resume">
      {{ t('ai-panel-correction-resume') }}
    </button>
    <button v-if="canRestart" ref="restart" type="button" class="qc-button qc-button--ghost qc-button--sm" @click="restart">
      {{ t('ai-panel-correction-restart') }}
    </button>
  </div>

  <template v-if="state.corrections.length">
    <div class="ai-panel__corrections-head">
      <p id="ai-panel-corrections" ref="summary" tabindex="-1" class="ai-panel__intro">{{ countLabel }}</p>
      <button v-if="acceptable.length > 1 && !state.isLoading" type="button" class="qc-button qc-button--cta qc-button--sm" @click="acceptAll">
        {{ t(openRewrites.length ? 'ai-panel-accept-all-but-rewrites' : 'ai-panel-accept-all') }}
      </button>
    </div>

    <section v-for="group in groups" :key="group.blockId || 'one'" class="ai-panel__group">
      <div v-if="group.label" class="ai-panel__group-head">
        <h3 :id="group.id" class="ai-panel__section">{{ group.label }}</h3>
        <button v-if="session.canGoToBlock(group.blockId)" type="button" class="qc-button qc-button--outline qc-button--sm"
                :aria-describedby="group.id" @click="goToBlock(group.blockId)">
          {{ t('ai-panel-go-to-block') }}<span class="lucide lucide-arrow-right" aria-hidden="true"></span>
        </button>
      </div>
      <ul class="ai-panel__corrections" :aria-labelledby="group.label ? group.id : 'ai-panel-corrections'">${correction}
      </ul>
      <button v-if="group.label && group.acceptable > 1" type="button" class="qc-button qc-button--outline qc-button--sm ai-panel__accept-block"
              :aria-describedby="group.id" @click="acceptBlock(group)">
        {{ t(group.rewrites ? 'ai-panel-accept-block-but-rewrites' : 'ai-panel-accept-block') }}
      </button>
    </section>

    <p v-if="hasAccepted" class="ai-panel__hint">{{ t('ai-panel-correction-undo-hint', { keys: undoKeys }) }}</p>
  </template>

  <template v-if="state.done || state.corrections.length">
    <p v-if="state.failedBlocks.length" class="qc-notice qc-notice--error" role="alert">
      {{ t('ai-panel-blocks-failed', { blocks: failedLabels }) }}
    </p>
    <p v-if="state.unchecked" class="qc-notice qc-notice--error">{{ tCount('ai-panel-unchecked', state.unchecked) }}</p>
    <p v-if="state.leftOut && state.leftOut.sample" class="ai-panel__hint">
      {{ tCount('ai-panel-left-out-sample', state.leftOut.sample) }}
    </p>
    <p v-if="state.tooLong" class="ai-panel__hint">{{ tCount('ai-panel-left-out-too-long', state.tooLong) }}</p>
    <p v-if="state.dropped" class="ai-panel__hint">{{ tCount('ai-panel-corrections-dropped', state.dropped) }}</p>
  </template>
</div>
`;
