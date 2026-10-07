# Each group sets the state and thresholds of its checks, a template overrides them one by one, and a check can block the export

- Status: proposed
- Date: 2026-10-08
- Epic: #1193

Groups do not all send the same emails: a fixed set of checks and thresholds either misses what one group cares about or buries another in warnings. Each check now has a state for a group (off, on, or blocking) and its thresholds, within bounds. A template overrides them setting by setting, and whatever it does not set follows the group, including the group's later changes. With nothing set, a group gets today's behavior: every check on, only the required tracking parameters blocking, today's thresholds. No data migration is needed. Super admins set every group; a company admin sets their own group and its templates.

Any check can be off, the required tracking parameters included, and any check can be blocking. This supersedes ADR-0003 on one point only: the quality control no longer "blocks nothing but tracking". A blocking check stops the download (and the FTP or CDN push) and the ESP send, never a test send or a share link. Any finding of a blocking check blocks, whatever its severity, and cannot be ignored. The editor shows what blocks in a modal, next to the quality drawer. It runs the checks before an ESP send, on the HTML about to leave, instead of after it.

A server-side check blocks only on a definitive answer: a page gone, a domain that does not exist, an image too heavy, a dangerous or listed link. "Unverifiable" and an unreachable server never block. The download waits for the server's answer.

The rule catalogue (check ids, thresholds with their default, minimum and maximum) lives in `packages/shared/quality/`. The editor and the server read it, so a setting the server accepts is always one the editor knows.

## Considered Options

- **Blocking enforced on the server for every check**: rejected for now. The server would have to run the editor's rule engine on the exported HTML. The editor enforces blocking; the server keeps checking only the required tracking parameters, as before, and only when that check is on and blocking. A direct call to the API therefore bypasses every other blocking check.
- **A template replacing the group's settings as a whole** (the `trackingConfig` override): rejected. A template usually changes one or two values, and a whole copy would stop following the group's later changes.
- **Changing a check's severity, and ESP-specific merge-tag syntax**: out of this feature. The syntax waits for an audit of the ESPs' syntaxes. A mailing does not know its ESP before it is sent.

## Consequences

- An ignored finding of a check that becomes blocking counts again: blocking findings cannot be ignored.
- Messages show the threshold in force, so thresholds move out of the translation keys into their parameters.
- A check that is off is neither run nor listed. The drawer says how many checks the group or the template turned off.
