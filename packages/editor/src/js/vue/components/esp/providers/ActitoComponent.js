import { required } from 'vuelidate/lib/validators';

const Vue = require('vue/dist/vue.common');
const { SEND_MODE } = require('../../../constant/send-mode');
const { ESP_TYPE } = require('../../../constant/esp-type');
const  { validationMixin } = require('vuelidate');


const ActitoComponent = Vue.component('ActitoComponent', {
  mixins: [validationMixin],
  props: {
    vm: { type: Object, default: () => ({}) },
    campaignMailName: { type: String, default: null},
    loading: { type: Boolean, default: false},
    closeModal: { type: Function, default: () => {}},
    espId: { type: String, default: null  },
    selectedProfile: { type: Object, default: () => ({}) },
    fetchedProfile: {type: Object, default: () => ({})},
    campaignId: { type: String, default: null },
    type: { type: Number, default: SEND_MODE.CREATION  },
  },
  data() {

    return {
      profile: {
        campaignMailName: '',
        entity: '',
        encodingType: '',
        supportedLanguage: '',
        targetTable: '',
        senderMail: '',
        replyTo: '',
        subject: '',
        type: ESP_TYPE.SENDINBLUE,
      },
      style: {
        mb0:{
          marginBottom: 0,
        },
        mt0:{
          marginTop: 0,
        },
        pl4:{
          paddingLeft: '40px',
        },
        floatLeft: {
          float: 'left'
        },
        colorOrange:{
          color: '#f57c00'
        }
      }
    }
  },
  computed: {
    isEditMode() {
      return this.type === SEND_MODE.EDIT
    }
  },
  mounted() {

    const {
      subject,
      campaignMailName,
      id,
      additionalApiData: {
        entity,
        targetTable,
        senderMail,
        encodingType,
        supportedLanguage,
        replyTo
      }
    } = this.fetchedProfile;

    this.profile = {
      id: id ?? '',
      campaignMailName: campaignMailName ?? '',
      entity: entity ?? '',
      encodingType: encodingType ?? '',
      supportedLanguage: supportedLanguage ?? '',
      targetTable: targetTable ?? '',
      senderMail: senderMail ?? '',
      replyTo: replyTo ?? '',
      subject: subject ?? '',
    }

    M.updateTextFields();
  },
  methods: {
    onSubmit() {
      M.updateTextFields();
      this.$v.$touch();

      if (this.$v.$invalid) {
        return;
      }

      this.profile.campaignMailName = this.profile.campaignMailName?.replace(/[^A-Z0-9]+/ig, '_');

      this.$emit('submit', this.profile);
    },
    contentSendTypeLowerCase() {
      return this.fetchedProfile?.contentSendType?.toString()?.toLowerCase() ?? 'mail';
    },
  },
  template: `
<div>
  <div class="modal-content">
    <div class="row">
      <div class="col s12">
        <h2>{{vm.t('export-to')}} {{selectedProfile.name}}</h2>
      </div>
      <form class="col s12">
        <div class="row" v-if="isEditMode">
          <div class="col s12">
            <div class="card-panel blue-grey lighten-5">
              <div>
                <div :style="style.floatLeft">
                  <i class="fa fa-exclamation-circle fa-2x" aria-hidden="true" :style="style.colorOrange"></i>
                </div>
                <div :style="style.pl4">
                  <span>{{vm.t('warning-esp-message')}}</span>
                </div>
              </div>

            </div>
          </div>
        </div>
        <div class="row" :style="style.mb0">
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="campaignMailName"
              v-model="profile.campaignMailName"
              type="text"
              name="campaignMailName"
              :placeholder="vm.t('mailName')"
              :class="['validate',
                    $v.profile.campaignMailName.required ? 'valid' : 'invalid',
                ]"
              required
              class="validate"
            >
            <label for="campaignMailName">{{ vm.t('mailName') }}</label>
            <span class="helper-text" :data-error="vm.t('mail-name-required')"></span>

          </div>
        </div>
        <div class="row" :style="style.mb0">
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="subject"
              type="text"
              v-model="profile.subject"
              :placeholder="vm.t('mailSubject')"
              name="subject"
              required
              :class="[
                    'validate',
                    $v.profile.subject.required ? 'valid' : 'invalid',
                ]"
              class="validate"
            >
            <label for="subject" class="active">{{ vm.t('mailSubject') }}</label>
            <span class="helper-text" :data-error="vm.t('mail-subject-required')"></span>

          </div>
        </div>
        <div class="row" :style="style.mb0">
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="entity"
              type="text"
              v-model="profile.entity"
              disabled
              :placeholder="vm.t('entity')"
              name="entity"
            >
            <label for="entity" class="active">{{ vm.t('entity') }}</label>
          </div>
        </div>
        <div class="row" :style="style.mb0">
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="target-table"
              type="text"
              v-model="profile.targetTable"
              disabled
              :placeholder="vm.t('target-table')"
              name="targetTable"
            >
            <label for="target-table" class="active">{{ vm.t('target-table') }}</label>
          </div>
        </div>
        <div class="row" :style="style.mb0">
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="supported-language"
              type="text"
              v-model="profile.supportedLanguage"
              disabled
              :placeholder="vm.t('supported-language')"
              name="supportedLanguage"
            >
            <label for="supported-language" class="active">{{ vm.t('supported-language') }}</label>
          </div>
        </div>
        <div class="row" :style="style.mb0">
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="encoding-type"
              type="text"
              v-model="profile.encodingType"
              disabled
              :placeholder="vm.t('encoding-type')"
              name="encodingType"
            >
            <label for="encoding-table" class="active">{{ vm.t('encoding-type') }}</label>
          </div>
        </div>
        <div class="row" :style="style.mb0">
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="sender-mail"
              type="text"
              v-model="profile.senderMail"
              disabled
              :placeholder="vm.t('sender-mail')"
              name="senderMail"
            >
            <label for="sender-mail" class="active">{{ vm.t('sender-mail') }}</label>
          </div>
        </div>
        <div class="row" :style="style.mb0">
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="replyto"
              type="text"
              :placeholder="vm.t('replyto')"
              v-model="profile.replyTo"
              name="replyto"
              disabled>
            <label for="replyto" class="active">{{ vm.t('replyto') }}</label>
          </div>
        </div>
      </form>
    </div>
  </div>
  <div class="modal-footer">
        <button
          @click.prevent="closeModal"
          class="btn-flat waves-effect waves-light"
          name="closeAction">
          {{ vm.t('close') }}
        </button>
        <button
          @click.prevent="onSubmit"
          :disabled="loading"
          :style="[style.mb0, style.mt0]"
          class="btn waves-effect waves-light"
          type="submit"
          name="submitAction">
          <span v-if="loading">{{ vm.t('exporting') }}</span>
          <span v-else>{{ vm.t('export') }} <i class="fa fa-paper-plane" aria-hidden="true"></i></span>
        </button>
  </div>
</div>
      `,
  validations() {
    return {
      profile: {
        campaignMailName: {
          required
        },
        subject: {
          required,
        },
      }
    }
  },
})

module.exports = {
  ActitoComponent
}
