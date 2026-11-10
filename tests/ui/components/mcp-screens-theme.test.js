'use strict';

// The app is white-labelled: the screens of the MCP, and those of the skills
// and expertises a copy follows from production, take their colors from the
// theme and the design tokens (docs/UX_GUIDELINES.md), never by hand. A
// shadow keeps its own.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../..');
const SCREENS = [
  'packages/ui/routes/groups/_groupId/settings/mcp-clients.vue',
  'packages/ui/components/mcp-clients/mcp-client-settings.vue',
  'packages/ui/routes/oauth/consent/_uid.vue',
  'packages/ui/components/group/mcp-access-option.vue',
  'packages/ui/components/group/mcp-access-steps.vue',
  'packages/ui/components/mcp-clients/modal-mcp-client-secret.vue',
  'packages/ui/components/layout/bs-form-section.vue',
  'packages/ui/components/group/ai-features-tab.vue',
  'packages/ui/routes/ai-skills/index.vue',
  'packages/ui/routes/ai-skills/_skillId/index.vue',
  'packages/ui/routes/ai-expertise/_expertiseId/index.vue',
  'packages/ui/components/ai-skill/bs-ai-sync-tab.vue',
  'packages/ui/components/ai-skill/bs-ai-follow-production.vue',
  'packages/ui/components/ai-skill/bs-ai-read-tokens.vue',
  'packages/ui/components/ai-skill/bs-ai-copy-origin-chip.vue',
  'packages/ui/components/ai-skill/bs-ai-copy-panel.vue',
  'packages/ui/components/ai-skill/bs-ai-activate-modal.vue',
  'packages/ui/components/ai-skill/bs-ai-skills-tab.vue',
  'packages/ui/components/ai-skill/bs-ai-expertise-tab.vue',
  'packages/ui/components/ai-skill/bs-ai-skill-versions-panel.vue',
  'packages/ui/components/ai-skill/bs-ai-skill-feature-version-fields.vue',
];

const colorLinesOf = (file) =>
  fs
    .readFileSync(path.join(ROOT, file), 'utf8')
    .split('\n')
    .filter((line) => !/box-shadow/.test(line))
    .filter((line) =>
      /#[0-9a-f]{3,8}\b|rgba?\(|color="(?:white|black)"/i.test(line)
    );

describe.each(SCREENS)('%s', (file) => {
  it('writes no color by hand', () => {
    expect(colorLinesOf(file)).toEqual([]);
  });
});
