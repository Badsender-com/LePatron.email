'use strict';

/**
 * The expertises and skills of the platform, for the MCP acceptance tests
 * (epic #1290): an active expertise with an archived and a draft version, a
 * transversal one, a draft one and an archived one; an active skill and a
 * draft one. Re-exported by `mcp-fixtures.js`.
 */

const NOW = new Date();
const daysFrom = (days) => new Date(NOW.getTime() + days * 24 * 3600 * 1000);

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
  {
    _id: '507f1f77bcf86cd799439801',
    expertiseId: 'redaction.subject-line',
    title: 'Subject lines',
    description: 'How to write an email subject line',
    category: 'redaction',
    scope: ['subject'],
    appliesToEmailTypes: [],
    appliesToLanguages: ['fr', 'en'],
    status: 'ACTIVE',
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
  },
  {
    _id: '507f1f77bcf86cd799439802',
    expertiseId: 'deliverability.spam-words',
    title: 'Spam words',
    category: 'deliverability',
    scope: [],
    isTransversal: true,
    appliesToEmailTypes: [],
    appliesToLanguages: [],
    status: 'ACTIVE',
    activeVersion: { major: 1, minor: 0 },
    versions: [
      version(1, 0, 'ACTIVE', '## Words\n\nAvoid "free" in a subject.'),
    ],
  },
  {
    _id: '507f1f77bcf86cd799439803',
    expertiseId: 'design.dark-mode',
    title: 'Dark mode',
    category: 'design',
    scope: ['image'],
    status: 'DRAFT',
    activeVersion: { major: null, minor: 0 },
    versions: [version(1, 0, 'DRAFT', '## Logos\n\nNot validated yet.')],
  },
  {
    _id: '507f1f77bcf86cd799439804',
    expertiseId: 'redaction.old-rules',
    title: 'Old rules',
    category: 'redaction',
    scope: ['subject'],
    status: 'ARCHIVED',
    activeVersion: { major: 1, minor: 0 },
    versions: [version(1, 0, 'ARCHIVED', '## Old\n\nRetired.')],
  },
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
    activeVersion: { major: null, minor: 0 },
    versions: [],
  },
];

module.exports = { EXPERTISES, SKILLS };
