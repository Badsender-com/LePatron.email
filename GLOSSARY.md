# LePatron.email

An email builder for marketing teams: each client company designs its emails in a shared editor, from templates it is given, and exports them to its sending platform.

## Language

### Organization

**Company**:
A client of the platform: it owns users, workspaces, templates and ESP profiles. The word appears in the super admin's views only (the list of companies, the company picker, a company's badge); a company admin never sees it. The code keeps its older name: the `Group` model, `groupId` and the `_company` field.
_UI_: Entreprise
_Avoid_: Group, groupe, organization, account (in prose and UI text)

**Platform company**:
The company of the operator running the platform. It is the home of the super admins and of the AI playground. An environment has at most one, flagged by a super admin when the platform is set up.
_Avoid_: Badsender company, admin group

### Roles

**Regular user**:
A member of a company who designs emails in the workspaces they are given.
_UI_: Utilisateur

**Company admin**:
A member of a company who also administers that company: its users, workspaces, templates, settings and profiles.
_UI_: Administrateur de l'entreprise
_Avoid_: Group admin, owner

**Super admin**:
A person operating the platform, with full rights on every company. A super admin belongs to the platform company and is an ordinary account otherwise.
_UI_: Super administrateur
_Avoid_: Admin, platform admin (in prose and UI text; the code keeps its `admin` guard and flag)

**Bootstrap account**:
The super admin account defined by the deployment configuration, outside the database. It creates the first super admin of an environment and is never listed, demoted or removed.
_Avoid_: Env admin, hardcoded admin, legacy admin

### Editor

**Template**:
The email model a company is given, built by the operator: its blocks, styles and defaults. Every mailing of the company starts from one.
_UI_: Template
_Avoid_: Wireframe (the code keeps `_wireframe`)

### Quality control

**Quality run**:
One execution of the quality control on an email: one HTML export, parsed once, every rule run on the same context. Started from the quality panel, or by a download or an ESP send on the HTML they export.
_UI_: Contrôle qualité
_Avoid_: Scan, audit

**Rule**:
One check the quality control knows, in `ext/quality/rules/`: an id, a category, a default severity, a title and a "passed" message. A local rule runs in the browser on the export; a remote rule judges what the server measured (link states, image weights, threat lists); an optional rule is listed only when the platform is configured for it.
_UI_: Contrôle

**Check**:
The outcome of one rule in a quality run: passed, failed (with findings), or not run (the rule failed or was cancelled). A rule with nothing to judge in this email is not listed.
_Avoid_: Test

**Finding**:
One problem a rule reports: a message, a severity (error, warning, info), a category, the block it belongs to, and a fingerprint.
_UI_: Résultat
_Avoid_: Issue, alert, warning (a warning is one severity)

**Fingerprint**:
What identifies a finding across quality runs without storing it: `rule|block|property|hash(faulty value)|rank`. It changes when the faulty value changes, and only then.
_UI_: Empreinte

**Client's edit**:
What the quality control judges: what the client put in the blocks of the email. The template's frame (header, footer, wrapper outside blocks) is never judged; a value left at the template's default (sample image, placeholder link) counts as forgotten by the client.
_Avoid_: User content

**Resources**:
The links and images of the client's blocks that the editor sends to the server for it to measure. The server measures and answers; it never judges and never stores.

**Ignore**:
Hide a finding for the whole team, by fingerprint, until its content changes. Stored on the mailing, never copied with it. A finding of a blocking rule cannot be ignored.
_UI_: Ignorer
_Avoid_: Dismiss, mute

**Share link**:
A public URL that shows the last saved version of an email to someone without an account, for 1, 7 or 30 days. Created from the "Send a test" tab of the quality panel by anyone who can edit the email, when the email's company allows it. Revoked by hand from the email, by expiry, or when the mailing changes company. Suspended while the company has sharing turned off.
_UI_: Lien d'aperçu
_Avoid_: Public link, preview URL

**Required tracking parameters**:
Configured per company in its tracking settings. The rule that checks them is blocking by default; with the quality settings, a company can set it off, on or blocking like any other.
_UI_: Paramètres de tracking obligatoires

**Check state**:
How a rule applies to a company or a template: off, it does not run and is not listed; on, its findings warn; blocking, any of its findings stops the download and the ESP send. In the quality settings and their catalogue (`CHECKS`), the code calls a rule a "check".
_UI_: Désactivé, Actif, Bloquant

**Threshold**:
A limit a rule compares an email with, such as the length of a subject or the weight of an image. Set within bounds by the quality settings.
_UI_: Seuil
_Avoid_: Limit, setting

**Quality settings**:
The state and thresholds of every rule for a company. A template overrides them one by one; whatever it does not set is inherited from its company.
_UI_: Réglages du contrôle qualité
_Avoid_: QC config, quality configuration

**Recommended values**:
The state and thresholds of a rule when nothing is set: the catalogue's. They cannot be changed.
_UI_: Valeurs recommandées ; « Recommandé : 40 »
_Avoid_: Default (in UI text)

**Exception**:
A rule whose state or thresholds a company or a template sets differently from what applies below it. The company's exceptions are its **general settings**, for all its templates; a template's own exceptions apply over them, for that template only. The settings page lists exceptions only, and names neither a company nor a group: its readers are the company's admins.
_UI_: Exception ; Réglages généraux ; Exception propre à ce template ; « Réglage général : … »
_Avoid_: Override, surcharge, Hérité du groupe, Propre au template
