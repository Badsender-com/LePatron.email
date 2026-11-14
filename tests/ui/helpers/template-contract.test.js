import { contractSummary } from '~/helpers/template-contract.js';

// What the template page says of a template's contract (#1520, ADR-0024).

describe('the summary of a template contract', () => {
  it('names every root property the template declares or reads, once, in order', () => {
    expect(
      contractSummary({
        declared: { silo: 'youth', headerVisible: 'true' },
        read: ['mainColorVar', 'silo', 'audience'],
        adopt: {},
      }).names
    ).toEqual(['audience', 'headerVisible', 'mainColorVar', 'silo']);
  });

  it('lists where renamed properties are adopted from', () => {
    expect(
      contractSummary({
        declared: {},
        read: [],
        adopt: { siloBrand: 'brand_[silo]' },
      }).adopted
    ).toEqual([{ name: 'siloBrand', source: 'brand_[silo]' }]);
  });

  it('says nothing of a template with no contract', () => {
    expect(contractSummary(undefined)).toEqual({ names: [], adopted: [] });
  });
});
