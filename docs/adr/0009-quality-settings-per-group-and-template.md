# Each company sets the state and thresholds of its rules, a template overrides them one by one, and a rule can block the export on its most severe level

- Status: proposed
- Date: 2026-10-08, amended 2026-11-18
- Epic: #1193

Companies do not all send the same emails: a fixed set of rules and thresholds either misses what one company cares about or buries another in warnings. Each rule now has a state for a company (off, on, or blocking) and its thresholds, within bounds. A template overrides them setting by setting, and whatever it does not set follows the company, including the company's later changes. When a later change of the company puts a template's value and an inherited one of a pair out of order (a warning level above its error level), the template's value wins: the inherited one is brought to it, so a template that warns at 50 characters still warns at 50. With nothing set, a company gets today's behavior: every rule on, only the required tracking parameters blocking, today's thresholds. No data migration is needed. Super admins set every company; a company admin sets their own company and its templates. The code calls a rule a "check" in the settings and their catalogue (`CHECKS`, `checkStateOf`); this record says rule, as the glossary does.

Any rule can be off, the required tracking parameters included, and any rule can be blocking. This supersedes ADR-0003 on one point only: the quality control no longer "blocks nothing but tracking". A blocking rule stops the download (and the FTP or CDN push) and the ESP send, never a test send or a share link.

A blocking rule blocks only on its most severe level, the highest severity it can report: the subject blocks past its "too long" threshold, the total image weight past its error threshold, and a rule with a single level blocks on all its findings. Its lower levels stay findings that never block: a long subject is often a choice, and ADR-0003 rejected blocking because many findings are deliberate. A finding that blocks cannot be ignored. The editor shows what blocks in a modal, next to the quality drawer. It runs the rules before an ESP send, on the HTML about to leave, instead of after it.

A server-side rule blocks only on a definitive answer: a page gone, a domain that does not exist, an image too heavy, a dangerous or listed link. "Unverifiable" never blocks. An export waits for the server's answer about 30 seconds at most; the server stops its own run at 20 seconds. When the wait runs out, the user's quota is reached (20 runs per 10 minutes) or the server fails, the server's rules do not block the export, but the user sees a notice that the links and images could not be checked, at the download and before the ESP send. While the export waits, a "Cancel" button abandons it: nothing leaves. There is never a "download anyway".

Blocking on the most severe level only, the ignores of the lower levels that still hold, the wait of 30 seconds at most, the "Cancel" button and the notice that the links and images could not be checked are implemented by the blocking batch (PRs #1222 and #1224).

The rule catalogue (rule ids, thresholds with their default, minimum and maximum) lives in `packages/shared/quality/`. The editor and the server read it, so a setting the server accepts is always one the editor knows.

The download of several mailings at once, from the mailing list, is work still to do, not an accepted bypass. It ships their saved previews without running the rules; only the server's re-check of the required tracking parameters applies. While it does, the epic's goal, never letting an email with an unfilled link leave the platform, is not met. Issue #1629 closes it: on save, the editor records on the mailing whether blocking findings remain; the bulk download refuses the mailings that have some or were never checked, in a modal that lists them, and treats a mailing whose settings changed after its save as to check again. Until then, the quality settings page says that blocking applies to the download and the ESP send from the editor.

## Considered Options

- **Blocking enforced on the server for every rule**: rejected for now. The server would have to run the editor's rule engine on the exported HTML. The editor enforces blocking; the server keeps checking only the required tracking parameters, as before, and only when that rule is on and blocking. A direct call to the API therefore bypasses every other blocking rule: an accepted limit.
- **Every finding of a blocking rule blocking, whatever its severity** (the first version of this record): rejected. A lower level warns about what is often a choice, and a user blocked on a deliberate choice works around the tool.
- **Waiting for the server without a bound, or a "download anyway" button**: rejected. A slow server would hold the export indefinitely, and a way past the wait would become the usual one. A bounded wait with a visible notice keeps the export moving and says what was not checked.
- **A template replacing the company's settings as a whole** (the `trackingConfig` override): rejected. A template usually changes one or two values, and a whole copy would stop following the company's later changes.
- **Changing a rule's severity, and ESP-specific merge-tag syntax**: out of this feature. The syntax waits for an audit of the ESPs' syntaxes. A mailing does not know its ESP before it is sent.

## Consequences

- An ignored finding at the most severe level of a rule that becomes blocking counts again: a finding that blocks cannot be ignored. The ignores of its lower levels still hold.
- Messages show the threshold in force, so thresholds move out of the translation keys into their parameters.
- A rule that is off is neither run nor listed. The drawer says how many rules the company or the template turned off.
- An unreachable or overloaded server never stops an export: links and images the server could not check leave with a notice, not a block.
