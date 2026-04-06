<script>
import {
  TextCursor,
  Forward,
  Trash2,
  Copy,
  Tag,
  FolderInput,
  Eye,
  Download,
  CloudDownload,
  Languages,
} from 'lucide-vue';

const ICON_MAP = {
  'text-cursor': TextCursor,
  forward: Forward,
  'trash-2': Trash2,
  copy: Copy,
  tag: Tag,
  'folder-input': FolderInput,
  eye: Eye,
  download: Download,
  'cloud-download': CloudDownload,
  languages: Languages,
};

export default {
  name: 'BsMailingsActionsDropdownItem',
  props: {
    icon: {
      type: String,
      default: '',
    },
    onClick: {
      type: Function,
      default: () => () => {},
    },
  },
  computed: {
    iconComponent() {
      return ICON_MAP[this.icon] || null;
    },
  },
};
</script>

<template>
  <v-list-item class="dropdown-item" @click="onClick()">
    <v-list-item-icon class="dropdown-item__icon">
      <component :is="iconComponent" v-if="iconComponent" :size="18" />
    </v-list-item-icon>
    <v-list-item-title class="dropdown-item__title">
      <slot />
    </v-list-item-title>
  </v-list-item>
</template>

<style lang="scss" scoped>
.dropdown-item {
  min-height: 40px;
  padding: 0 16px;
  cursor: pointer;

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }

  &__icon {
    margin-right: 12px;
    min-width: 24px;
    justify-content: center;
    color: rgba(0, 0, 0, 0.54);
  }

  &__title {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.87);
  }
}
</style>
