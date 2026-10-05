'use strict';

/**
 * Markup of the text generation modal (epic #1163), kept out of the component so
 * neither file grows past what is comfortable to read.
 *
 * Three states: the optional instruction, the proposals to pick from, and the
 * confirmation once applied — which keeps an undo, because the subject lives in
 * the email metadata, outside the editor's Ctrl+Z.
 */
module.exports = `
<modal-component ref="modalRef" class="medium-modal text-generation" :isLoading="isLoading" :maxWidth="640">
  <div class="modal-content">
    <h5 class="text-generation__title">{{ t('text-generation-title') }}</h5>

    <div v-if="error" class="text-generation__error" role="alert">{{ error }}</div>

    <template v-if="step === 'brief'">
      <p class="text-generation__intro">{{ t('text-generation-intro') }}</p>
      <label for="text-generation-brief" class="text-generation__label">{{ t('text-generation-brief-label') }}</label>
      <textarea id="text-generation-brief"
                class="text-generation__brief"
                v-model="brief"
                rows="2"
                maxlength="500"
                :placeholder="t('text-generation-brief-placeholder')"></textarea>
    </template>

    <template v-if="step === 'subjects'">
      <p class="text-generation__intro">{{ t('text-generation-subjects-title') }}</p>
      <p v-if="!canApplySubject" class="text-generation__hint">{{ t('text-generation-copy-hint') }}</p>
      <p v-if="dropped && proposals.length" class="text-generation__hint">{{ t('text-generation-dropped', { count: dropped }) }}</p>
      <p v-if="!proposals.length" class="text-generation__hint">{{ t('text-generation-none') }}</p>

      <ul class="text-generation__proposals" role="radiogroup" :aria-label="t('text-generation-subjects-title')">
        <li v-for="(proposal, index) in proposals" :key="proposal.text" class="text-generation__proposal">
          <label class="text-generation__choice">
            <input v-if="canApplySubject" type="radio" name="text-generation-subject" :value="index" v-model="selectedIndex" />
            <span class="text-generation__text">{{ proposal.text }}</span>
          </label>
          <span class="text-generation__angle">{{ proposal.angle }}</span>
          <span class="text-generation__facts">
            {{ t('text-generation-length', { count: proposal.facts.length }) }}
            <template v-if="proposal.facts.truncatedOnMobile">
              — {{ t('text-generation-mobile', { preview: proposal.facts.mobilePreview }) }}
            </template>
          </span>
          <button v-if="!canApplySubject" type="button" class="btn-flat text-generation__copy" @click="copy(index)">
            {{ copiedIndex === index ? t('text-generation-copied') : t('text-generation-copy') }}
          </button>
        </li>
      </ul>
    </template>

    <template v-if="step === 'applied'">
      <p class="text-generation__intro">{{ t('text-generation-applied') }}</p>
      <p class="text-generation__text">{{ appliedSubject }}</p>
    </template>
  </div>

  <div class="modal-footer">
    <template v-if="step === 'brief'">
      <button type="button" class="btn-flat" @click="close">{{ t('text-generation-cancel') }}</button>
      <button type="button" class="btn" @click="requestSubjects">{{ t('text-generation-generate') }}</button>
    </template>
    <template v-if="step === 'subjects'">
      <button type="button" class="btn-flat" @click="close">{{ t('text-generation-close') }}</button>
      <button type="button" class="btn-flat" @click="requestSubjects">{{ t('text-generation-more') }}</button>
      <button v-if="canApplySubject" type="button" class="btn" :disabled="selectedIndex === null" @click="applySubject">
        {{ t('text-generation-apply') }}
      </button>
    </template>
    <template v-if="step === 'applied'">
      <button type="button" class="btn-flat" @click="undo">{{ t('text-generation-undo') }}</button>
      <button type="button" class="btn" @click="close">{{ t('text-generation-close') }}</button>
    </template>
  </div>
</modal-component>
`;
