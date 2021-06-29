var Vue = require('vue/dist/vue.common');
var axios = require('axios');

const ProfileListComponent = Vue.component('profile-list', {
  props: {
    vm: { type: Object, default: () => ({}) },
    selectProfile: { type: Function, default: () => {}}
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
          console.log({profileListError: error});
          vm.notifier.error(this.vm.t('error-server'));
        });
    }
  },
});

module.exports = {
  ProfileListComponent
}
