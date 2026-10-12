# Glossary

Vocabulary of the domain, as the code uses it. One term, one meaning. English, like the code; the French label used in the interface follows in parentheses when it differs.

## Quality control (contrôle qualité)

- **Quality run** (passage de contrôle): one execution of the quality control on an email: one HTML export, parsed once, every rule run on the same context. Started from the panel, or by a download or an ESP send on the HTML they export.
- **Rule** (règle, contrôle): one file in `ext/quality/rules/`, with an id, a category, a default severity, a title and a "passed" message. A **local rule** runs in the browser on the export; a **remote rule** judges what the server measured (link states, image weights, threat lists). An **optional rule** is listed only when the platform is configured for it (Web Risk key, DNS blocklists).
- **Check** (contrôle): the outcome of one rule in a run: `passed`, `failed` (with findings) or `error` (the rule could not run). A rule that has nothing to judge in this email is not listed (`enabled`).
- **Finding** (résultat): one problem reported by a rule: message, severity (`error`, `warning`, `info`), category, the block it belongs to, the faulty value, and a fingerprint.
- **Fingerprint** (empreinte): `rule|block|property|hash(faulty value)|rank`. It identifies a finding across runs without storing it. "Ignore" stores fingerprints on the mailing (`qualityIgnores`); a finding whose value changes gets a new fingerprint and comes back.
- **Client's edit** (édition du client): what the quality control judges. A node of the export belongs to a block through the id of the block root; the template's frame (header, footer, wrapper outside blocks) is never judged. A value left at the template's default (sample image, `#toreplace` link) counts as forgotten by the client.
- **Resources** (ressources): the links and images of the client's blocks that the editor sends to `POST /api/mailings/:mailingId/quality/resources` for the server to measure. The server measures and answers; it never judges and never stores.
- **Ignore** (ignorer): hide a finding for the whole team, by fingerprint, until its content changes. Stored on the mailing, never copied with it.
- **Share link** (lien d'aperçu, lien de partage): a public URL `/share/<token>` that shows the last saved version of an email to someone without an account, for 1, 7 or 30 days. Created from the "Send a test" tab of the quality panel by anyone who can edit the email, when the company allows it (`enableShareLinks`). Revoked by hand, by expiry, or when the mailing changes company.
- **Required tracking parameters** (paramètres de tracking obligatoires): the only check that blocks a download or an ESP send today. Configured per company; becomes one blocking check among others with the quality settings (lot 8).
