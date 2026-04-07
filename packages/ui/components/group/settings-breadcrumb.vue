<script>
export default {
  name: 'BsSettingsBreadcrumb',
  props: {
    groupName: {
      type: String,
      default: '',
    },
  },
};
</script>

<template>
  <div class="settings-breadcrumb">
    <span class="settings-breadcrumb__prefix">{{
      $t('modules.settings')
    }}</span>
    <span class="settings-breadcrumb__separator">></span>
    <span class="settings-breadcrumb__current">{{ groupName }}</span>
  </div>
</template>

<style scoped>
.settings-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
}

.settings-breadcrumb__prefix {
  color: rgba(255, 255, 255, 0.7);
}

.settings-breadcrumb__separator {
  color: rgba(255, 255, 255, 0.5);
}

.settings-breadcrumb__current {
  color: white;
  font-weight: 500;
}
</style>
