<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';

const CHECKBOX_UNCHECKED = 'check_box_outline_blank';
const CHECKBOX_CHECKED = 'check_box';
const CHECKBOX_INDETERMINATE = 'indeterminate_check_box';

export default {
  name: 'BsMailingsTagsMenu',
  mixins: [validationMixin],
  props: {
    mailingsSelection: { type: Array, default: () => [] },
    tags: { type: Array, default: () => [] },
  },
  data() {
    return {
      showMenu: false,
      newTagDialog: false,
      newTagName: '',
      addedTags: [],
      removedTags: [],
    };
  },
  validations() {
    return {
      newTagName: { required },
    };
  },
  computed: {
    vShowTagMenu: {
      get() {
        return this.showMenu;
      },
      set(newMenuValue) {
        if (newMenuValue === false) {
          this.addedTags = [];
          this.removedTags = [];
        }
        this.showMenu = newMenuValue;
      },
    },
    tagNameErrors() {
      const errors = [];
      if (!this.$v.newTagName.$dirty) return errors;
      !this.$v.newTagName.required &&
        errors.push(this.$t('global.errors.nameRequired'));
      return errors;
    },
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
      const mailingSelectionCount = this.mailingsSelection.length;
      return this.tags.map((tagName) => {
        if (this.addedTags.includes(tagName)) {
          return { name: tagName, checkIcon: CHECKBOX_CHECKED };
        }
        if (this.removedTags.includes(tagName)) {
          return { name: tagName, checkIcon: CHECKBOX_UNCHECKED };
        }
        const mailingsTagCount = this.countByTags[tagName];
        if (mailingsTagCount === mailingSelectionCount) {
          return { name: tagName, checkIcon: CHECKBOX_CHECKED };
        }
        if (mailingsTagCount) {
          return { name: tagName, checkIcon: CHECKBOX_INDETERMINATE };
        }
        return { name: tagName, checkIcon: CHECKBOX_UNCHECKED };
      });
    },
  },
  methods: {
    closeMenu() {
      this.vShowTagMenu = false;
    },
    openNewTagDialog() {
      this.newTagDialog = true;
    },
    closeNewTagDialog() {
      this.newTagName = '';
      this.$v.$reset();
      this.newTagDialog = false;
    },
    onCreateNewTag() {
      this.$v.$touch();
      if (this.$v.$invalid) return;
      const { newTagName } = this;
      this.$emit('create', newTagName);
      this.addedTags.push(newTagName);
      this.closeNewTagDialog();
    },
    toggleTag(tagCheckbox) {
      const { checkIcon: tagStatus, name: tagName } = tagCheckbox;
      if (tagStatus === CHECKBOX_INDETERMINATE) {
        return this.addedTags.push(tagName);
      }
      if (tagStatus === CHECKBOX_UNCHECKED) {
        this.removedTags = this.removedTags.filter((tag) => tag !== tagName);
        return this.addedTags.push(tagName);
      }
      if (tagStatus === CHECKBOX_CHECKED) {
        this.addedTags = this.addedTags.filter((tag) => tag !== tagName);
        return this.removedTags.push(tagName);
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
      // closing will reinitialize tags selection
      this.closeMenu();
    },
  },
};
</script>

<template>
  <!-- pile up menu & tooltip -->
  <!-- https://stackoverflow.com/a/58077496 -->
  <v-menu
    v-model="vShowTagMenu"
    :close-on-content-click="false"
    :nudge-width="300"
  >
    <template #activator="{ on: onMenu }">
      <v-tooltip bottom :disabled="vShowTagMenu">
        <template #activator="{ on: onTooltip }">
          <v-btn icon color="info" v-on="{ ...onMenu, ...onTooltip }">
            <v-icon>label</v-icon>
          </v-btn>
        </template>
        <span>{{ $t('tags.handle') }}</span>
      </v-tooltip>
    </template>
    <v-card>
      <v-list>
        <v-list-item>
          <v-list-item-content>
            <v-list-item-title class="title">
              {{ $t('tags.list') }}
            </v-list-item-title>
          </v-list-item-content>
          <v-list-item-action>
            <v-btn icon @click="closeMenu">
              <v-icon>close</v-icon>
            </v-btn>
          </v-list-item-action>
        </v-list-item>
      </v-list>
      <v-divider />
      <v-list>
        <v-list-item
          v-for="tagCheckbox in tagsCheckboxList"
          :key="tagCheckbox.name"
          @click="toggleTag(tagCheckbox)"
        >
          <v-list-item-action>
            <v-icon>{{ tagCheckbox.checkIcon }}</v-icon>
          </v-list-item-action>
          <v-list-item-title>{{ tagCheckbox.name }}</v-list-item-title>
        </v-list-item>
      </v-list>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="openNewTagDialog">
          {{ $t('tags.new') }}
        </v-btn>
        <v-btn color="primary" @click="updateMailingsTags">
          {{ $t('global.apply') }}
        </v-btn>
      </v-card-actions>
    </v-card>
    <v-dialog v-model="newTagDialog" width="500">
      <v-card>
        <v-card-title class="headline">
          {{ $t('tags.new') }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newTagName"
            :label="$t('global.name')"
            :error-messages="tagNameErrors"
            @input="$v.newTagName.$touch()"
            @blur="$v.newTagName.$touch()"
          />
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="closeNewTagDialog">
            {{ $t('global.cancel') }}
          </v-btn>
          <v-btn color="primary" @click="onCreateNewTag">
            {{ $t('global.createTag') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-menu>
</template>

<style lang="scss" scoped></style>
