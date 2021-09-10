const Vue = require('vue/dist/vue.common');
const isEmail = require('validator/lib/isEmail');
const { validationMixin } = require('vuelidate');
const { ModalComponent } = require('../modal/modalComponent');
const { SelectComponent } = require('../select/selectComponent');

const TestModalComponent = Vue.component('TestModal', {
  components: {
    ModalComponent,
    SelectComponent
  },
  mixins: [validationMixin],
  props: {
    vm: { type: Object, default: () => ({}) },
  },
  data: () => ({
    inputEmailsTest: null,
    selectedEmailGroup: null,
    isLoading: false,
    subscriptions: [],
    style: {
      mb0: {
        marginBottom: 0,
      },
      mt0: {
        marginTop: 0,
      },
      pl4: {
        paddingLeft: '40px',
      },
      floatLeft: {
        float: 'left',
      },
      colorOrange: {
        color: '#f57c00',
      },
    },
    emailsGroups: [
      {
        name: 'Emails group',
        emails: 'test@mail.com;test2@mail.com',
        createdAt: '2021-09-07T16:42:57.986Z',
        group: '6033d372febd9f638d2943af',
        id: '6137969116c4b07f4fc5ce56',
      },
      {
        name: 'Emails group 2',
        emails: 'test@mail.com;test2@mail.com',
        createdAt: '2021-09-07T16:42:57.986Z',
        group: '6033d372febd9f638d2943af',
        id: '6137969116c4b07f4fc5ce56',
      },
    ],
    options: [{label: 'Canada', code: 'Ca'}, {label: 'france', code: 'Fr'}]
  }),
  mounted() {
    console.log('======= Component mounted =========');
    console.log({ vm: this.vm });
    this.subscriptions = [
      this.vm.openTestModal.subscribe(this.handleOpenTestModalChange),
    ];
  },
  beforeDestroy() {
    this.subscriptions.forEach((subscription) => subscription.dispose());
  },
  methods: {
    openModal() {
      console.log(this.$refs.modalRef);
      this.$refs.modalRef?.openModal();
    },
    closeModal() {
      this.$refs.modalRef?.closeModal();
    },
    handleOpenTestModalChange(value) {
      console.log(value);
      if (value === true) {
        this.openModal();
      }
    },
    handleOnClose(value) {
      console.log('calling handleOnClose');
      this.vm.openTestModal(false);
    },
  },
  template: `
<modal-component 
    ref="modalRef"
    :isLoading="isLoading"
    :onClose="handleOnClose">
    <div class="modal-content">
        <div class="row">
        <div class="col s12">
            <h2>{{vm.t('Test email address')}}</h2>
        </div>
        <form class="col s12">
            <div class="row" :style="style.mb0">
            <div class="input-field col s12" :style="style.mb0">
           
                <input
                  id="testMails"
                  v-model="inputEmailsTest"
                  type="text"
                  name="emailsTest"
                  :placeholder="vm.t('Insert here the recipient email address')"
                  required
                  class="validate"
                >
                <label for="testMails">{{ vm.t('emailsTest') }}</label>
                <span class="helper-text" :data-error="vm.t('mail-name-required')"></span>
            </div>
            </div>
            <div class="row" :style="style.mb0">
            <div class="input-field col s12 m6">
                <select-component :options="options"></select-component>
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
            :disabled="isLoading"
            :style="[style.mb0, style.mt0]"
            class="btn waves-effect waves-light"
            type="submit"
            name="submitAction">
            <span v-if="isLoading">{{ vm.t('sendingTestMails') }}</span>
            <span v-else>{{ vm.t('sendTestMails') }} <i class="fa fa-paper-plane" aria-hidden="true"></i></span>
        </button>
    </div>
</modal-component>
    `,
  validations() {
    return {
      inputEmailsTest: {
        allMustBeEmails(value) {
          const emails = value.split(';');
          for (const address of emails) {
            if (!isEmail(address)) {
              return false;
            }
          }
          return true;
        },
      },
    };
  },
});

module.exports = {
  TestModalComponent,
};
