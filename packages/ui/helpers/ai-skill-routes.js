// API route helpers for the LePatron Skills IA module.
// Prefix is added by axios (/api).

function versionLabel(major, minor) {
  return `${major}.${minor == null ? 0 : minor}`;
}

export function aiSkills() {
  return '/ai-skills';
}
export function aiSkill(skillId) {
  return `/ai-skills/${skillId}`;
}
export function aiSkillVersionMinor(skillId) {
  return `/ai-skills/${skillId}/versions/minor`;
}
export function aiSkillVersionMajor(skillId) {
  return `/ai-skills/${skillId}/versions/major`;
}
export function aiSkillVersion(skillId, major, minor) {
  return `/ai-skills/${skillId}/versions/${versionLabel(major, minor)}`;
}
export function aiSkillActivate(skillId, major, minor) {
  return `/ai-skills/${skillId}/versions/${versionLabel(
    major,
    minor
  )}/activate`;
}
export function aiSkillArchive(skillId) {
  return `/ai-skills/${skillId}/archive`;
}
export function aiSkillSchemas() {
  return '/ai-skills/schemas';
}

export function aiExpertiseList() {
  return '/ai-expertise';
}
export function aiExpertise(expertiseId) {
  return `/ai-expertise/${expertiseId}`;
}
export function aiExpertiseActivationImpact(expertiseId) {
  return `/ai-expertise/${expertiseId}/activation-impact`;
}
export function aiExpertiseVersionMinor(expertiseId) {
  return `/ai-expertise/${expertiseId}/versions/minor`;
}
export function aiExpertiseVersionMajor(expertiseId) {
  return `/ai-expertise/${expertiseId}/versions/major`;
}
export function aiExpertiseVersion(expertiseId, major, minor) {
  return `/ai-expertise/${expertiseId}/versions/${versionLabel(major, minor)}`;
}
export function aiExpertiseActivate(expertiseId, major, minor) {
  return `/ai-expertise/${expertiseId}/versions/${versionLabel(
    major,
    minor
  )}/activate`;
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
