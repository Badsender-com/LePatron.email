const Vue = require('vue/dist/vue.common');
const axios = require('axios');
const { getPersonalizedBlocks } = require('../../utils/apis');
const debounce = require('lodash.debounce');
const DEBOUNCE_DELAY_MS = 400;

const PersonalizedBlocksListComponent = Vue.component(
  'PersonalizedBlocksListComponent',
  {
    props: {
      vm: { type: Object, default: () => ({}) },
    },
    data: () => ({
      isLoading: false,
      searchTerm: '',
    }),
    mounted() {
      this.fetchPersonalizedBlocks();
      // Initialize debounced function
      this.debouncedFetch = debounce(
        this.fetchPersonalizedBlocks,
        DEBOUNCE_DELAY_MS
      );
      // Add a global event listener to refresh the list of personalized blocks when a new block is added.
      window.addEventListener(
        'personalizedBlockApiActionApplied',
        this.fetchPersonalizedBlocks
      );
    },
    beforeDestroy() {
      // Make sure to remove the listener when the component is destroyed
      window.removeEventListener(
        'personalizedBlockApiActionApplied',
        this.fetchPersonalizedBlocks
      );
    },
    methods: {
      fetchPersonalizedBlocks() {
        this.isLoading = true;
        this.vm.personalizedBlocks([]);
        const groupId = this.vm?.metadata?.groupId;

        axios
          .get(getPersonalizedBlocks(), {
            params: { groupId, searchTerm: this.searchTerm },
          })
          .then((response) => {
            this.vm.personalizedBlocks(
              response.data?.items.map(({ content, ...blockInformation }) => ({
                ...content,
                blockInformation,
                id: '',
              }))
            );
            this.isLoading = false;
          })
          .catch((error) => {
            this.vm.notifier.error(
              this.vm.t('personalized-blocks-fetch-error')
            );
            this.isLoading = false;
          });
      },
    },
    template: `
    <div id="personalized-blocks-list">
      <!-- Input field with style and search icon -->
      <div class="input-field search-container">
        <input type="text" 
         v-model="searchTerm" 
         @input="debouncedFetch" 
         :placeholder="vm.t('personalized-blocks-search-placeholder')" 
         class="search-input"
         id="searchBlock"/>
        <label for="searchBlock"><i class="fa fa-search search-icon"></i></label> <!-- Search Icon -->
      </div>
      <div v-if="isLoading" class="loading-state">
        <!-- Loading Spinner -->
        <span>{{ vm.t('personalized-blocks-loading') }}</span>
      </div>
      <div v-else-if="vm.personalizedBlocks().length === 0 && searchTerm" class="empty-state-search">
        <!-- Empty Search State -->
        <span>{{ vm.t('personalized-blocks-empty-search') }}</span>
      </div>
      <div v-else-if="vm.personalizedBlocks().length === 0" class="empty-state">
        <!-- General Empty State -->
        <span>{{ vm.t('personalized-blocks-empty') }}</span>
      </div>
    </div>
    `,
  }
);

module.exports = {
  PersonalizedBlocksListComponent,
};
