<script>
import { validationMixin } from 'vuelidate';
import { required } from 'vuelidate/lib/validators';
import { mapGetters, mapMutations } from 'vuex';
import { groupsItem } from '~/helpers/api-routes.js';
import { IS_ADMIN, USER } from '~/store/user';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import BsFtpSettings from '~/components/group/ftp-settings';
import BsTextField from '~/components/form/bs-text-field';
import BsSelect from '~/components/form/bs-select';

export default {
  name: 'BsExportOptionsTab',
  components: {
    BsFtpSettings,
    BsTextField,
    BsSelect,
  },
  mixins: [validationMixin],
  httpOptions: ['http://', 'https://'],
  props: {
    group: { type: Object, default: () => ({}) },
    active: { type: Boolean, default: false },
  },
  data() {
    return {
      localGroup: { ...this.group },
      loading: false,
    };
  },
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
    }),
    folderOptions() {
      return [
        {
          text: this.$t('forms.group.downloadWithoutEnclosingFolder.wrapped'),
          value: false,
        },
        {
          text: this.$t('forms.group.downloadWithoutEnclosingFolder.unwrapped'),
          value: true,
        },
      ];
    },
  },
  watch: {
    group: {
      immediate: true,
      deep: true,
      handler(newGroup) {
        this.localGroup = { ...newGroup };
      },
    },
  },
  validations() {
    const cdnValidations = {
      cdnEndPoint: { required },
      cdnButtonLabel: { required },
    };
    return {
      localGroup: {
        ...(this.localGroup.downloadMailingWithCdnImages && cdnValidations),
      },
    };
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    requiredErrors(fieldName) {
      const errors = [];
      if (!this.$v.localGroup[fieldName]?.$dirty) return errors;
      if (!this.$v.localGroup[fieldName]?.required) {
        errors.push(this.$t('global.errors.required'));
      }
      return errors;
    },
    async onSubmit() {
      this.$v.$touch();
      // Validate FTP settings component if FTP is enabled
      let ftpValid = true;
      if (this.localGroup.downloadMailingWithFtpImages && this.$refs.ftpSettings) {
        ftpValid = this.$refs.ftpSettings.validate();
      }
      if (this.$v.$invalid || !ftpValid) return;

      this.loading = true;
      try {
        await this.$axios.$put(
          groupsItem({ groupId: this.localGroup.id }),
          this.localGroup
        );
        this.showSnackbar({
          text: this.$t('global.saved'),
          color: 'success',
        });
        this.$emit('update');
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
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
  <div>
    <v-card flat tile tag="form">
      <v-card-text>
        <!-- ==================== SECTION 1: ZIP FORMAT ==================== -->
        <div class="form-section">
          <h3 class="form-section__title">
            {{ $t('exportOptions.sections.zipFormat') }}
          </h3>
          <p class="form-section__description">
            {{ $t('exportOptions.sections.zipFormatDescription') }}
          </p>
          <v-row>
            <v-col cols="12" md="6">
              <bs-select
                v-model="localGroup.downloadMailingWithoutEnclosingFolder"
                :label="$t('forms.group.downloadWithoutEnclosingFolder.label')"
                :items="folderOptions"
              />
            </v-col>
          </v-row>
        </div>

        <!-- ==================== SECTION 2: FTP/SFTP ==================== -->
        <div class="form-section">
          <h3 class="form-section__title">
            {{ $t('exportOptions.sections.ftpHosting') }}
          </h3>
          <p class="form-section__description">
            {{ $t('exportOptions.sections.ftpHostingDescription') }}
          </p>

          <v-switch
            v-model="localGroup.downloadMailingWithFtpImages"
            :label="$t('forms.group.exportFtp')"
            hide-details
            class="mb-4"
          />

          <v-expand-transition>
            <div v-if="localGroup.downloadMailingWithFtpImages">
              <bs-ftp-settings
                ref="ftpSettings"
                v-model="localGroup"
                :group-id="group.id"
                :is-edit="!!group.id"
              />
            </div>
          </v-expand-transition>
        </div>

        <!-- ==================== SECTION 3: CDN ==================== -->
        <div class="form-section">
          <h3 class="form-section__title">
            {{ $t('exportOptions.sections.cdnHosting') }}
          </h3>
          <p class="form-section__description">
            {{ $t('exportOptions.sections.cdnHostingDescription') }}
          </p>

          <v-switch
            v-model="localGroup.downloadMailingWithCdnImages"
            :label="$t('forms.group.exportCdn')"
            hide-details
            class="mb-4"
          />

          <v-expand-transition>
            <div v-if="localGroup.downloadMailingWithCdnImages">
              <v-row>
                <v-col cols="12" md="2">
                  <bs-select
                    v-model="localGroup.cdnProtocol"
                    :label="$t('forms.group.httpProtocol')"
                    :items="$options.httpOptions"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <bs-text-field
                    v-model="localGroup.cdnEndPoint"
                    :label="$t('forms.group.endpoint')"
                    :hint="$t('exportOptions.cdnEndpointHint')"
                    placeholder="cdn.example.com"
                    :error-messages="requiredErrors('cdnEndPoint')"
                    @blur="$v.localGroup.cdnEndPoint.$touch()"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <bs-text-field
                    v-model="localGroup.cdnButtonLabel"
                    :label="$t('forms.group.editorLabel')"
                    :hint="$t('exportOptions.cdnButtonLabelHint')"
                    placeholder="Amazon S3"
                    :error-messages="requiredErrors('cdnButtonLabel')"
                    @blur="$v.localGroup.cdnButtonLabel.$touch()"
                  />
                </v-col>
              </v-row>
            </div>
          </v-expand-transition>
        </div>
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn
          elevation="0"
          color="accent"
          :loading="loading"
          :disabled="loading"
          @click="onSubmit"
        >
          {{ $t('global.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<style lang="scss" scoped>
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
</style>
