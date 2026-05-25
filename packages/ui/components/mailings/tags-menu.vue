<script>
import BsModalConfirm from '~/components/modal-confirm';
import BsModalTagsForm from '~/components/mailings/modal-tags-form';
import { Tag, Square, CheckSquare, MinusSquare } from 'lucide-vue';

const CHECKBOX_UNCHECKED = 'unchecked';
const CHECKBOX_CHECKED = 'checked';
const CHECKBOX_INDETERMINATE = 'indeterminate';

export default {
  name: 'BsMailingsTagsMenu',
  components: {
    BsModalConfirm,
    BsModalTagsForm,
    LucideTag: Tag,
    LucideSquare: Square,
    LucideCheckSquare: CheckSquare,
    LucideMinusSquare: MinusSquare,
  },
  props: {
    mailingsSelection: { type: Array, default: () => [] },
    tags: { type: Array, default: () => [] },
  },
  data() {
    return {
      addedTags: [],
      removedTags: [],
      newTags: [],
    };
  },
  computed: {
    mailingsTags() {
      return this.mailingsSelection.reduce(
        (allTags, mailing) => [...allTags, ...mailing.tags],
        []
      );
    },
    countByTags() {
      const countByTags = {};
      this.tags.forEach((tagName) => {
        countByTags[tagName] = this.mailingsTags.filter(
          (mailingTag) => mailingTag === tagName
        ).length;
      });
      return countByTags;
    },
    tagsCheckboxList() {
      // Defensive merge: include tags actually applied on the selection AND
      // any user-created tags from the inline "New label" flow, even when
      // the company-wide list (`tags` prop) hasn't loaded yet.
      const allTags = Array.from(
        new Set([...(this.tags || []), ...this.mailingsTags, ...this.newTags])
      );
      const mailingSelectionCount = this.mailingsSelection.length;
      return allTags.map((tagName) => {
        if (this.addedTags.includes(tagName)) {
          return { name: tagName, checkIcon: CHECKBOX_CHECKED };
        }
        if (this.removedTags.includes(tagName)) {
          return { name: tagName, checkIcon: CHECKBOX_UNCHECKED };
        }
        const mailingsTagCount = this.countByTags[tagName] || 0;
        if (
          mailingsTagCount === mailingSelectionCount &&
          mailingsTagCount > 0
        ) {
          return { name: tagName, checkIcon: CHECKBOX_CHECKED };
        }
        if (mailingsTagCount > 0) {
          return { name: tagName, checkIcon: CHECKBOX_INDETERMINATE };
        }
        return { name: tagName, checkIcon: CHECKBOX_UNCHECKED };
      });
    },
  },
  methods: {
    openMenu() {
      this.addedTags = [];
      this.removedTags = [];
      this.newTags = [];
      this.$refs.tagsDialog.open();
    },
    closeMenu() {
      this.$refs.tagsDialog?.close();
    },
    openNewTagDialog() {
      this.$refs.createTags.open();
    },
    createNewTag(text) {
      const trimmed = (text || '').trim();
      if (!trimmed) return;
      if (
        ![...this.tags, ...this.newTags, ...this.mailingsTags].includes(trimmed)
      ) {
        this.newTags.push(trimmed);
      }
      this.addedTags.push(trimmed);
      this.$emit('create', trimmed);
    },
    toggleTag(tagCheckbox) {
      const { checkIcon: tagStatus, name: tagName } = tagCheckbox;
      if (tagStatus === CHECKBOX_INDETERMINATE) {
        this.addedTags.push(tagName);
        return;
      }
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
      if (!this.addedTags.length && !this.removedTags.length) {
        return this.closeMenu();
      }
      this.$emit('update', {
        added: [...this.addedTags],
        removed: [...this.removedTags],
      });
      this.closeMenu();
    },
  },
};
</script>

<template>
  <div class="bs-mailings-tags-menu">
    <v-tooltip bottom>
      <template #activator="{ on }">
        <button class="bsdt-bulkbar__btn" v-on="on" @click="openMenu">
          <lucide-tag :size="13" />
          {{ $t('tags.tag') }}
        </button>
      </template>
      <span>{{ $t('tags.handle') }}</span>
    </v-tooltip>

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
          <span class="labels-list__check">
            <lucide-check-square
              v-if="tagCheckbox.checkIcon === 'checked'"
              :size="20"
            />
            <lucide-minus-square
              v-else-if="tagCheckbox.checkIcon === 'indeterminate'"
              :size="20"
            />
            <lucide-square v-else :size="20" />
          </span>
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
          {{ $t('global.apply') }}
        </v-btn>
      </v-card-actions>
    </bs-modal-confirm>

    <bs-modal-tags-form
      ref="createTags"
      width="500"
      :input-label="$t('global.name')"
      @confirm="createNewTag"
    />
  </div>
</template>

<style lang="scss" scoped>
/* BsDataTable bulk bar button styles (inherited from parent) */
.bsdt-bulkbar__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.12); // --gray-300
  border-radius: 4px; // --r-sm
  font-size: 12px;
  color: rgba(0, 0, 0, 0.7); // --gray-800
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease-out, border 0.15s ease-out;

  &:hover {
    background: rgba(0, 0, 0, 0.04); // --gray-100
    border-color: rgba(0, 0, 0, 0.2); // --gray-400
  }
}

/* Same border + scroll container pattern as the move/copy/translate modals'
   destination tree, applied to the labels checkbox list. Mirrors
   routes/mailings/__partials/mailings-tags-menu.vue. */
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
  display: inline-flex;
  align-items: center;
  color: rgba(0, 0, 0, 0.54);
}

.labels-list__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
