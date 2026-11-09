'use strict';

const mongoose = require('mongoose');
const { z } = require('zod');
const {
  ResourceTemplate,
  ResourceNotFoundError,
} = require('@modelcontextprotocol/server');
const {
  locateReadableMailing,
} = require('../mailing/mailing-search.service.js');
const {
  sanitizePreviewCached,
  PREVIEW_CACHE_MAX_ENTRY,
} = require('../mailing/mailing.service.js');
const { Mailings } = require('../common/models.common.js');
const { withIdentity, failure } = require('./mcp-identity.js');
const { approvedMailingIds } = require('./mcp-mailing-status.js');
const { mailingText, variablesOf } = require('./mcp-mailing-text.js');
const { MAILING, asItem } = require('./mcp-mailings.js');
const { READ_ONLY } = require('./mcp-tool-grammar.js');
const { PREVIEW_TOOL_META, withPreview } = require('./mcp-preview-app.js');

// Reading one mailing (#1304, ADR 0012): its facts and derived status, and its
// content, read from the sanitised preview the app serves.

const MAILING_NOT_FOUND =
  'Mailing not found: it does not exist, or this user may not read it.';

const FORMATS = ['text', 'html'];
// What an assistant may send: bounded, like every input of this server.
const MAX_ID_LENGTH = 100;

// Sanitising and parsing are synchronous, about a second per megabyte: past
// this, a preview is not read for an assistant. Real ones weigh 50 to 120 KB.
// The bound is the size of the largest sanitised preview the app caches, but
// it counts the preview as saved, in code points, and the cache counts it
// sanitised, which can be longer (`>` becomes `&gt;`): it bounds what is read,
// and most previews read stay in the cache, not all.
const MAX_PREVIEW_LENGTH = PREVIEW_CACHE_MAX_ENTRY;

// Why a mailing comes without content.
const NO_CONTENT = {
  NEVER_SAVED: 'never-saved',
  TOO_LARGE: 'too-large',
};

const READ_FIELDS = [
  'name',
  'subject',
  'tags',
  'espIds',
  'plannedSendDate',
  'author',
  'wireframe',
  'createdAt',
  'updatedAt',
  // The template's own preheader, when it declares one.
  'data.preheaderText',
].join(' ');

const codePointsOf = (text) => [...text].length;

// The preview of a mailing the user may read, measured in the database first,
// in code points as `$strLenCP` counts them: past the bound, it is never
// transferred.
async function contentOf(mailing) {
  const _id = mongoose.Types.ObjectId(String(mailing._id));
  const [measured] = await Mailings.aggregate([
    { $match: { _id } },
    {
      $project: { length: { $strLenCP: { $ifNull: ['$previewHtml', ''] } } },
    },
  ]);
  if (!measured || !measured.length) return { missing: NO_CONTENT.NEVER_SAVED };
  if (measured.length > MAX_PREVIEW_LENGTH) {
    return { missing: NO_CONTENT.TOO_LARGE };
  }
  // Read with its own last write, which keys the cache of sanitised previews.
  const read = await Mailings.findOne({ _id }, 'previewHtml updatedAt').lean();
  if (!read || !read.previewHtml) return { missing: NO_CONTENT.NEVER_SAVED };
  // Saved again between the two reads: measured again, the same way.
  if (codePointsOf(read.previewHtml) > MAX_PREVIEW_LENGTH) {
    return { missing: NO_CONTENT.TOO_LARGE };
  }
  return { html: sanitizePreviewCached(read) };
}

/**
 * One mailing the user may read: its facts and derived status, and its
 * content, its text by default and its HTML on request. A mailing never saved
 * in the editor, or too large to read, has none, and says why.
 *
 * @returns {Promise<{ answer: Object, html: string|null }|null>} the answer,
 *   and the sanitised preview it was read from; null when the user may not
 *   read it
 */
