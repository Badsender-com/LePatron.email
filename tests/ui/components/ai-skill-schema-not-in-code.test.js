/**
 * @jest-environment jsdom
 */
'use strict';

// A feature skill born on production before its code (ADR 0019), mounted in
// French and in English: its draft names a schema the code of this instance
// does not have yet, which the field takes and says the publication waits
// for, and which a badge keeps on the draft.

const { mountSfc, settle } = require('../../helpers/mount-sfc.js');
const { wordsOf } = require('../../helpers/ui-words.js');
const schemasHelper = require('~/helpers/ai-skill-schemas.js');
const errors = require('~/helpers/ai-skill-errors.js');
const categories = require('~/helpers/ai-skill-categories.js');
const versionDrafts = require('~/helpers/mixins/mixin-version-drafts.js');
const schemaDescriptors = require('~/helpers/mixins/mixin-schema-descriptors.js');
const fr = require('~/helpers/locales/fr.js').default;
const en = require('~/helpers/locales/en.js').default;

const FIELDS =
  'packages/ui/components/ai-skill/bs-ai-skill-feature-version-fields.vue';
const PANEL = 'packages/ui/components/ai-skill/bs-ai-skill-versions-panel.vue';
const LOCALES = { fr, en };
const SCHEMAS = ['subjectInput', 'subjectOutput'];

// What the design system's combobox does: it takes any value, typed or
// picked, and emits it.
const comboboxStub = {
  props: { value: { type: String, default: '' } },
  render(h) {
    return h('input', {
      class: 'combobox-stub',
      domProps: { value: this.value },
      on: { change: (event) => this.$emit('input', event.target.value) },
    });
  },
};

afterEach(() => {
  document.body.innerHTML = '';
});

function mountFields({ locale = 'fr', inputSchemaId, outputSchemaId } = {}) {
  return mountSfc(FIELDS, {
    props: { inputSchemaId, outputSchemaId, schemas: SCHEMAS },
    mocks: wordsOf(LOCALES[locale]),
    imports: {
      'lucide-vue': {},
      '~/components/form/bs-textarea.vue': {},
      '~/components/form/bs-combobox.vue': comboboxStub,
      '~/helpers/copy-to-clipboard.js': {
        __esModule: true,
        default: jest.fn(),
      },
      '~/helpers/ai-skill-schemas.js': schemasHelper,
    },
  });
}

const missing = (vm) => {
  const el = vm.$el.querySelector('.schema-missing');
  return el && el.textContent.replace(/\s+/g, ' ').trim();
};

describe('the schemas of a feature version', () => {
  it('takes a schema the code does not have yet', async () => {
    const vm = mountFields({ inputSchemaId: 'subjectInput' });
    const changed = jest.fn();
    vm.$on('update:inputSchemaId', changed);

    const field = vm.$el.querySelector('.combobox-stub');
    field.value = 'newsletterInput';
    field.dispatchEvent(new Event('change'));

    expect(changed).toHaveBeenCalledWith('newsletterInput');
  });

  it.each([
    [
      'fr',
      "Le schéma newsletterInput n'existe pas dans le code de cette instance : le brouillon s'enregistre, la publication attendra son déploiement.",
    ],
    [
      'en',
      'The schema newsletterInput is not in the code of this instance: the draft is saved, the publication waits for its release.',
    ],
  ])('says in %s that its publication waits for the code', (locale, words) => {
    const vm = mountFields({
      locale,
      inputSchemaId: 'newsletterInput',
      outputSchemaId: 'subjectOutput',
    });
    expect(missing(vm)).toBe(words);
  });

  it('says it of both schemas at once', () => {
    const vm = mountFields({
      inputSchemaId: 'newsletterInput',
      outputSchemaId: 'newsletterOutput',
    });
    expect(missing(vm)).toMatch(
      /^Les schémas newsletterInput, newsletterOutput n'existent pas/
    );
  });

  it('says nothing of a schema the code has', () => {
    const vm = mountFields({
      inputSchemaId: 'subjectInput',
      outputSchemaId: 'subjectOutput',
    });
    expect(missing(vm)).toBeNull();
  });
});

describe('a draft naming a schema the code lacks', () => {
  function mountPanel(locale, inputSchemaId) {
    return mountSfc(PANEL, {
      props: {
        schemas: SCHEMAS,
        skill: {
          skillId: 'newsletter',
          activeVersion: { major: 1, minor: 0 },
          versions: [
            {
              versionMajor: 1,
              versionMinor: 0,
              status: 'ACTIVE',
              nature: 'feature',
              inputSchemaId: 'subjectInput',
              outputSchemaId: 'subjectOutput',
            },
            {
              versionMajor: 2,
              versionMinor: 0,
              status: 'DRAFT',
              nature: 'feature',
              inputSchemaId,
              outputSchemaId: 'subjectOutput',
            },
          ],
        },
      },
      mocks: {
        ...wordsOf(LOCALES[locale]),
        $axios: { $get: jest.fn().mockResolvedValue({ fields: [] }) },
      },
      imports: {
        'lucide-vue': {},
        '~/components/form/bs-textarea.vue': {},
        '~/components/form/bs-select.vue': {},
        '~/components/bs-timestamp.vue': {},
        '~/helpers/ai-skill-errors.js': errors,
        '~/helpers/ai-skill-schemas.js': schemasHelper,
        '~/helpers/mixins/mixin-version-drafts.js': versionDrafts,
        '~/helpers/mixins/mixin-schema-descriptors.js': schemaDescriptors,
        '~/components/ai-skill/bs-ai-skill-feature-version-fields.vue': {},
        '~/components/ai-skill/bs-ai-skill-task-version-fields.vue': {},
        '~/components/ai-skill/bs-ai-skill-test-cases.vue': {},
        '~/helpers/ai-skill-categories.js': categories,
      },
    });
  }

  it.each([
    ['fr', 'Schéma absent du code'],
    ['en', 'Schema not in the code'],
  ])('keeps a badge, in %s', async (locale, words) => {
    const vm = mountPanel(locale, 'newsletterInput');
    await settle(vm);
    const badges = [
      ...vm.$el.querySelectorAll('.version-schema-missing'),
    ].map((el) => el.textContent.trim());
    expect(badges).toEqual([words]);
  });

  it('keeps none once the code has the schema', async () => {
    const vm = mountPanel('fr', 'subjectInput');
    await settle(vm);
    expect(vm.$el.querySelectorAll('.version-schema-missing')).toHaveLength(0);
  });

  it.each([
    ['fr', /« newsletterInput » n'existe pas dans le code/],
    ['en', /"newsletterInput" is not in the code/],
  ])('says it among the warnings of a save, in %s', async (locale, words) => {
    const vm = mountPanel(locale, 'newsletterInput');
    vm.$props.warnings = schemasHelper.withMissingSchemaWarnings(
      [],
      { inputSchemaId: 'newsletterInput' },
      SCHEMAS
    );
    vm.$props.warningsVersionKey = '2.0';
    await settle(vm);
    expect(vm.$el.textContent).toMatch(words);
  });
});
