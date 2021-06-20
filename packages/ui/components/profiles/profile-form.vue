<script>
import { validationMixin } from 'vuelidate';
import SendinblueForm from './sendinblue-form';

const profileTypes = [
  {
    label: 'Sendinblue',
    value: 'sendinblue',
  },
  {
    label: 'Actity',
    value: 'actity',
  },
];
export default {
  name: 'ProfileForm',
  components: {
    SendinblueForm,
  },
  mixins: [validationMixin],
  data: () => ({ profileTypes }),
  computed: {
    currentForm: () => {
      return 'SendinblueForm';
    },
  },
};
</script>

<template>
  <v-card tag="form">
    <v-container>
      <v-row>
        <v-col class="d-flex" cols="12" sm="4">
          <div>
            <v-select
              :items="profileTypes"
              :item-text="'label'"
              :item-value="'value'"
              :label="$t('profiles.profileType')"
              dense
            />
          </div>
        </v-col>
        <v-col class="d-flex" cols="12" sm="8">
          <div>
            <keep-alive>
              <component :is="currentForm" />
            </keep-alive>
          </div>
        </v-col>
      </v-row>
    </v-container>
  </v-card>
</template>
