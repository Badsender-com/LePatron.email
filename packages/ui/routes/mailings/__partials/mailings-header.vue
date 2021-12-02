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
  data() {
    return {
      conflictError: false,
    };
  },
};
</script>
<template>
  <div>
    <v-toolbar flat>
      <v-toolbar-title>
        <mailings-breadcrumbs :large="true" />
      </v-toolbar-title>
    </v-toolbar>
  </div>

  <!--  <div class="d-flex align-center mb-2">-->
  <!--    <div class="font-weight-bold">-->
  <!--      <mailings-breadcrumbs />-->
  <!--    </div>-->
  <!--    -->
  <!--  </div>-->
</template>
