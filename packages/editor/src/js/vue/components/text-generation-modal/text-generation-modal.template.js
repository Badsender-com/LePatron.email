'use strict';

/**
 * Markup of the text generation modal (epic #1163), kept out of the component so
 * neither file grows past what is comfortable to read.
 *
 * Four states: the optional instruction, the subjects, the preheaders built
 * from the picked subject, and the confirmation once applied — which keeps an
 * undo, because the subject lives in the email metadata, outside the editor's
 * Ctrl+Z.
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

    <template v-if="step === 'subjects' || step === 'preheaders'">
      <p v-if="step === 'preheaders'" class="text-generation__picked">
        {{ t('text-generation-picked-subject', { subject: pickedSubject }) }}
      </p>
      <p class="text-generation__intro">
        {{ step === 'subjects' ? t('text-generation-subjects-title') : t('text-generation-preheaders-title') }}
      </p>
      <p v-if="!canApply" class="text-generation__hint">
        {{ step === 'subjects' ? t('text-generation-copy-hint') : t('text-generation-copy-hint-preheader') }}
      </p>
      <p v-if="current.dropped && current.proposals.length" class="text-generation__hint">
        {{ t('text-generation-dropped', { count: current.dropped }) }}
      </p>
      <p v-if="!current.proposals.length" class="text-generation__hint">{{ t('text-generation-none') }}</p>

      <ul class="text-generation__proposals" role="radiogroup"
          :aria-label="step === 'subjects' ? t('text-generation-subjects-title') : t('text-generation-preheaders-title')">
        <li v-for="(proposal, index) in current.proposals" :key="index" class="text-generation__proposal">
          <label class="text-generation__choice">
            <input v-if="step === 'subjects' || canApply" type="radio" :name="'text-generation-' + step"
                   :value="index" v-model="current.selectedIndex" />
            <span class="text-generation__text">{{ proposal.text }}</span>
          </label>
          <span class="text-generation__angle">{{ proposal.angle }}</span>
          <span class="text-generation__facts">
            {{ t('text-generation-length', { count: proposal.facts.length }) }}<template
              v-if="proposal.facts.truncatedOnMobile"> — {{ t('text-generation-mobile', { preview: proposal.facts.mobilePreview }) }}</template><template
              v-if="proposal.facts.tooShort"> — {{ t('text-generation-short') }}</template><template
              v-if="proposal.facts.tooLong"> — {{ t('text-generation-long') }}</template>
          </span>
          <button v-if="!canApply" type="button" class="btn-flat text-generation__copy" @click="copy(index)">
            {{ current.copiedIndex === index ? t('text-generation-copied') : t('text-generation-copy') }}
          </button>
        </li>
      </ul>
    </template>

    <template v-if="step === 'applied'">
      <p class="text-generation__intro">{{ t('text-generation-applied') }}</p>
      <p v-if="applied.subject" class="text-generation__applied">
        {{ t('text-generation-applied-subject') }} <strong>{{ applied.subject }}</strong>
      </p>
      <p v-if="applied.preheader" class="text-generation__applied">
        {{ t('text-generation-applied-preheader') }} <strong>{{ applied.preheader }}</strong>
      </p>
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
      <button v-if="canApplySubject" type="button" class="btn-flat" :disabled="!pickedSubject"
              @click="apply({ withPreheader: false })">
        {{ t('text-generation-apply-subject-only') }}
      </button>
      <button type="button" class="btn" :disabled="!pickedSubject" @click="requestPreheaders">
        {{ t('text-generation-to-preheaders') }}
      </button>
    </template>
    <template v-if="step === 'preheaders'">
      <button type="button" class="btn-flat" @click="backToSubjects">{{ t('text-generation-back') }}</button>
      <button type="button" class="btn-flat" @click="requestPreheaders">{{ t('text-generation-more') }}</button>
      <button v-if="canApplySubject || canApplyPreheader" type="button" class="btn"
              :disabled="canApplyPreheader && !pickedPreheader" @click="apply({ withPreheader: true })">
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
