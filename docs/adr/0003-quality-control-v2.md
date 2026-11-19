# The quality control judges only the client's edits, in the editor, and blocks nothing but tracking

- Status: proposed; superseded by ADR-0009 on blocking
- Date: 2026-10-07
- Epic: #1193 (quality settings, lot 8; the stack itself was planned on the Notion brief « Refonte QC v2 » and has no epic)

The quality control (QC) is a rule engine in the editor (`packages/editor/src/js/ext/quality/`). Each run exports the email once, parses it once, and hands every rule the same context. A rule never reads the view model. A finding is reported only when the faulty value comes from the client: a node of the export belongs to a block through the `id` of the block root, and anything outside a block is the template's frame. Values the client left at the template's default (sample image, `#toreplace` link) count as forgotten by the client, not as a fault of the template. No check understands the text, since clients write in many languages: a check may know language-specific tokens (the reply prefixes `subject` looks for), none interprets meaning, which is left to later AI checks. Nothing blocks the user, except the required tracking parameters, as before. That check is the one exception to the rule above: it reads the view model and runs before the export, until the lot 8 gate (#1222) makes blocking a property of any check.

Three decisions follow from the engine:

- **Fingerprints, not stored findings.** A finding is known by `rule|block|property|hash(faulty value)|rank`. "Ignore" stores only that fingerprint on the mailing (`qualityIgnores`, at most 500, the oldest giving way). An ignored finding comes back on its own once its content changes, and the server never runs or stores a check. The rank is positional: when an earlier identical finding of the same block disappears, the next one takes its rank, and an ignore stored on the old rank no longer matches anything.
- **The server measures, the editor judges.** The editor knows the template, so it decides which links and images are the client's. It sends them to `POST /api/mailings/:mailingId/quality/resources`. The server answers what it measured (link states, image weights as the export ships them, Web Risk and DNS blocklist hits) and keeps nothing but a short cache per company. Every request is bounded: SSRF guard on each hop, default ports, caps per run, per user and per process, and a daily Web Risk budget per company.
- **A share link shows the last saved version.** `GET /share/:token` serves the stored preview, sanitized and opened in a sandboxed iframe under a CSP without scripts, rather than a snapshot taken when the link was made. The token is looked up by its hash and kept encrypted with the platform key so that the editor can show it again. A company can turn sharing off (`enableShareLinks`, on by default): the setting is checked when a link is made and every time the page is served, and the page judges the company that owns the mailing now, so a transfer revokes the mailing's links. Turning sharing off suspends the links already shared, after a confirmation that says so: they open again if sharing is turned back on, until they expire. A single leaked link is closed from its email, where each link can be turned off.

## Considered Options

- **Judging the whole exported HTML**: rejected. It reports the template's own choices (structure, footer sizes, legal text), which the client cannot change.
- **Running every check on the server**: rejected. The server cannot tell the client's values from the template's without the editor's model, and fetching addresses is the only thing that needs it.
- **Blocking export on errors**: rejected. A blocked user works around the tool, and many findings are deliberate (an "Ignore" exists for them).
- **A snapshot per share link**: postponed. It is safer for the reader, but it stores one copy of the email per link. The trade-off is listed in the Notion page for the team.

## Consequences

- Thresholds and rules are hard-coded for now. Per-company configuration (turning a rule off, changing a severity or a threshold, ESP-specific syntax) is lot 8.
- The ESP merge-tag syntax lives in one module (`merge-tag-syntax.js`). Supporting a new ESP means editing it.
- Server-side limits and caches are per worker, on the resources route as on the share page (view limiter, sanitized-page cache): with several workers, a user gets that many times the documented runs. Only the Web Risk daily budget, the one limit that costs money, is shared through the database.
- The share page publishes the mailing's name, and its subject and preheader when the company writes them in LePatron: anyone holding the link reads them. The token travels in the URL: the application masks it in its own access logs, but the HTTP to HTTPS redirect and the host's proxy log the full URL. A link stays as secret as the places it is pasted in.
- A share link stays valid until it expires or is turned off, even if the email changes or is deleted (it then answers "not found"). There is no cascade on deletion.
