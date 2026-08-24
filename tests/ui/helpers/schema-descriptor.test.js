'use strict';

const {
  fetchSchemaDescriptor,
  clearDescriptorCache,
  humanizeFieldLabel,
  fieldPlaceholder,
} = require('../../../packages/ui/helpers/schema-descriptor');

function mockAxios(impl) {
  return { $get: jest.fn(impl) };
}

const DESCRIPTOR = {
  schemaId: 'genericTextInput',
  fields: [{ name: 'prompt', type: 'string', required: true }],
  hasExpertiseField: false,
};

beforeEach(() => clearDescriptorCache());

describe('fetchSchemaDescriptor', () => {
  it('answers null without calling the API when there is no schema id', async () => {
    const axios = mockAxios();
    expect(await fetchSchemaDescriptor(axios, null)).toBeNull();
    expect(await fetchSchemaDescriptor(axios, '')).toBeNull();
    expect(axios.$get).not.toHaveBeenCalled();
  });

  it('fetches once and serves the cache afterwards', async () => {
    const axios = mockAxios(async () => DESCRIPTOR);
    expect(await fetchSchemaDescriptor(axios, 'genericTextInput')).toBe(
      DESCRIPTOR
    );
    expect(await fetchSchemaDescriptor(axios, 'genericTextInput')).toBe(
      DESCRIPTOR
    );
    expect(axios.$get).toHaveBeenCalledTimes(1);
    expect(axios.$get).toHaveBeenCalledWith(
      '/ai-skills/schemas/genericTextInput/descriptor'
    );
  });

  it('deduplicates concurrent calls for the same schema', async () => {
    // The promise is cached, not the value — two expansions of the same panel
    // must not fire two requests.
    const axios = mockAxios(async () => DESCRIPTOR);
    const [a, b] = await Promise.all([
      fetchSchemaDescriptor(axios, 'genericTextInput'),
      fetchSchemaDescriptor(axios, 'genericTextInput'),
    ]);
    expect(a).toBe(b);
    expect(axios.$get).toHaveBeenCalledTimes(1);
  });

  it('bypasses the cache with `fresh`, which is what a skill change needs', async () => {
    // A super-admin may have edited the skill's inputSchemaId meanwhile: the
    // form must never be built on a stale descriptor.
    const axios = mockAxios(async () => DESCRIPTOR);
    await fetchSchemaDescriptor(axios, 'genericTextInput');
    await fetchSchemaDescriptor(axios, 'genericTextInput', { fresh: true });
    expect(axios.$get).toHaveBeenCalledTimes(2);
  });

  it('treats a 404 as an unknown schema, and does not cache the failure', async () => {
    const notFound = { response: { status: 404 } };
    const axios = mockAxios(async () => {
      throw notFound;
    });
    expect(await fetchSchemaDescriptor(axios, 'ghostInput')).toBeNull();
    // The rejection removed the entry, so a later call retries rather than
    // serving "unknown" forever.
    await fetchSchemaDescriptor(axios, 'ghostInput');
    expect(axios.$get).toHaveBeenCalledTimes(2);
  });

  it('propagates any other error instead of silently answering null', async () => {
    const axios = mockAxios(async () => {
      throw Object.assign(new Error('boom'), { response: { status: 500 } });
    });
    await expect(fetchSchemaDescriptor(axios, 'brokenInput')).rejects.toThrow(
      'boom'
    );
  });

  it('caches per schema id', async () => {
    const axios = mockAxios(async (url) => ({ url }));
    const a = await fetchSchemaDescriptor(axios, 'aInput');
    const b = await fetchSchemaDescriptor(axios, 'bInput');
    expect(a).not.toEqual(b);
    expect(axios.$get).toHaveBeenCalledTimes(2);
  });
});

describe('humanizeFieldLabel', () => {
  // `vm` stands in for the component: $te says whether a key exists.
  const vmWithout = { $te: () => false, $t: (k) => k };
  const vmWith = {
    $te: (k) => k === 'aiPlayground.fieldLabels.prompt',
    $t: () => 'Consigne',
  };

  it('prefers an explicit i18n override', () => {
    expect(humanizeFieldLabel(vmWith, 'prompt')).toBe('Consigne');
  });

  it('splits camelCase', () => {
    expect(humanizeFieldLabel(vmWithout, 'emailType')).toBe('Email type');
  });

  it('splits snake_case and dotted names', () => {
    expect(humanizeFieldLabel(vmWithout, 'target_audience')).toBe(
      'Target audience'
    );
    expect(humanizeFieldLabel(vmWithout, 'brief.summary')).toBe(
      'Brief summary'
    );
  });

  it('keeps digits attached to their word but breaks before a capital', () => {
    expect(humanizeFieldLabel(vmWithout, 'variant2Label')).toBe(
      'Variant2 label'
    );
  });

  it('survives a single word and an empty name', () => {
    expect(humanizeFieldLabel(vmWithout, 'prompt')).toBe('Prompt');
    expect(humanizeFieldLabel(vmWithout, '')).toBe('');
  });
});

describe('fieldPlaceholder', () => {
  it('returns the translation when a key exists, and nothing otherwise', () => {
    const vm = {
      $te: (k) => k === 'aiPlayground.fieldPlaceholders.prompt',
      $t: () => 'e.g. write a tagline…',
    };
    expect(fieldPlaceholder(vm, 'prompt')).toBe('e.g. write a tagline…');
    expect(fieldPlaceholder(vm, 'other')).toBe('');
  });
});
