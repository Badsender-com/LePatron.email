<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import {
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
} from '~/helpers/constants/table-config.js';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsUserActions from '~/components/user/actions.vue';
import BsMailingsAdminTable from '~/components/mailings/admin-table.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import { validationMixin } from 'vuelidate';
import { required, email } from 'vuelidate/lib/validators';
import {
  UserCheck,
  UserX,
  Send,
  RotateCcw,
} from 'lucide-vue';

export default {
  name: 'BsPageSettingsUserEdit',
  components: {
    BsGroupSettingsNav,
    BsGroupSettingsPageHeader,
    BsUserActions,
    BsMailingsAdminTable,
    BsTextField,
    BsSelect,
    LucideUserCheck: UserCheck,
    LucideUserX: UserX,
    LucideSend: Send,
    LucideRotateCcw: RotateCcw,
  },
  mixins: [mixinSettingsTitle, validationMixin],
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
  supportedLanguages: [
    { text: 'English', value: 'en' },
    { text: 'Français', value: 'fr' },
  ],
  roles: [
    { text: 'Group admin', value: 'company_admin' },
    { text: 'Regular user', value: 'regular_user' },
  ],
  meta: {
    acl: [acls.ACL_ADMIN, acls.ACL_GROUP_ADMIN],
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const [groupResponse, userResponse] = await Promise.all([
        $axios.$get(apiRoutes.groupsItem(params)),
        $axios.$get(apiRoutes.usersItem(params)),
      ]);
      return { group: groupResponse, user: userResponse };
    } catch (error) {
      console.error(error);
      return { group: {}, user: {} };
    }
  },
  data() {
    return {
      group: {},
      user: {},
      mailings: [],
      loading: false,
      isLoadingMailings: false,
      pagination: {
        page: 1,
        itemsPerPage: 25,
        itemsLength: 0,
        pageCount: 0,
        pageStart: 0,
        pageStop: 0,
      },
    };
  },
  head() {
    return { title: this.pageTitle };
  },
  validations() {
    return {
      user: {
        email: { required, email },
        name: { required },
        role: { required },
      },
    };
  },
  computed: {
    pageTitle() {
      return `${this.$tc('global.user', 1)} – ${this.user.name || ''}`;
    },
    emailErrors() {
      const errors = [];
      if (!this.$v.user.email.$dirty) return errors;
      if (!this.$v.user.email.required) {
        errors.push(this.$t('forms.user.errors.email.required'));
      }
      if (!this.$v.user.email.email) {
        errors.push(this.$t('forms.user.errors.email.valid'));
      }
      return errors;
    },
    nameErrors() {
      const errors = [];
      if (!this.$v.user.name.$dirty) return errors;
      if (!this.$v.user.name.required) {
        errors.push(this.$t('global.errors.nameRequired'));
      }
      return errors;
    },
    isDeactivated() {
      return this.user.status === 'deactivated';
    },
    canResetPassword() {
      return this.user.status === 'confirmed';
    },
    canSendPassword() {
      return this.user.status === 'to-be-initialized';
    },
    canResendPassword() {
      return this.user.status === 'password-mail-sent';
    },
    isSamlUser() {
      return this.user.status === 'saml-authentication';
    },
    statusColor() {
      const colors = {
        confirmed: 'success',
        'saml-authentication': 'success',
        'password-mail-sent': 'info',
        'to-be-initialized': 'warning',
        deactivated: 'grey',
      };
      return colors[this.user.status] || 'grey';
    },
    statusLabel() {
      const labels = {
        confirmed: this.$t('users.status.confirmed'),
        'saml-authentication': this.$t('users.status.saml'),
        'password-mail-sent': this.$t('users.status.passwordSent'),
        'to-be-initialized': this.$t('users.status.toInitialize'),
        deactivated: this.$t('users.status.deactivated'),
      };
      return labels[this.user.status] || this.user.status;
    },
    isActiveStatus() {
      return (
        this.user.status === 'confirmed' ||
        this.user.status === 'saml-authentication'
      );
    },
  },
  watch: {
    'pagination.page': 'loadMailings',
    'pagination.itemsPerPage': 'loadMailings',
  },
  mounted() {
    this.loadMailings();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async loadMailings() {
      this.isLoadingMailings = true;
      try {
        const { $axios, $route } = this;
        const response = await $axios.$get(
          apiRoutes.usersItemMailings($route.params),
          {
            params: {
              page: this.pagination.page,
              limit: this.pagination.itemsPerPage,
            },
          }
        );
        this.mailings = response.items;
        this.pagination.itemsLength = response.totalItems;
        this.pagination.pageCount = response.totalPages;
        this.pagination.pageStart =
          (this.pagination.page - 1) * this.pagination.itemsPerPage;
        this.pagination.pageStop =
          this.pagination.pageStart + this.mailings.length;
      } catch (error) {
        console.error('Error fetching mailings for user:', error);
      } finally {
        this.isLoadingMailings = false;
      }
    },
    handleItemsPerPageChange(itemsPerPage) {
      this.pagination.page = 1;
      this.pagination.itemsPerPage = itemsPerPage;
    },
    async updateUser() {
      this.$v.$touch();
      if (this.$v.$invalid) return;

      this.loading = true;
      try {
        const { $axios, $route } = this;
        await $axios.$put(apiRoutes.usersItem($route.params), this.user);
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.error(error);
      } finally {
        this.loading = false;
      }
    },
    activateUser() {
      this.$refs.userActions.activate(this.user);
    },
    deactivateUser() {
      this.$refs.userActions.deactivate(this.user);
    },
    resetPassword() {
      this.$refs.userActions.resetPassword(this.user);
    },
    sendPassword() {
      this.$refs.userActions.sendPassword(this.user);
    },
    resendPassword() {
      this.$refs.userActions.resendPassword(this.user);
    },
    updateUserFromActions(updatedUser) {
      this.user = updatedUser;
    },
  },
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <bs-group-settings-nav :group="group" />
    </template>
    <div class="settings-content">
      <bs-group-settings-page-header
        :title="user.name"
        :group-name="group.name"
        :show-back-button="true"
        :back-route="`/groups/${group.id}/settings/users`"
      >
        <template #actions>
          <!-- Status chip -->
          <v-chip
            small
            :color="statusColor"
            :outlined="!isActiveStatus"
            :dark="isActiveStatus"
            class="mr-2"
          >
            {{ statusLabel }}
          </v-chip>

          <!-- Action buttons -->
          <v-tooltip v-if="isDeactivated" bottom>
            <template #activator="{ on, attrs }">
              <v-btn
                icon
                v-bind="attrs"
                :disabled="loading"
                v-on="on"
                @click="activateUser"
              >
                <lucide-user-check :size="20" />
              </v-btn>
            </template>
            <span>{{ $t('global.enable') }}</span>
          </v-tooltip>

          <template v-if="!isDeactivated && !isSamlUser">
            <v-tooltip v-if="canSendPassword" bottom>
              <template #activator="{ on, attrs }">
                <v-btn
                  icon
                  v-bind="attrs"
                  :disabled="loading"
                  v-on="on"
                  @click="sendPassword"
                >
                  <lucide-send :size="20" />
                </v-btn>
              </template>
              <span>{{ $t('users.passwordTooltip.send') }}</span>
            </v-tooltip>

            <v-tooltip v-if="canResendPassword" bottom>
              <template #activator="{ on, attrs }">
                <v-btn
                  icon
                  v-bind="attrs"
                  :disabled="loading"
                  v-on="on"
                  @click="resendPassword"
                >
                  <lucide-send :size="20" />
                </v-btn>
              </template>
              <span>{{ $t('users.passwordTooltip.resend') }}</span>
            </v-tooltip>

            <v-tooltip v-if="canResetPassword" bottom>
              <template #activator="{ on, attrs }">
                <v-btn
                  icon
                  v-bind="attrs"
                  :disabled="loading"
                  v-on="on"
                  @click="resetPassword"
                >
                  <lucide-rotate-ccw :size="20" />
                </v-btn>
              </template>
              <span>{{ $t('users.passwordTooltip.reset') }}</span>
            </v-tooltip>

            <v-tooltip bottom>
              <template #activator="{ on, attrs }">
                <v-btn
                  icon
                  v-bind="attrs"
                  :disabled="loading"
                  v-on="on"
                  @click="deactivateUser"
                >
                  <lucide-user-x :size="20" />
                </v-btn>
              </template>
              <span>{{ $t('global.disable') }}</span>
            </v-tooltip>
          </template>
        </template>
      </bs-group-settings-page-header>

      <!-- User form -->
      <v-card flat tile :loading="loading" :disabled="loading">
        <v-card-text>
          <div class="form-section">
            <h3 class="form-section__title">
              {{ $t('users.details') }}
            </h3>
            <v-row>
              <v-col cols="12" md="6">
                <bs-text-field
                  v-model="user.email"
                  :label="$t('users.email')"
                  type="email"
                  required
                  :error-messages="emailErrors"
                  @blur="$v.user.email.$touch()"
                />
              </v-col>
              <v-col cols="12" md="6">
                <bs-text-field
                  v-model="user.name"
                  :label="$t('forms.user.name')"
                  required
                  :error-messages="nameErrors"
                  @blur="$v.user.name.$touch()"
                />
              </v-col>
              <v-col cols="12" md="6">
                <bs-text-field
                  v-model="user.externalUsername"
                  :label="$t('forms.user.externalUsername') + $t('forms.user.optional')"
                />
              </v-col>
              <v-col cols="12" md="6">
                <bs-select
                  v-model="user.lang"
                  :label="$t('users.lang')"
                  :items="$options.supportedLanguages"
                />
              </v-col>
              <v-col cols="12" md="6">
                <bs-select
                  v-model="user.role"
                  :label="$t('users.role')"
                  :items="$options.roles"
                />
              </v-col>
            </v-row>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="accent"
            elevation="0"
            :loading="loading"
            @click="updateUser"
          >
            {{ $t('global.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>

      <!-- User mailings -->
      <v-card flat tile class="mt-4">
        <v-card-title>{{ $tc('global.mailing', 2) }}</v-card-title>
        <v-card-text>
          <bs-mailings-admin-table
            :mailings="mailings"
            :loading="isLoadingMailings"
            :hidden-cols="['userName', 'actions']"
          />
          <v-card
            v-if="pagination && pagination.itemsLength > pagination.itemsPerPage"
            flat
            class="d-flex align-center justify-center mx-auto"
            max-width="22rem"
          >
            <v-pagination
              v-model="pagination.page"
              :circle="true"
              class="my-4"
              :length="pagination.pageCount"
            />
          </v-card>
        </v-card-text>
      </v-card>
    </div>

    <bs-user-actions
      ref="userActions"
      v-model="loading"
      :user="user"
      @update="updateUserFromActions"
    />
  </bs-layout-left-menu>
</template>

<style lang="scss" scoped>
.settings-content {
  padding: 0;
}

.form-section {
  &__title {
    font-size: 1.1rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87);
    margin-bottom: 1rem;
  }
}
</style>
