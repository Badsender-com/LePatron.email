<script>
import MailingsBreadcrumbs from '~/routes/mailings/__partials/mailings-breadcrumbs';
import mixinCurrentLocation from '~/helpers/mixins/mixin-current-location';

export default {
  name: 'MailingsHeader',
  components: {
    MailingsBreadcrumbs,
  },
  mixins: [mixinCurrentLocation],
  props: {
    loadingParent: { type: Boolean, default: false },
  },
};
</script>

<template>
  <div class="mailings-header">
    <div class="mailings-header__title">
      <mailings-breadcrumbs :large="true" />
    </div>
    <div class="mailings-header__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.mailings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  margin-bottom: 1rem;

  &__title {
    flex: 1;
    min-width: 0;
  }

  &__actions {
    flex-shrink: 0;
    margin-left: 1rem;
  }

  ::v-deep {
    .v-breadcrumbs {
      padding: 0;

      li {
        font-size: 1.125rem;

        &:last-child {
          .v-breadcrumbs__item {
            font-weight: 600;
            color: rgba(0, 0, 0, 0.87);
          }
        }
      }

      .v-breadcrumbs__divider {
        padding: 0 8px;
        color: rgba(0, 0, 0, 0.3);
      }
    }
  }
}
</style>
