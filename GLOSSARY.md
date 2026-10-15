# LePatron.email

An email builder for marketing teams: each client company designs its emails in a shared editor, from templates it is given, and exports them to its sending platform.

## Language

### Organization

**Group**:
A client company: it owns users, workspaces, templates and ESP profiles.
_UI_: Groupe
_Avoid_: Company, organization, account

**Platform group**:
The group of the operator running the platform. It is the home of the super admins and of the AI playground. An environment has at most one, flagged by a super admin when the platform is set up.
_Avoid_: Badsender group, admin group

### Roles

**Regular user**:
A member of a group who designs emails in the workspaces they are given.
_UI_: Utilisateur

**Company admin**:
A member of a group who also administers that group: its users, workspaces, templates, settings and profiles.
_UI_: Administrateur du groupe
_Avoid_: Group admin, owner

**Super admin**:
A person operating the platform, with full rights on every group. A super admin belongs to the platform group and is an ordinary account otherwise.
_UI_: Super administrateur
_Avoid_: Admin, platform admin (in prose and UI text; the code keeps its `admin` guard and flag)

**Bootstrap account**:
The super admin account defined by the deployment configuration, outside the database. It creates the first super admin of an environment and is never listed, demoted or removed.
_Avoid_: Env admin, hardcoded admin, legacy admin

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
Hide a finding for the whole team, by fingerprint, until its content changes. Stored on the mailing, never copied with it.
_UI_: Ignorer
_Avoid_: Dismiss, mute

**Share link**:
A public URL that shows the last saved version of an email to someone without an account, for 1, 7 or 30 days. Created from the "Send a test" tab of the quality panel by anyone who can edit the email, when the email's group allows it. Revoked by hand from the email, by expiry, or when the mailing changes group. Suspended while the group has sharing turned off.
_UI_: Lien d'aperçu
_Avoid_: Public link, preview URL

**Required tracking parameters**:
The only check that blocks a download or an ESP send today. Configured per group; becomes one blocking check among others with the quality settings.
_UI_: Paramètres de tracking obligatoires
