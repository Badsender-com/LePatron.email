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
import BsFormSection from '~/components/layout/BsFormSection.vue';
import { Package, Server, Cloud } from 'lucide-vue';

export default {
  name: 'BsExportOptionsTab',
  components: {
    BsFtpSettings,
    BsTextField,
    BsSelect,
    BsFormSection,
    LucidePackage: Package,
    LucideServer: Server,
    LucideCloud: Cloud,
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
      if (
        this.localGroup.downloadMailingWithFtpImages &&
        this.$refs.ftpSettings
      ) {
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
        <bs-form-section>
          <template #icon>
            <lucide-package :size="20" />
          </template>
          <template #title>
            {{ $t('exportOptions.sections.zipFormat') }}
          </template>
          <template #description>
            {{ $t('exportOptions.sections.zipFormatDescription') }}
          </template>
          <v-row>
            <v-col cols="12" md="6">
              <bs-select
                v-model="localGroup.downloadMailingWithoutEnclosingFolder"
                :label="$t('forms.group.downloadWithoutEnclosingFolder.label')"
                :items="folderOptions"
              />
            </v-col>
          </v-row>
        </bs-form-section>

        <!-- ==================== SECTION 2: FTP/SFTP ==================== -->
        <bs-form-section>
          <template #icon>
            <lucide-server :size="20" />
          </template>
          <template #title>
            {{ $t('exportOptions.sections.ftpHosting') }}
          </template>
          <template #description>
            {{ $t('exportOptions.sections.ftpHostingDescription') }}
          </template>

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
        </bs-form-section>

        <!-- ==================== SECTION 3: CDN ==================== -->
        <bs-form-section last>
          <template #icon>
            <lucide-cloud :size="20" />
          </template>
          <template #title>
            {{ $t('exportOptions.sections.cdnHosting') }}
          </template>
          <template #description>
            {{ $t('exportOptions.sections.cdnHostingDescription') }}
          </template>

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
        </bs-form-section>
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

<style lang="scss" scoped></style>
