const Vue = require('vue/dist/vue.common');
const axios = require('axios');

const ProfileListComponent = Vue.component('ProfileList', {
  props: {
    vm: { type: Object, default: () => ({}) },
    selectProfile: { type: Function, default: () => {}}
  },
  data: () => ({
    profiles: [],
  }),
  mounted() {
    this.fetchData();
  },
  methods: {
    fetchData() {
      const vm = this.vm;
      if(!this.vm?.metadata?.url?.profileList) {
        return;
      }

      axios.get(this.vm.metadata.url.profileList)
        .then((response) => {
          this.profiles = response?.data?.result;
        }).catch((error) => {
        // handle error
          console.log(error);
          vm.notifier.error(this.vm.t('error-server'));
        });
    }
  },
  template: `
    <div>
     <a
       v-for="profile in profiles" :key="profile.id" @click.prevent="() => selectProfile(profile)"
       class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only ui-state-hover ui-state-focus">
         {{ profile.name }}
     </a>
    </div>
      `,
});

module.exports = {
  ProfileListComponent
}
