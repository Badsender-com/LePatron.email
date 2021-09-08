import {required} from 'vuelidate/lib/validators';

const Vue = require('vue/dist/vue.common');
const { SEND_MODE } = require('../../../constant/send-mode');
const { ESP_TYPE } = require('../../../constant/esp-type');
const  { validationMixin } = require('vuelidate');

const SendinBlueComponent = Vue.component('SendinBlueComponent', {
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
        senderName: '',
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
    },
    nameLabelText() {
      return this.contentSendTypeLowerCase() + 'Name'
    },
    subjectLabelText() {
      return this.contentSendTypeLowerCase() + 'Subject'
    },
    nameRequiredText() {
      return this.contentSendTypeLowerCase() + '-name-required'
    },
    subjectRequiredText() {
      return this.contentSendTypeLowerCase() + '-subject-required'
    }
  },
  mounted() {

    const { campaignMailName, subject, id, additionalApiData: { senderName, senderMail, replyTo } } = this.fetchedProfile;

    this.profile = {
      campaignMailName: campaignMailName ?? '',
      senderName: senderName ?? '',
      senderMail: senderMail ?? '',
      replyTo: replyTo ?? '',
      subject: subject ?? '',
      id: id ?? '',
    };
    M.updateTextFields();
  },
  methods: {
    onSubmit() {
      M.updateTextFields();
      this.$v.$touch();
      if (this.$v.$invalid) {
        return;
      }

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
              id="name"
              v-model="profile.campaignMailName"
              type="text"
              name="name"
              required
              :placeholder="vm.t(nameLabelText)"
              @input="$v.profile.campaignMailName.$touch()"
              @blur="$v.profile.campaignMailName.$touch()"
              :class="[
                    'validate',
                    $v.profile.campaignMailName.required ? 'valid' : 'invalid',
                ]"
            >
            <label for="name">{{ vm.t(nameLabelText) }}</label>
            <span v-if="!$v.profile.campaignMailName.required" class="helper-text" :data-error="vm.t(nameRequiredText)"></span>

          </div>
        </div>
        <div class="row" :style="style.mb0">
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="subject"
              type="text"
              v-model="profile.subject"
              :placeholder="vm.t(subjectLabelText)"
              name="subject"
              required
              :class="[
                    'validate',
                    $v.profile.subject.required ? 'valid' : 'invalid',
                ]"
              class="validate"
            >
            <label for="subject" class="active">{{ vm.t(subjectLabelText) }}</label>
            <span class="helper-text" :data-error="vm.t(subjectRequiredText)"></span>

          </div>
        </div>
        <div class="row" :style="style.mb0">
          <div class="input-field col s12" :style="style.mb0">
            <input
              id="sender-name"
              type="text"
              v-model="profile.senderName"
              disabled
              :placeholder="vm.t('sender-name')"
              name="senderName"
            >
            <label for="sender-name" class="active">{{ vm.t('sender-name') }}</label>
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
          required,
        },
        subject: {
          required,
        },
      }
    }
  },
})

module.exports = {
  SendinBlueComponent
}
