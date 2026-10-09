'use strict';

/**
 * Markup of the AI panel (ADR 0004), kept out of the component so neither file
 * grows past what is comfortable to read. Header, buttons, notices and spinner
 * come from the right panels' shared kit (badsender-right-panel-ui.less).
 *
 * Two views: the lists of actions (the selected element's, the whole email's),
 * and the steps of the action under way, rendered by the component of its
 * family (ai-proposals-steps.js for text generation).
 */

module.exports = `
<section class="ai-panel" role="dialog" aria-modal="false" aria-labelledby="ai-panel-title">
  <header class="right-panel__header">
    <div>
      <p class="right-panel__eyebrow">{{ t('ai-panel-title') }}</p>
      <h2 id="ai-panel-title" ref="heading" tabindex="-1" class="right-panel__title">
        {{ session ? t(labelsOf(session.state.action).name) : t('ai-panel-actions') }}
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
            <button type="button" class="ai-panel__action" @click="openAction(item.id, target)">
              <span class="lucide lucide-bot" aria-hidden="true"></span>
              <span>{{ t(labelsOf(item.id).name) }}</span>
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
            <span>{{ t(labelsOf(item.id).name) }}</span>
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

      <component :is="stepsOf(session)" :key="sessionKey" :vm="vm" :session="session" :action="sessionAction"
                 :labels-of="labelsOf" @open-action="openAction" @announce="announce" @changed="refresh"></component>
    </template>
  </div>
</section>
`;
