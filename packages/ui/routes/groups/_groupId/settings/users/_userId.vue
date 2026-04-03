<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';
import BsUserActions from '~/components/user/actions.vue';
import BsMailingsAdminTable from '~/components/mailings/admin-table.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import { validationMixin } from 'vuelidate';
import { required, email } from 'vuelidate/lib/validators';

export default {
  name: 'BsPageSettingsUserEdit',
  components: {
    BsGroupSettingsNav,
    BsGroupSettingsPageHeader,
    BsUserActions,
    BsMailingsAdminTable,
    BsTextField,
    BsSelect,
  },
  mixins: [mixinSettingsTitle, validationMixin],
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
    statusDescription() {
      const descriptions = {
        confirmed: this.$t('users.statusDescription.confirmed'),
        'saml-authentication': this.$t('users.statusDescription.saml'),
        'password-mail-sent': this.$t('users.statusDescription.passwordSent'),
        'to-be-initialized': this.$t('users.statusDescription.toInitialize'),
        deactivated: this.$t('users.statusDescription.deactivated'),
      };
      return descriptions[this.user.status] || '';
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
    onCancel() {
      this.$router.push(`/groups/${this.group.id}/settings/users`);
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
        :title="$t('global.editUser')"
        :group-name="group.name"
      />

      <!-- User form -->
      <v-card flat tile :loading="loading" :disabled="loading">
        <v-card-text>
          <!-- Section: Informations -->
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

          <!-- Section: Statut & Sécurité -->
          <div class="form-section">
            <h3 class="form-section__title">
              {{ $t('users.sections.statusSecurity') }}
            </h3>
            <p class="form-section__description">
              {{ $t('users.sections.statusSecurityDescription') }}
            </p>

            <!-- Status display -->
            <div class="status-display mb-4">
              <div class="d-flex align-center">
                <span class="text-body-2 mr-3">{{ $t('global.status') }} :</span>
                <v-chip
                  small
                  :color="statusColor"
                  :outlined="!isActiveStatus"
                  :dark="isActiveStatus"
                >
                  {{ statusLabel }}
                </v-chip>
              </div>
              <p v-if="statusDescription" class="text-caption text--secondary mt-2 mb-0">
                {{ statusDescription }}
              </p>
            </div>

            <!-- Action buttons -->
            <div class="status-actions">
              <!-- Activate (when deactivated) -->
              <v-btn
                v-if="isDeactivated"
                outlined
                color="success"
                :disabled="loading"
                @click="activateUser"
              >
                {{ $t('users.actions.activate') }}
              </v-btn>

              <!-- Actions for active users (non-SAML) -->
              <template v-if="!isDeactivated && !isSamlUser">
                <!-- Send password (to-be-initialized) -->
                <v-btn
                  v-if="canSendPassword"
                  outlined
                  color="accent"
                  :disabled="loading"
                  @click="sendPassword"
                >
                  {{ $t('users.actions.sendPassword') }}
                </v-btn>

                <!-- Resend password (password-mail-sent) -->
                <v-btn
                  v-if="canResendPassword"
                  outlined
                  color="accent"
                  :disabled="loading"
                  @click="resendPassword"
                >
                  {{ $t('users.actions.resendPassword') }}
                </v-btn>

                <!-- Reset password (confirmed) -->
                <v-btn
                  v-if="canResetPassword"
                  outlined
                  color="accent"
                  :disabled="loading"
                  @click="resetPassword"
                >
                  {{ $t('users.actions.resetPassword') }}
                </v-btn>

                <!-- Deactivate -->
                <v-btn
                  text
                  color="error"
                  :disabled="loading"
                  @click="deactivateUser"
                >
                  {{ $t('users.actions.deactivate') }}
                </v-btn>
              </template>
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn text color="primary" :disabled="loading" @click="onCancel">
            {{ $t('global.cancel') }}
          </v-btn>
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
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  &__title {
    font-size: 1.1rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87);
    margin-bottom: 0.25rem;
  }

  &__description {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 1rem;
  }
}

.status-display {
  padding: 1rem;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.status-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
</style>
