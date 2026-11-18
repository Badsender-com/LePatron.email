'use strict';

// What the template receives of an email's type (epic #1631, ADR-0030):
// `emailType` is the identifier of the type, like any dimension, and
// `doctrineType` its doctrine type, a name no company dimension may take.

const COMMUNITY = '64a0000000000000000000d1';
const SURVEY = '64a0000000000000000000d2';
const ANONYMOUS = '64a0000000000000000000d3';

const EMAIL_TYPE = {
  name: 'emailType',
  precedence: 0,
  isActive: true,
  values: [
    { id: COMMUNITY, canonicalType: 'com', doctrineType: 'editorial' },
    { id: SURVEY, canonicalType: 'enq', doctrineType: null },
    { id: ANONYMOUS, doctrineType: 'promotional' },
  ],
};

const publish = (emailTypeId) => {
  const {
    governanceValues,
  } = require('../../packages/editor/src/js/utils/governance-values.js');
  return governanceValues({
    dimensions: [EMAIL_TYPE],
    selections: emailTypeId ? { emailType: emailTypeId } : {},
  }).values;
};

// Turned on by #1636 (the template receives the doctrine type as doctrineType)
describe('governance values: doctrineType', () => {
  it('publishes the doctrine type of the email type', () => {
    expect(publish(COMMUNITY).doctrineType).toBe('editorial');
  });

  it('publishes it empty when the email type is mapped onto nothing, or the email has none', () => {
    expect(publish(SURVEY).doctrineType).toBe('');
    expect(publish(null).doctrineType).toBe('');
  });

  it('never lets a design token overwrite it', () => {
    const {
      governanceValues,
    } = require('../../packages/editor/src/js/utils/governance-values.js');
    const { values } = governanceValues({
      dimensions: [
        EMAIL_TYPE,
        {
          name: 'brand',
          precedence: 10,
          isActive: true,
          values: [
            { id: 'b1', canonicalType: 'a', tokens: { doctrineType: 'x' } },
          ],
        },
      ],
      selections: { emailType: COMMUNITY, brand: 'b1' },
    });

    expect(values.doctrineType).toBe('editorial');
  });
});

// Turned on by #1638 (an email type has a free identifier, like any value)
describe('governance values: emailType is the identifier', () => {
  it('publishes the identifier of the email type, not its doctrine type', () => {
    expect(publish(COMMUNITY).emailType).toBe('com');
  });

  it('publishes the id of an email type without an identifier, never its doctrine type', () => {
    expect(publish(ANONYMOUS).emailType).toBe(ANONYMOUS);
  });
});
