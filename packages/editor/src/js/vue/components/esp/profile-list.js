var Vue = require('vue/dist/vue.common');
var axios = require('axios');

const ProfileListComponent = Vue.component('profile-list', {
  props: {
    vm: { type: Object, default: () => ({}) },
    selectProfile: { type: Function, default: () => {}}
  },
  template: `
    <div>
     <ul id="example-1">
       <li v-for="profile in profiles" :key="profile.id" @click.prevent="() => selectProfile(profile)">>
         {{ profile.name }}
       </li>
     </ul>
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
          vm.notifier.success(this.vm.t('error-server'));
        });
    }
  },
});

module.exports = {
  ProfileListComponent
}
