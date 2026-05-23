// API route helpers for the LePatron Skills IA module.
// Prefix is added by axios (/api).

export function aiSkills() {
  return '/ai-skills';
}
export function aiSkill(skillId) {
  return `/ai-skills/${skillId}`;
}
export function aiSkillVersions(skillId) {
  return `/ai-skills/${skillId}/versions`;
}
export function aiSkillVersion(skillId, n) {
  return `/ai-skills/${skillId}/versions/${n}`;
}
export function aiSkillActivate(skillId, n) {
  return `/ai-skills/${skillId}/versions/${n}/activate`;
}
export function aiSkillArchive(skillId) {
  return `/ai-skills/${skillId}/archive`;
}
export function aiSkillTest(skillId) {
  return `/ai-skills/${skillId}/test`;
}
export function aiSkillSchemas() {
  return '/ai-skills/schemas';
}
export function aiSkillBudget() {
  return '/ai-skills/budget';
}

export function aiExpertiseList() {
  return '/ai-expertise';
}
export function aiExpertise(expertiseId) {
  return `/ai-expertise/${expertiseId}`;
}
export function aiExpertiseVersions(expertiseId) {
  return `/ai-expertise/${expertiseId}/versions`;
}
export function aiExpertiseVersion(expertiseId, n) {
  return `/ai-expertise/${expertiseId}/versions/${n}`;
}
export function aiExpertiseActivate(expertiseId, n) {
  return `/ai-expertise/${expertiseId}/versions/${n}/activate`;
}
export function aiExpertiseArchive(expertiseId) {
  return `/ai-expertise/${expertiseId}/archive`;
}

export function aiInvocations() {
  return '/ai-invocations';
}
export function aiInvocation(id) {
  return `/ai-invocations/${id}`;
}
