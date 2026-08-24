'use strict';

const mongoose = require('mongoose');
const AISkillInvocationSchema = require('../../../../packages/server/ai-skill/models/ai-skill-invocation.schema');

const InvocationModel =
  mongoose.models.__TestInvocation ||
  mongoose.model('__TestInvocation', AISkillInvocationSchema);

describe('AISkillInvocation model', () => {
  it('validates a minimal successful invocation', async () => {
    const inv = new InvocationModel({
      skillId: 'generic.text',
      _company: new mongoose.Types.ObjectId(),
      status: 'SUCCESS',
    });
    await expect(inv.validate()).resolves.toBeUndefined();
  });

  it('requires _company', async () => {
    const inv = new InvocationModel({
      skillId: 'generic.text',
      status: 'SUCCESS',
    });
    await expect(inv.validate()).rejects.toThrow(/_company/);
  });

  it('rejects an unknown status', async () => {
    const inv = new InvocationModel({
      skillId: 'generic.text',
      _company: new mongoose.Types.ObjectId(),
      status: 'WUT',
    });
    await expect(inv.validate()).rejects.toThrow(/status/);
  });

  it('accepts null input/output for no-content-logging mode', async () => {
    const inv = new InvocationModel({
      skillId: 'generic.text',
      _company: new mongoose.Types.ObjectId(),
      status: 'SUCCESS',
      input: null,
      output: null,
    });
    await expect(inv.validate()).resolves.toBeUndefined();
  });
});
