'use strict';

/**
 * Markup of the AI panel (ADR 0010), kept out of the component so neither file
 * grows past what is comfortable to read. Its header, close and back arrow are
 * the right panels' shell (ADR 0020); buttons, notices and spinner come from
 * their shared kit (badsender-right-panel-ui.less).
 *
 * Two views: the lists of actions (the selected element's, the whole email's),
 * and the steps of the action under way, rendered by the component of its
 * family (ai-proposals-steps.js for text generation).
 */

module.exports = `
<right-panel-shell
  ref="shell"
  class="ai-panel"
  title-id="ai-panel-title"
  :title="session ? nameOf(session.state.action, session.state.target) : t('ai-panel-title')"
  :close-label="t('right-panel-close')"
  :back-label="session ? t('ai-panel-back') : ''"
  @back="showList()"
  @close="vm.rightPanel.hide()"
>
  <div class="ai-panel__body" :class="{ 'ai-panel__body--targeted': !session && target.kind !== 'email' }">
    <p class="qc-sr-only" aria-live="polite">{{ liveMessage }}</p>

    <!-- The list (boards a1, a2): what the selection offers, the action of
         the finest selection first and set forth, then the whole email's. -->
    <template v-if="!session">
      <p v-if="target.kind === 'email'" class="ai-panel__invite">
        <span class="lucide lucide-box" aria-hidden="true"></span>
        {{ t('ai-panel-select-invite') }}
      </p>
      <template v-else>
        <h3 class="ai-panel__section">
          {{ target.kind === 'block' ? t('ai-panel-selected-block') : t('ai-panel-selected-field') }}<span v-if="blockOf(target)" class="ai-panel__section-meta"> · {{ blockOf(target) }}</span>
        </h3>
        <ul v-if="targetActions.length" class="ai-panel__actions">
          <li v-for="(item, i) in targetActions" :key="item.id">
            <button type="button" class="ai-panel__action" :class="{ 'ai-panel__action--first': i === 0 }" @click="openAction(item.id, target)">
              <span :class="['lucide', iconOf(item.id), 'ai-panel__action-icon']" aria-hidden="true"></span>
              <span class="ai-panel__action-text">
                <span class="ai-panel__action-name">{{ nameOf(item.id, target) }}</span>
                <span v-if="descriptionOf(item.id, target)" class="ai-panel__action-desc">{{ descriptionOf(item.id, target) }}</span>
              </span>
              <span class="lucide lucide-chevron-right ai-panel__action-chevron" aria-hidden="true"></span>
            </button>
          </li>
        </ul>
        <p v-else class="ai-panel__hint">{{ t('ai-panel-no-action-yet') }}</p>
      </template>
      <h3 class="ai-panel__section">{{ t('ai-panel-whole-email') }}</h3>
      <ul class="ai-panel__actions">
        <li v-for="item in actions" :key="item.id">
          <button type="button" class="ai-panel__action" @click="openAction(item.id)">
            <span :class="['lucide', iconOf(item.id), 'ai-panel__action-icon']" aria-hidden="true"></span>
            <span class="ai-panel__action-text">
              <span class="ai-panel__action-name">{{ nameOf(item.id, { kind: 'email' }) }}</span>
              <!-- With a selection, the email's actions go by their name (a2). -->
              <span v-if="!item.canApply || target.kind === 'email'" class="ai-panel__action-desc">{{ item.canApply ? descriptionOf(item.id, { kind: 'email' }) : t('ai-panel-copy-only') }}</span>
            </span>
            <span class="lucide lucide-chevron-right ai-panel__action-chevron" aria-hidden="true"></span>
          </button>
        </li>
      </ul>
      <p class="ai-panel__note">{{ t('ai-panel-list-note') }}</p>
    </template>

    <template v-else>
      <p v-if="selectionChanged" class="qc-notice ai-panel__moved">
        <span class="qc-notice__text">{{ t('ai-panel-selection-changed') }}</span>
        <button type="button" class="qc-link-button" @click="showList(selectionChanged)">
          {{ t('ai-panel-see-its-actions') }}
        </button>
      </p>

      <component ref="steps" :is="stepsOf(session)" :key="sessionKey" :vm="vm" :session="session" :action="sessionAction"
                 :labels-of="labelsOf" @open-action="openAction" @announce="announce" @changed="refresh"
                 @footer="footer = $event" @back="showList()"></component>
    </template>
  </div>

  <template v-if="session && footer.length" v-slot:footer>
    <button v-for="button in footer" :key="button.id" type="button"
            :class="['qc-button', button.primary ? 'qc-button--cta' : 'qc-button--outline']"
            :disabled="button.disabled" @click="onFooter(button.id)" @keydown="onFooterKey">
      <span v-if="button.icon" :class="['lucide', button.icon]" aria-hidden="true"></span>{{ button.label }}
    </button>
  </template>
</right-panel-shell>
`;
