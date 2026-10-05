'use strict';

// Duplicate + translate writes back only what it asked for. The provider's
// answer is reduced to the keys that were sent — anything else it returns is
// dropped before any injector sees it — and a composed block is translated,
// hence rebuilt, only on a template that allows the builder.

jest.mock('../../../packages/server/translation/translation-jobs', () => ({
  createJob: jest.fn(),
  isCancelled: jest.fn(),
  setTotals: jest.fn(),
  updateBatchProgress: jest.fn(),
  setCompleted: jest.fn(),
  setFailed: jest.fn(),
}));
jest.mock('../../../packages/server/mailing/mailing.service', () => ({
  findOneForUser: jest.fn(),
  duplicateWithTranslatedData: jest.fn(),
  updatePreviewHtml: jest.fn(),
}));
jest.mock('../../../packages/server/common/models.common', () => ({
  Templates: { findById: jest.fn() },
}));
jest.mock('../../../packages/server/ai-feature/ai-feature.service', () => ({
  getActiveFeatureWithIntegration: jest.fn(),
}));
jest.mock(
  '../../../packages/server/integration-providers/provider-factory',
  () => ({ createProvider: jest.fn() })
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const translationJobs = require('../../../packages/server/translation/translation-jobs');
const mailingService = require('../../../packages/server/mailing/mailing.service');
const { Templates } = require('../../../packages/server/common/models.common');
const aiFeatureService = require('../../../packages/server/ai-feature/ai-feature.service');
const ProviderFactory = require('../../../packages/server/integration-providers/provider-factory');
const controller = require('../../../packages/server/translation/translation.controller.js');
const {
  generate,
  emptyState,
} = require('../../../packages/shared/block-builder/generate.js');
const {
  serialiseState,
  parseState,
} = require('../../../packages/shared/block-builder/state.js');
const {
  elementFor,
} = require('../../../packages/shared/block-builder/elements/index.js');

const element = (id, type, values) => ({
  id,
  type,
  ...elementFor(type).defaults,
  ...values,
});
const STATE = {
  ...emptyState(),
  elements: [
    element('el-1', 'text', { content: 'Bonjour' }),
    element('el-2', 'button', {
      label: 'Découvrir',
      href: 'https://example.com',
    }),
  ],
};
const COMPOSED = {
  type: 'blockBuilderBlock',
  builderState: serialiseState(STATE),
  builderHtml: generate(STATE),
};
const SOURCE = {
  _company: 'group',
  _wireframe: 'template',
  name: 'Source',
  data: {
    mainBlocks: {
      blocks: [{ type: 'titleBlock', text: 'Bienvenue' }, COMPOSED],
    },
  },
  headCss: '',
  previewHtml: '',
};
const DICTIONARY = {
  Bienvenue: 'Welcome',
  Bonjour: 'Hello',
  Découvrir: 'Discover',
  Source: 'Source',
};

// Translates what it is sent, and adds `extra` to its answer.
function givenProvider(extra = {}) {
  ProviderFactory.createProvider.mockReturnValue({
    translateBatch: jest.fn(async ({ texts }) => ({
      ...Object.fromEntries(
        Object.entries(texts).map(([key, value]) => [
          key,
          DICTIONARY[value] || value,
        ])
      ),
      ...extra,
    })),
  });
}

async function duplicateAndTranslate() {
  const completed = new Promise((resolve) => {
    translationJobs.setCompleted.mockImplementation(async (_id, result) =>
      resolve(result)
    );
    translationJobs.setFailed.mockImplementation(async (_id, message) =>
      resolve(new Error(message))
    );
  });
  await controller.duplicateAndTranslate(
    {
      user: { id: 'user', group: { id: 'group' } },
      params: { mailingId: 'source' },
      body: { targetLanguage: 'en', sourceLanguage: 'fr' },
    },
    { status: jest.fn().mockReturnThis(), json: jest.fn() },
    jest.fn()
  );
  expect(await completed).not.toBeInstanceOf(Error);
  return mailingService.duplicateWithTranslatedData.mock.calls[0][0]
    .translatedData;
}

const givenTemplate = (blockBuilderEnabled) =>
  Templates.findById.mockResolvedValue({ markup: '', blockBuilderEnabled });

beforeEach(() => {
  jest.clearAllMocks();
  translationJobs.createJob.mockResolvedValue({ jobId: 'job' });
  translationJobs.isCancelled.mockResolvedValue(false);
  aiFeatureService.getActiveFeatureWithIntegration.mockResolvedValue({
    integration: { provider: 'openai' },
    feature: { config: { availableLanguages: ['fr', 'en'] } },
  });
  mailingService.findOneForUser.mockResolvedValue(SOURCE);
  mailingService.duplicateWithTranslatedData.mockResolvedValue({
    _id: 'copy',
    name: 'Source - EN',
  });
});

describe('an answer holding keys that were not sent', () => {
  beforeEach(() => {
    givenTemplate(true);
    givenProvider({
      'builderBlock.mainBlocks.1.1.href': 'https://other.example',
      'data.mainBlocks.blocks.1.builderHtml': '<p>replaced</p>',
      'data.mainBlocks.blocks.0.type': 'otherBlock',
    });
  });

  it('writes only the texts that were sent', async () => {
    const data = await duplicateAndTranslate();
    const [title, block] = data.mainBlocks.blocks;
    const state = parseState(block.builderState);

    expect(title).toEqual({ type: 'titleBlock', text: 'Welcome' });
    expect(state.elements[1].label).toBe('Discover');
    expect(state.elements[1].href).toBe('https://example.com');
  });

  it('stores the markup the translated state generates', async () => {
    const data = await duplicateAndTranslate();
    const block = data.mainBlocks.blocks[1];

    expect(block.builderHtml).toBe(generate(parseState(block.builderState)));
    expect(block.builderHtml).not.toContain('replaced');
  });
});

describe('a template without the builder', () => {
  beforeEach(() => {
    givenTemplate(false);
    givenProvider();
  });

  it('copies the composed block as it is', async () => {
    const data = await duplicateAndTranslate();
    const block = data.mainBlocks.blocks[1];

    expect(block.builderState).toBe(COMPOSED.builderState);
    expect(block.builderHtml).toBe(COMPOSED.builderHtml);
  });

  it('still translates the rest of the mailing', async () => {
    const data = await duplicateAndTranslate();

    expect(data.mainBlocks.blocks[0].text).toBe('Welcome');
  });
});
