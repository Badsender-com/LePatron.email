'use strict';

/**
 * The expertises and skills of the platform, for the MCP acceptance tests
 * (epic #1290): an active expertise with an archived and a draft version, a
 * transversal one, a draft one and an archived one, with the fields their
 * schema gives them by default; an active skill and a draft one. All are
 * opened to every company. Re-exported by `mcp-fixtures.js`.
 */

const { daysFrom } = require('./mcp-clock');

// What the expertise schema gives a document it does not set.
const EXPERTISE_DEFAULTS = {
  description: '',
  scope: [],
  isTransversal: false,
  appliesToEmailTypes: [],
  appliesToLanguages: [],
};
const expertise = (fields) => ({ ...EXPERTISE_DEFAULTS, ...fields });

function version(versionMajor, versionMinor, status, body, extra = {}) {
  return {
    versionMajor,
    versionMinor,
    status,
    body,
    examplesGood: [],
    examplesBad: [],
    createdAt: daysFrom(-60),
    updatedAt: daysFrom(-20),
    ...extra,
  };
}

const SUBJECT_BODY_V2 =
  '## Length\n\nKeep the subject under 50 characters.\n\n## Tone\n\nOne promise, no shouting.';

const EXPERTISES = [
  expertise({
    _id: '507f1f77bcf86cd799439801',
    expertiseId: 'redaction.subject-line',
    title: 'Subject lines',
    description: 'How to write an email subject line',
    category: 'redaction',
    scope: ['subject'],
    appliesToEmailTypes: [],
    appliesToLanguages: ['fr', 'en'],
    status: 'ACTIVE',
    audience: 'all',
    activeVersion: { major: 2, minor: 1 },
    versions: [
      version(1, 0, 'ARCHIVED', '## Length\n\nUnder 60 characters.'),
      version(2, 1, 'ACTIVE', SUBJECT_BODY_V2, {
        examplesGood: ['Black Friday: -30% on everything'],
        examplesBad: ['!!! HUGE SALE !!!'],
        updatedAt: daysFrom(-4),
      }),
      version(3, 0, 'DRAFT', '## Length\n\nA draft nobody validated.'),
    ],
  }),
  expertise({
    _id: '507f1f77bcf86cd799439802',
    expertiseId: 'deliverability.spam-words',
    title: 'Spam words',
    category: 'deliverability',
    scope: [],
    isTransversal: true,
    appliesToEmailTypes: [],
    appliesToLanguages: [],
    status: 'ACTIVE',
    audience: 'all',
    activeVersion: { major: 1, minor: 0 },
    versions: [
      version(1, 0, 'ACTIVE', '## Words\n\nAvoid "free" in a subject.'),
    ],
  }),
  expertise({
    _id: '507f1f77bcf86cd799439803',
    expertiseId: 'design.dark-mode',
    title: 'Dark mode',
    category: 'design',
    scope: ['image'],
    status: 'DRAFT',
    audience: 'all',
    activeVersion: { major: null, minor: 0 },
    versions: [version(1, 0, 'DRAFT', '## Logos\n\nNot validated yet.')],
  }),
  expertise({
    _id: '507f1f77bcf86cd799439804',
    expertiseId: 'redaction.old-rules',
    title: 'Old rules',
    category: 'redaction',
    scope: ['subject'],
    status: 'ARCHIVED',
    audience: 'all',
    activeVersion: { major: 1, minor: 0 },
    versions: [version(1, 0, 'ARCHIVED', '## Old\n\nRetired.')],
  }),
];

const SKILLS = [
  {
    _id: '507f1f77bcf86cd799439901',
    skillId: 'redaction.subject-ideas',
    // A feature skill served to assistants (ADR 0013).
    servedToAssistants: true,
    title: 'Subject line ideas',
    description: 'Three subject lines for an email',
    category: 'redaction',
    status: 'ACTIVE',
    audience: 'all',
    activeVersion: { major: 1, minor: 2 },
    versions: [
      {
        versionMajor: 1,
        versionMinor: 2,
        status: 'ACTIVE',
        systemPrompt: 'You write email subject lines for a brand.',
        skillBody: 'Give three subject lines, each under 50 characters.',
        inputTemplate: 'Brief: {{input.prompt}}\nContext: {{input.context}}',
        inputSchemaId: 'genericTextInput',
        outputSchemaId: 'genericTextOutput',
      },
    ],
  },
  {
    _id: '507f1f77bcf86cd799439902',
    skillId: 'qc.unreleased',
    title: 'Not released',
    category: 'qc',
    status: 'DRAFT',
    audience: 'all',
    activeVersion: { major: null, minor: 0 },
    versions: [],
  },
];

module.exports = { EXPERTISES, SKILLS };
