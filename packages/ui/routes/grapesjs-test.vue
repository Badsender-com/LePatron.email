<template>
  <div class="grapesjs-test-page">
    <v-container v-if="!templateId" fluid class="pa-8">
      <v-card max-width="600" class="mx-auto">
        <v-card-title>
          Test GrapesJS Editor
        </v-card-title>
        <v-card-text>
          <v-form @submit.prevent="loadEditor">
            <v-text-field
              v-model="inputTemplateId"
              label="Template ID"
              hint="Entrez l'ID d'un mailing existant (editor_type: 'grapesjs')"
              persistent-hint
              outlined
              class="mb-4"
            ></v-text-field>

            <v-alert type="info" outlined class="mb-4">
              <strong>Pour créer un template de test :</strong><br>
              <code style="font-size: 12px;">
                db.mailings.insertOne({<br>
                &nbsp;&nbsp;name: "Test GrapesJS",<br>
                &nbsp;&nbsp;editor_type: "grapesjs",<br>
                &nbsp;&nbsp;brand: "badsender",<br>
                &nbsp;&nbsp;_wireframe: ObjectId("..."),<br>
                &nbsp;&nbsp;_company: ObjectId("..."),<br>
                &nbsp;&nbsp;grapesjs_data: { components: [], styles: [] }<br>
                })
              </code>
            </v-alert>

            <v-btn
              type="submit"
              color="primary"
              block
              large
              :disabled="!inputTemplateId"
            >
              Ouvrir l'éditeur
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-container>

    <!-- GrapesJS Editor Component -->
    <GrapesJSEditor
      v-if="templateId"
      :template-id="templateId"
      :template-name="templateName"
      :enable-brand-selector="true"
    />
  </div>
</template>

<script>
import GrapesJSEditor from '~/components/GrapesJSEditor.vue';
import { ACL_USER } from '~/helpers/pages-acls.js';

export default {
  name: 'GrapesJSTestPage',

  meta: { acl: ACL_USER },

  components: {
    GrapesJSEditor,
  },

  data() {
    return {
      templateId: null,
      templateName: 'Template GrapesJS Test',
      inputTemplateId: '',
    };
  },

  mounted() {
    // Check if template ID is in query params
    if (this.$route.query.id) {
      this.templateId = this.$route.query.id;
      this.loadTemplateInfo();
    }
  },

  methods: {
    loadEditor() {
      if (this.inputTemplateId) {
        this.$router.push({
          query: { id: this.inputTemplateId },
        });
        this.templateId = this.inputTemplateId;
        this.loadTemplateInfo();
      }
    },

    async loadTemplateInfo() {
      try {
        const response = await this.$axios.get(
          `/api/grapesjs/templates/${this.templateId}`
        );
        if (response.data.success && response.data.name) {
          this.templateName = response.data.name;
        }
      } catch (error) {
        console.error('Error loading template info:', error);
      }
    },
  },
};
</script>

<style scoped>
.grapesjs-test-page {
  width: 100%;
  height: 100vh;
}
</style>
