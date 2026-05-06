<script>
import BsModalConfirm from '~/components/modal-confirm';
import BsModalTagsForm from '~/components/mailings/modal-tags-form';
import { Tag } from 'lucide-vue';
const CHECKBOX_UNCHECKED = 'check_box_outline_blank';
const CHECKBOX_CHECKED = 'check_box';
export default {
  name: 'BsMailingsTagsMenu',
  components: {
    BsModalConfirm,
    BsModalTagsForm,
    LucideTag: Tag,
  },

  props: {
    tags: { type: Array, default: () => [] },
    selectedMailTags: { type: Array, default: () => [] },
  },
  data() {
    return {
      showTagMenu: false,
      addedTags: [],
      newTags: [],
      removedTags: [],
    };
  },
  computed: {
    tagsCheckboxList() {
      // Defensive merge: the email's own tags must always appear in the list,
      // even if the company-wide tag list (`tags` prop) hasn't loaded yet
      // (e.g. dropped meta on a refresh). Otherwise a mailing's existing
      // labels would be invisible despite being applied.
      const allTags = Array.from(
        new Set([
          ...(this.tags || []),
          ...(this.selectedMailTags || []),
          ...this.newTags,
        ])
      );
      return allTags.map((tagName) => {
        if (this.addedTags.includes(tagName)) {
          return { name: tagName, checkIcon: CHECKBOX_CHECKED };
        }
        return { name: tagName, checkIcon: CHECKBOX_UNCHECKED };
      });
    },
  },
  watch: {
    showTagMenu: {
      handler: function (val) {
        if (val) {
          this.addedTags = [...this.selectedMailTags];
          this.removedTags = [];
          return;
        }
        this.addedTags = [];
        this.removedTags = [];
      },
      deep: true,
    },
  },

  methods: {
    closeMenu() {
      this.showTagMenu = false;
      this.$refs.tagsDialog?.close();
    },
    openMenu() {
      this.showTagMenu = true;
      this.$refs.tagsDialog?.open();
    },
    closeNewTagDialog() {
      this.$refs.createTags.close();
    },
    openNewTagDialog() {
      this.$refs.createTags.open();
    },
    createNewTag(text) {
      if (!text) return;
      if (![...this.tags, ...this.newTags].includes(text)) {
        this.newTags.push(text);
      }
    },
    toggleTag(tagCheckbox) {
      const { checkIcon: tagStatus, name: tagName } = tagCheckbox;
      if (tagStatus === CHECKBOX_UNCHECKED) {
        this.removedTags = this.removedTags.filter((tag) => tag !== tagName);
        this.addedTags.push(tagName);
        return;
      }
      if (tagStatus === CHECKBOX_CHECKED) {
        this.addedTags = this.addedTags.filter((tag) => tag !== tagName);
        this.removedTags.push(tagName);
      }
    },
    updateMailingsTags() {
      this.closeMenu();
      this.$emit('update-tags', {
        added: [...this.addedTags],
        removed: [...this.removedTags],
      });
    },
  },
};
</script>

<template>
  <div>
    <bs-modal-confirm
      ref="tagsDialog"
      :title="$t('tags.list')"
      :is-form="true"
      modal-width="500"
      @click-outside="closeMenu"
    >
      <template #titlePrefix>
        <lucide-tag :size="20" />
      </template>

      <div class="labels-list">
        <button
          v-for="tagCheckbox in tagsCheckboxList"
          :key="tagCheckbox.name"
          type="button"
          class="labels-list__item"
          @click="toggleTag(tagCheckbox)"
        >
          <v-icon class="labels-list__check">
            {{ tagCheckbox.checkIcon }}
          </v-icon>
          <span class="labels-list__label">{{ tagCheckbox.name }}</span>
        </button>
      </div>

      <v-divider />
      <v-card-actions>
        <v-btn color="primary" text @click="openNewTagDialog">
          {{ $t('tags.new') }}
        </v-btn>
        <v-spacer />
        <v-btn text @click="closeMenu">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn color="accent" elevation="0" @click="updateMailingsTags">
          {{ $t(`global.apply`) }}
        </v-btn>
      </v-card-actions>
    </bs-modal-confirm>
    <bs-modal-tags-form
      ref="createTags"
      width="500"
      :close-on-content-click="false"
      :input-label="$t('global.name')"
      @confirm="createNewTag"
    />
  </div>
</template>

<style lang="scss" scoped>
/* Same border + scroll container pattern as the move/copy/translate modals'
   destination tree, applied to the labels checkbox list. */
.labels-list {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.labels-list__item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.87);
  transition: background-color 0.15s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
}

.labels-list__check {
  flex-shrink: 0;
  font-size: 20px !important;
  color: rgba(0, 0, 0, 0.54) !important;
}

.labels-list__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
