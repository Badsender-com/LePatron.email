<script>
import { mapGetters } from 'vuex';
import { IS_ADMIN, USER } from '~/store/user';
import { ArrowLeft } from 'lucide-vue';

export default {
  name: 'BsGroupSettingsPageHeader',
  components: {
    LucideArrowLeft: ArrowLeft,
  },
  props: {
    title: {
      type: String,
      required: true,
    },
    groupName: {
      type: String,
      default: '',
    },
    showBackButton: {
      type: Boolean,
      default: false,
    },
    backRoute: {
      type: String,
      default: '',
    },
  },
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
    }),
    showGroupBadge() {
      return this.isAdmin && this.groupName;
    },
  },
  methods: {
    goBack() {
      if (this.backRoute) {
        this.$router.push(this.backRoute);
      } else {
        this.$router.back();
      }
    },
  },
};
</script>

<template>
  <div class="settings-page-header">
    <div class="settings-page-header__title">
      <v-btn
        v-if="showBackButton"
        icon
        small
        class="mr-2"
        @click="goBack"
      >
        <lucide-arrow-left :size="20" />
      </v-btn>
      <h1 class="text-h5 font-weight-medium">
        {{ title }}
      </h1>
      <v-chip
        v-if="showGroupBadge"
        small
        outlined
        color="accent"
        class="ml-3"
      >
        {{ groupName }}
      </v-chip>
    </div>
    <div class="settings-page-header__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.settings-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.settings-page-header__title {
  display: flex;
  align-items: center;
}

.settings-page-header__actions {
  display: flex;
  gap: 8px;
}
</style>
