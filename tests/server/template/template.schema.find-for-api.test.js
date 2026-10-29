'use strict';

// TemplateSchema.statics.findForApi feeds the templates list. The super admin's
// list links each template to its group (components/templates/table.vue reads
// `group.id` and `group.name`). `group` is only the schema alias of `_company`,
// and a lean read has no aliases: findForApi has to put it on each template.

const mongoose = require('mongoose');
const TemplateSchema = require('../../../packages/server/template/template.schema');

const findForApi = TemplateSchema.statics.findForApi;

const GROUP_ID = mongoose.Types.ObjectId('507f1f77bcf86cd799439b01');

// A fake `this` for the static: the first find (the list) resolves to `docs`
// through populate().sort().lean(), the second (the markup lookup) to [].
function makeModel(docs) {
  const listQuery = {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(docs),
  };
  const markupQuery = { lean: jest.fn().mockResolvedValue([]) };
  const find = jest
    .fn()
    .mockReturnValueOnce(listQuery)
    .mockReturnValueOnce(markupQuery);
  return { find };
}

describe('TemplateSchema.statics.findForApi — the group of each template', () => {
  it('gives each template its group, with an id and a name', async () => {
    const model = makeModel([
      {
        _id: mongoose.Types.ObjectId('507f1f77bcf86cd799439001'),
        name: 'Newsletter',
        _company: { _id: GROUP_ID, name: 'Acme' },
      },
    ]);

    const [template] = await findForApi.call(model, {});

    expect(String(template.group.id)).toBe(String(GROUP_ID));
    expect(template.group.name).toBe('Acme');
  });

  it('gives no group to a template whose group no longer exists', async () => {
    const model = makeModel([
      {
        _id: mongoose.Types.ObjectId('507f1f77bcf86cd799439002'),
        name: 'Orphan',
        _company: null,
      },
    ]);

    const [template] = await findForApi.call(model, {});

    expect(template.group).toBeNull();
  });
});
