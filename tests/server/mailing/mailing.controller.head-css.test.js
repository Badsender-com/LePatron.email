'use strict';

// PUT /mailings/:mailingId/mosaico stores the head CSS written to style the
// HTML code block, under the same flag.

const {
  Templates,
  TEMPLATE_ID,
  mockMailing,
  mockFlags,
  save,
  resetMocks,
} = require('./update-mosaico.harness.js');
const { htmlBlock, dataWith } = require('./synthetic-blocks.fixtures.js');
const {
  HEAD_CSS_MAX_LENGTH,
} = require('../../../packages/shared/head-css/constants.js');

const mockTemplateFlag = (htmlBlockEnabled) => mockFlags({ htmlBlockEnabled });

beforeEach(resetMocks);

// Head CSS rides the same route, under the same flag, and is stored outside
// `data`. What needs pinning is the same asymmetry as above — the flag going
// off must not lock an author out — plus one thing the block does not have: a
// client that says nothing about the CSS must not erase it.
describe('PUT /mailings/:mailingId/mosaico — head CSS', () => {
  const EMPTY = dataWith();

  it('stores the stylesheet when the template enables it', async () => {
    const mailing = mockMailing(EMPTY, '');
    mockTemplateFlag(true);

    expect(await save({ data: EMPTY, headCss: '.a{color:red}' })).toBeNull();
    expect(mailing.headCss).toBe('.a{color:red}');
  });

  it('refuses a new stylesheet when the template does not enable it', async () => {
    const mailing = mockMailing(EMPTY, '');
    mockTemplateFlag(false);

    const error = await save({ data: EMPTY, headCss: '.a{color:red}' });

    expect(error).toMatchObject({
      status: 403,
      message: 'HEAD_CSS_DISABLED',
    });
    expect(mailing.save).not.toHaveBeenCalled();
  });

  it('keeps the mailing savable when the stored stylesheet is unchanged', async () => {
    const mailing = mockMailing(EMPTY, '.a{color:red}');
    mockTemplateFlag(false);

    expect(await save({ data: EMPTY, headCss: '.a{color:red}' })).toBeNull();
    expect(mailing.save).toHaveBeenCalled();
  });

  it('lets the author clear it even with the flag off', async () => {
    const mailing = mockMailing(EMPTY, '.a{color:red}');
    mockTemplateFlag(false);

    expect(await save({ data: EMPTY, headCss: '' })).toBeNull();
    expect(mailing.headCss).toBe('');
  });

  it('refuses a stylesheet past the limit', async () => {
    const mailing = mockMailing(EMPTY, '');
    mockTemplateFlag(true);

    const error = await save({
      data: EMPTY,
      headCss: 'a'.repeat(HEAD_CSS_MAX_LENGTH + 1),
    });

    expect(error).toMatchObject({ message: 'HEAD_CSS_TOO_LARGE' });
    expect(mailing.save).not.toHaveBeenCalled();
  });

  // An older editor bundle, or the metadata route, says nothing about headCss.
  it('leaves the stored stylesheet alone when the field is absent', async () => {
    const mailing = mockMailing(EMPTY, '.a{color:red}');
    mockTemplateFlag(true);

    expect(await save({ data: EMPTY })).toBeNull();
    expect(mailing.headCss).toBe('.a{color:red}');
  });

  it('loads the template once for both guards, and only when needed', async () => {
    mockMailing(EMPTY, '');

    expect(await save({ data: EMPTY })).toBeNull();
    expect(Templates.findById).not.toHaveBeenCalled();

    mockTemplateFlag(true);
    expect(
      await save({
        data: dataWith(htmlBlock('<p class="a">new</p>')),
        headCss: '.a{color:red}',
      })
    ).toBeNull();
    expect(Templates.findById).toHaveBeenCalledTimes(1);
    expect(Templates.findById).toHaveBeenCalledWith(TEMPLATE_ID);
  });
});
