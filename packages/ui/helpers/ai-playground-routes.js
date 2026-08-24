// API route helpers for the LePatron AI Playground module.
// Prefix is added by axios (/api).

export function aiPlaygroundScenarios() {
  return '/ai-playground/scenarios';
}
export function aiPlaygroundScenarioFacets() {
  return '/ai-playground/scenarios/facets';
}
export function aiPlaygroundScenario(scenarioId) {
  return `/ai-playground/scenarios/${scenarioId}`;
}
export function aiPlaygroundExecute(scenarioId) {
  return `/ai-playground/scenarios/${scenarioId}/execute`;
}
export function aiPlaygroundScenarioRuns(scenarioId) {
  return `/ai-playground/scenarios/${scenarioId}/runs`;
}
export function aiPlaygroundRun(runId) {
  return `/ai-playground/runs/${runId}`;
}
export function aiPlaygroundRunFeedback(runId) {
  return `/ai-playground/runs/${runId}/feedback`;
}
export function aiPlaygroundRunMarkGolden(runId) {
  return `/ai-playground/runs/${runId}/mark-golden`;
}
export function aiPlaygroundRunUnmarkGolden(runId) {
  return `/ai-playground/runs/${runId}/unmark-golden`;
}
export function aiPlaygroundPreviewExpertiseFilter() {
  return '/ai-playground/preview-expertise-filter';
}
