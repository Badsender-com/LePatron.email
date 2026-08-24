// How a skill output becomes displayable Markdown.
//
// This is a skill OUTPUT CONVENTION, not a display detail: a skill whose output
// schema exposes `text` (or `markdown`) means that field to be the rendered
// answer, and anything else is inspected as JSON. It therefore belongs in one
// place — it was copied verbatim into three components, so a fourth output
// convention would have had to be added three times, or two of them would have
// drifted.

/**
 * @param {*} output — a run's `output`: a string, an object, or null.
 * @returns {string} Markdown, ready for the renderer. '' when there is nothing.
 */
export default function runOutputAsMarkdown(output) {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  if (typeof output.text === 'string') return output.text;
  if (typeof output.markdown === 'string') return output.markdown;
  // No conventional text field: show the structure rather than pretend.
  return '```json\n' + JSON.stringify(output, null, 2) + '\n```';
}
