<script>
import { validationMixin } from 'vuelidate';
import { required, url, integer, minValue } from 'vuelidate/lib/validators';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export default {
  name: 'BsCrmIntelligenceTab',
  mixins: [validationMixin],
  props: {
    group: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      loading: false,
      testingConnection: false,
      showSecretKey: false,
      localConfig: {
        enabled: false,
        siteUrl: '',
        secretKey: '',
        dashboards: [],
      },
    };
  },
  validations: {
    localConfig: {
      siteUrl: {
        required,
        url,
      },
      secretKey: {
        required,
      },
    },
    newDashboard: {
      metabaseId: {
        required,
        integer,
        minValue: minValue(1),
      },
      name: {
        required,
      },
    },
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    hasDashboards() {
      return this.localConfig.dashboards && this.localConfig.dashboards.length > 0;
    },
    isConfigValid() {
      return this.localConfig.siteUrl && this.localConfig.secretKey;
    },
  },
  watch: {
    group: {
      immediate: true,
      handler(newGroup) {
        if (newGroup) {
          this.localConfig = {
            enabled: newGroup.enableCrmIntelligence || false,
            siteUrl: newGroup.metabaseConfig?.siteUrl || '',
            secretKey: newGroup.metabaseConfig?.secretKey || '',
            dashboards: newGroup.metabaseConfig?.dashboards
              ? [...newGroup.metabaseConfig.dashboards]
              : [],
          };
        }
      },
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    addDashboard() {
      this.localConfig.dashboards.push({
        metabaseId: null,
        name: '',
        description: '',
        order: this.localConfig.dashboards.length,
      });
    },

    removeDashboard(index) {
      this.localConfig.dashboards.splice(index, 1);
      // Reorder remaining dashboards
      this.localConfig.dashboards.forEach((d, i) => {
        d.order = i;
      });
    },

    async testConnection() {
      if (!this.isConfigValid) {
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.testConnectionFailed'),
          color: 'error',
        });
        return;
      }

      this.testingConnection = true;
      try {
        // Send current form values to test before saving
        const result = await this.$axios.$post(
          `/groups/${this.groupId}/crm-intelligence/test`,
          {
            siteUrl: this.localConfig.siteUrl,
            secretKey: this.localConfig.secretKey,
          }
        );
        if (result.success) {
          this.showSnackbar({
            text: this.$t('crmIntelligence.admin.testConnectionSuccess'),
            color: 'success',
          });
        } else {
          this.showSnackbar({
            text: result.message || this.$t('crmIntelligence.admin.testConnectionFailed'),
            color: 'error',
          });
        }
      } catch (error) {
        console.error('[CrmIntelligenceTab] Test connection error:', error);
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.testConnectionFailed'),
          color: 'error',
        });
      } finally {
        this.testingConnection = false;
      }
    },

    async saveConfiguration() {
      // Validate dashboards
      const validDashboards = this.localConfig.dashboards.filter(
        (d) => d.metabaseId && d.name
      );

      this.loading = true;
      try {
        const payload = {
          enabled: this.localConfig.enabled,
          siteUrl: this.localConfig.siteUrl,
          secretKey: this.localConfig.secretKey,
          dashboards: validDashboards.map((d) => ({
            metabaseId: parseInt(d.metabaseId, 10),
            name: d.name,
            description: d.description || '',
            order: d.order || 0,
            lockedParams: d.lockedParams || {},
          })),
        };

        await this.$axios.$put(
          `/groups/${this.groupId}/crm-intelligence`,
          payload
        );

        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.saveSuccess'),
          color: 'success',
        });

        // Emit update to refresh parent
        this.$emit('update');
      } catch (error) {
        console.error('[CrmIntelligenceTab] Save error:', error);
        this.showSnackbar({
          text: this.$t('crmIntelligence.admin.saveError'),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <v-card flat>
    <v-card-title>
      <v-icon left color="primary">
        mdi-chart-areaspline
      </v-icon>
      {{ $t('crmIntelligence.admin.title') }}
    </v-card-title>
    <v-card-subtitle>
      {{ $t('crmIntelligence.admin.description') }}
    </v-card-subtitle>

    <v-card-text>
      <!-- Enable Toggle -->
      <v-switch
        v-model="localConfig.enabled"
        :label="$t('crmIntelligence.admin.enabled')"
        color="primary"
        class="mb-4"
      />

      <v-expand-transition>
        <div v-show="localConfig.enabled">
          <!-- Metabase Configuration -->
          <v-divider class="mb-4" />
          <h3 class="text-subtitle-1 mb-4">
            {{ $t('crmIntelligence.admin.metabaseConfig') }}
          </h3>

          <v-text-field
            v-model="localConfig.siteUrl"
            :label="$t('crmIntelligence.admin.siteUrl')"
            :hint="$t('crmIntelligence.admin.siteUrlHint')"
            :error-messages="
              $v.localConfig.siteUrl.$dirty && !$v.localConfig.siteUrl.url
                ? $t('crmIntelligence.admin.invalidUrl')
                : ''
            "
            outlined
            dense
            persistent-hint
            class="mb-3"
            @blur="$v.localConfig.siteUrl.$touch()"
          />

          <v-text-field
            v-model="localConfig.secretKey"
            :label="$t('crmIntelligence.admin.secretKey')"
            :hint="$t('crmIntelligence.admin.secretKeyHint')"
            :type="showSecretKey ? 'text' : 'password'"
            :append-icon="showSecretKey ? 'mdi-eye' : 'mdi-eye-off'"
            outlined
            dense
            persistent-hint
            class="mb-3"
            @click:append="showSecretKey = !showSecretKey"
          />

          <v-btn
            color="secondary"
            outlined
            :loading="testingConnection"
            :disabled="!isConfigValid"
            class="mb-6"
            @click="testConnection"
          >
            <v-icon left>
              mdi-connection
            </v-icon>
            {{ $t('crmIntelligence.admin.testConnection') }}
          </v-btn>

          <!-- Dashboards Configuration -->
          <v-divider class="mb-4" />
          <div class="d-flex align-center mb-4">
            <h3 class="text-subtitle-1">
              {{ $t('crmIntelligence.admin.dashboards') }}
            </h3>
            <v-spacer />
            <v-btn
              color="primary"
              small
              outlined
              @click="addDashboard"
            >
              <v-icon left small>
                mdi-plus
              </v-icon>
              {{ $t('crmIntelligence.admin.addDashboard') }}
            </v-btn>
          </div>

          <v-alert
            v-if="!hasDashboards"
            type="info"
            text
            dense
          >
            {{ $t('crmIntelligence.admin.noDashboards') }}
          </v-alert>

          <v-card
            v-for="(dashboard, index) in localConfig.dashboards"
            :key="index"
            outlined
            class="mb-3 pa-3"
          >
            <v-row dense>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model.number="dashboard.metabaseId"
                  :label="$t('crmIntelligence.admin.dashboardId')"
                  :hint="$t('crmIntelligence.admin.dashboardIdHint')"
                  type="number"
                  outlined
                  dense
                  persistent-hint
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="dashboard.name"
                  :label="$t('crmIntelligence.admin.dashboardName')"
                  outlined
                  dense
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="dashboard.description"
                  :label="$t('crmIntelligence.admin.dashboardDescription')"
                  outlined
                  dense
                />
              </v-col>
              <v-col cols="12" md="1">
                <v-text-field
                  v-model.number="dashboard.order"
                  :label="$t('crmIntelligence.admin.dashboardOrder')"
                  type="number"
                  outlined
                  dense
                />
              </v-col>
              <v-col cols="12" md="1" class="d-flex align-center justify-center">
                <v-btn
                  icon
                  color="error"
                  :aria-label="$t('crmIntelligence.admin.removeDashboard')"
                  @click="removeDashboard(index)"
                >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-col>
            </v-row>
          </v-card>
        </div>
      </v-expand-transition>
    </v-card-text>

    <v-card-actions>
      <v-spacer />
      <v-btn
        color="accent"
        :loading="loading"
        @click="saveConfiguration"
      >
        <v-icon left>
          mdi-content-save
        </v-icon>
        {{ $t('global.save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
