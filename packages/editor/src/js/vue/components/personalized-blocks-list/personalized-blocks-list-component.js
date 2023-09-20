const Vue = require('vue/dist/vue.common');
const axios = require('axios');
const { getPersonalizedBlocks } = require('../../utils/apis');
const debounce = require('lodash.debounce');
const { INPUT_DEBOUNCE_DELAY_MS } = require('../../constant/blocks');

const PersonalizedBlocksListComponent = Vue.component(
  'PersonalizedBlocksListComponent',
  {
    props: {
      vm: { type: Object, default: () => ({}) },
    },
    data: () => ({
      isLoading: true,
      searchTerm: '',
    }),
    mounted() {
      this.debouncedFetch = debounce(
        this.fetchPersonalizedBlocks,
        INPUT_DEBOUNCE_DELAY_MS
      );
      this.currentMailingSubscription = this.vm.currentMailing.subscribe(
        (newMailing) => {
          if (newMailing) {
            this.fetchPersonalizedBlocks();
          }
        }
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

      if (this.currentMailingSubscription) {
        this.currentMailingSubscription.unsubscribe();
      }
    },
    methods: {
      handleSearch() {
        this.debouncedFetch();
      },
      fetchPersonalizedBlocks() {
        this.isLoading = true;
        this.vm.personalizedBlocks([]);
        const groupId = this.vm?.metadata?.groupId;
        const templateId = this.vm?.currentMailing()?.templateId; // Retrieve templateId from currentMailing
        axios
          .get(getPersonalizedBlocks(), {
            params: { groupId, searchTerm: this.searchTerm, templateId },
          })
          .then((response) => {
            this.vm.personalizedBlocks(
              response.data?.items.map(({ content, ...blockInformation }) => ({
                ...content,
                blockInformation,
                id: '', // This line is crucial. The `viewModel.loadDefaultBlocks` function will override this `id` when the block is added to the email content. Without this placeholder, there could be issues when adding personalized blocks in emails.
                customStyle: true, // We want all custom blocks to be considered as unlinked blocks
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
         @input="handleSearch" 
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
