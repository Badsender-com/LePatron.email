<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsPageHeader from '~/components/layout/bs-page-header.vue';
import BsFormSection from '~/components/layout/bs-form-section.vue';
import BsUserActions from '~/components/user/actions.vue';
import BsMailingsAdminTable from '~/components/mailings/admin-table.vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import { validationMixin } from 'vuelidate';
import { required, email } from 'vuelidate/lib/validators';
import { User, Shield, Users, Mail } from 'lucide-vue';

export default {
  name: 'BsPageSettingsUserEdit',
  components: {
    BsPageHeader,
    BsFormSection,
    BsUserActions,
    BsMailingsAdminTable,
    BsDataTable,
    BsTextField,
    BsSelect,
    LucideUser: User,
    LucideShield: Shield,
    LucideUsers: Users,
    LucideMail: Mail,
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
      const [
        groupResponse,
        userResponse,
        workspacesResponse,
      ] = await Promise.all([
        $axios.$get(apiRoutes.groupsItem(params)),
        $axios.$get(apiRoutes.usersItem(params)),
        $axios.$get(apiRoutes.groupsWorkspaces(params)),
      ]);
      return {
        group: groupResponse,
        user: userResponse,
        workspaces: workspacesResponse.items,
      };
    } catch (error) {
      console.error(error);
      return { group: {}, user: {}, workspaces: [] };
    }
  },
  data() {
    return {
      group: {},
      user: {},
      workspaces: [],
      savingWorkspaces: new Set(),
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
    workspaceHeaders() {
      return [
        { text: this.$t('global.name'), value: 'name', align: 'left' },
        {
          text: this.$t('tableHeaders.workspaces.assigned'),
          value: 'assigned',
          align: 'center',
          sortable: false,
          width: '120px',
        },
      ];
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
    showGroupBadge() {
      return this.group.name;
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
    isUserInWorkspace(workspace) {
      return (workspace._users || []).some(
        (id) => String(id) === String(this.user.id)
      );
    },
    async toggleWorkspace(workspace) {
      const userId = String(this.user.id);
      const currentUsers = (workspace._users || []).map(String);
      const isAssigned = currentUsers.includes(userId);
      const newUsers = isAssigned
        ? currentUsers.filter((id) => id !== userId)
        : [...currentUsers, userId];

      this.savingWorkspaces = new Set([...this.savingWorkspaces, workspace.id]);
      try {
        await this.$axios.$put(apiRoutes.getWorkspace(workspace.id), {
          selectedUsers: newUsers.map((id) => ({ id })),
        });
        const idx = this.workspaces.findIndex((w) => w.id === workspace.id);
        if (idx !== -1) {
          this.$set(this.workspaces[idx], '_users', newUsers);
        }
      } catch {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        const next = new Set(this.savingWorkspaces);
        next.delete(workspace.id);
        this.savingWorkspaces = next;
      }
    },
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
  },
};
</script>

<template>
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $t('global.editUser') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <div class="settings-content">
        <!-- User form -->
        <v-card flat tile :loading="loading" :disabled="loading">
          <v-card-text>
            <!-- Section: Informations -->
            <bs-form-section>
              <template #icon>
                <lucide-user :size="20" />
              </template>
              <template #title>
                {{ $t('users.details') }}
              </template>
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
                    :label="
                      $t('forms.user.externalUsername') +
                        $t('forms.user.optional')
                    "
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
            </bs-form-section>

            <!-- Section: Statut & Sécurité -->
            <bs-form-section last>
              <template #icon>
                <lucide-shield :size="20" />
              </template>
              <template #title>
                {{ $t('users.sections.statusSecurity') }}
              </template>
              <template #description>
                {{ $t('users.sections.statusSecurityDescription') }}
              </template>

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
                <p
                  v-if="statusDescription"
                  class="text-caption text--secondary mt-2 mb-0"
                >
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
            </bs-form-section>
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

        <!-- Workspace assignments -->
        <v-card flat tile class="mt-4">
          <v-card-text>
            <bs-form-section last flush>
              <template #icon>
                <lucide-users :size="20" />
              </template>
              <template #title>
                {{ $tc('global.teams', 2) }}
              </template>
              <bs-data-table :headers="workspaceHeaders" :items="workspaces">
                <template #item.name="{ item }">
                  <span class="font-weight-medium">{{ item.name }}</span>
                </template>
                <template #item.assigned="{ item }">
                  <v-switch
                    :input-value="isUserInWorkspace(item)"
                    :loading="savingWorkspaces.has(item.id)"
                    :disabled="savingWorkspaces.has(item.id)"
                    dense
                    hide-details
                    class="mt-0 d-inline-flex"
                    @change="toggleWorkspace(item)"
                  />
                </template>
              </bs-data-table>
            </bs-form-section>
          </v-card-text>
        </v-card>

        <!-- User mailings -->
        <v-card flat tile class="mt-4">
          <v-card-text>
            <bs-form-section last flush>
              <template #icon>
                <lucide-mail :size="20" />
              </template>
              <template #title>
                {{ $tc('global.mailing', 2) }}
              </template>
              <bs-mailings-admin-table
                :mailings="mailings"
                :loading="isLoadingMailings"
                :hidden-cols="['userName', 'actions']"
              />
              <div
                v-if="
                  pagination && pagination.itemsLength > pagination.itemsPerPage
                "
                class="d-flex align-center justify-center"
              >
                <v-pagination
                  v-model="pagination.page"
                  :circle="true"
                  class="my-4"
                  :length="pagination.pageCount"
                />
              </div>
            </bs-form-section>
          </v-card-text>
        </v-card>
      </div>

      <bs-user-actions
        ref="userActions"
        v-model="loading"
        :user="user"
        @update="updateUserFromActions"
      />
    </v-container>
  </div>
</template>

<style lang="scss" scoped>
.settings-content {
  padding: 0;
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
  margin-bottom: 1.5rem;
}
</style>