async function readMailing(mailingId, { user }, format = 'text') {
  const found = await locateReadableMailing(user, mailingId, READ_FIELDS);
  if (!found) return null;
  const { mailing, location } = found;
  const approved = (await approvedMailingIds([mailing._id])).has(
    String(mailing._id)
  );
  const facts = asItem(
    {
      ...mailing,
      // The names the search answers under, copied on the mailing.
      userName: mailing.author,
      templateName: mailing.wireframe,
      location,
    },
    { ...mailing, approved }
  );
  const { html = null, missing } = await contentOf(mailing);
  const content =
    format === 'html'
      ? { html }
      : { text: html ? mailingText(mailing, html) : null };
  return {
    answer: {
      ...facts,
      ...content,
      ...(missing && { contentMissing: missing }),
      variables: html ? variablesOf(mailing, html) : [],
    },
    html,
  };
}

// What an assistant reads of a mailing, without the preview handed to an app.
async function mailingOf(mailingId, identity, format) {
  const read = await readMailing(mailingId, identity, format);
  return read && read.answer;
}

const GET_INPUT = z.object({
  mailingId: z
    .string()
    .max(MAX_ID_LENGTH)
    .describe('The id of the mailing, as list_mailings or search gave it.'),
  format: z
    .enum(FORMATS)
    .optional()
    .describe(
      'text (default): the content in reading order. html: the HTML the app previews.'
    ),
});
const GET_OUTPUT = MAILING.extend({
  text: z.string().nullable().optional(),
  html: z.string().nullable().optional(),
  contentMissing: z.enum(Object.values(NO_CONTENT)).optional(),
  variables: z.array(z.string()),
});

function registerGetMailing(server) {
  server.registerTool(
    'get_mailing',
    {
      title: 'Read a mailing',
      description:
        'Reads one mailing the user may read in LePatron: its facts and status, as list_mailings gives them, and its content. By default its text, in reading order: subject, preheader, headings after #, paragraphs, links as [label](href), images by their alternative text. With format html, its HTML instead, as the app previews it. Personalization variables ({{firstname}}, %%FIRSTNAME%%, [[firstname]]) are kept where they stand and listed in variables: never fill them in. A mailing without content (null) says why in contentMissing: never saved in the editor, or too large to read here.',
      inputSchema: GET_INPUT,
      outputSchema: GET_OUTPUT,
      annotations: READ_ONLY,
      // The clients that render MCP Apps show the email itself (#1342).
      _meta: PREVIEW_TOOL_META,
    },
    withIdentity(async (identity, { mailingId, format }) => {
      const read = await readMailing(mailingId, identity, format);
      if (!read) return failure(MAILING_NOT_FOUND);
      // The preview travels for the app only: the assistant reads the answer.
      return withPreview(
        {
          content: [{ type: 'text', text: JSON.stringify(read.answer) }],
          structuredContent: read.answer,
        },
        read
      );
    })
  );
}

const NO_CONTENT_TEXT = {
  [NO_CONTENT.NEVER_SAVED]:
    'No content: this mailing was never saved in the editor.',
  [NO_CONTENT.TOO_LARGE]:
    'No content: this mailing is too large to be read here. Open it in LePatron.',
};

// The resource a listing links to: the mailing's facts, then its text.
function asPlainText(mailing) {
  const where = [mailing.workspace, mailing.folder, mailing.subfolder]
    .filter(Boolean)
    .map(({ name }) => name)
    .join(' / ');
  return [
    `# ${mailing.name}`,
    '',
    `Status: ${mailing.status}. In ${where}.`,
    ...(mailing.variables.length
      ? [`Personalization variables: ${mailing.variables.join(', ')}.`]
      : []),
    '',
    mailing.text || NO_CONTENT_TEXT[mailing.contentMissing],
  ].join('\n');
}

function registerMailingResources(server) {
  server.registerResource(
    'mailings',
    // Never listed: list_mailings pages through them, and links to each.
    new ResourceTemplate('lepatron://mailings/{mailingId}', {
      list: undefined,
    }),
    {
      title: 'LePatron mailings',
      description: 'A mailing the user may read, as text.',
      mimeType: 'text/plain',
    },
    withIdentity(async (identity, uri, { mailingId }) => {
      const mailing = await mailingOf(mailingId, identity);
      if (!mailing) throw new ResourceNotFoundError(uri.href);
      return {
        contents: [
          { uri: uri.href, mimeType: 'text/plain', text: asPlainText(mailing) },
        ],
      };
    })
  );
}

module.exports = {
  mailingOf,
  asPlainText,
  registerGetMailing,
  registerMailingResources,
  MAX_PREVIEW_LENGTH,
};
