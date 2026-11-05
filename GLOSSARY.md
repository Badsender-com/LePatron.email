# LePatron.email

An email builder for marketing teams: each client company designs its emails in a shared editor, from templates it is given, and exports them to its sending platform.

## Language

### Organization

**Company**:
A client company: it owns users, workspaces, templates and ESP profiles. Users never understood "group"; the code keeps `Group` and `_company`.
_UI_: Entreprise
_Avoid_: Group, organization, account

**Platform company**:
The company of the operator running the platform. It is the home of the super admins and of the AI playground. An environment has at most one, flagged by a super admin when the platform is set up.
_UI_: Entreprise plateforme
_Avoid_: Platform group, Badsender company, admin company

**Selected company**:
The company a super admin is working in, chosen in the company selector and shared by the modules and the settings. Every other user's selected company is their own company.
_UI_: Entreprise sélectionnée
_Avoid_: Selected group, current company, active company

### Roles

**Regular user**:
A member of a company who designs emails in the workspaces they are given.
_UI_: Utilisateur

**Writer**:
A member of a company who edits the content of emails and declines them into variants, without touching their structure or style, creating or deleting one.
_UI_: Rédacteur

**Reviewer**:
A member of a company who reads, comments, approves, tests and exports emails, and changes none.
_UI_: Relecteur
_Avoid_: Validator, viewer

**Company admin**:
A member of a company who also administers that company: its users, workspaces and settings, apart from its technical settings.
_UI_: Administrateur de l'entreprise
_Avoid_: Group admin, owner

**Tech admin**:
A company admin who also administers the company's technical settings: integrations, AI features, content feeds and tracking.
_UI_: Admin technique
_Avoid_: Technical admin, integrator

**Super admin**:
A person operating the platform, with full rights on every company. A super admin belongs to the platform company and is an ordinary account otherwise.
_UI_: Super administrateur
_Avoid_: Admin, platform admin (in prose and UI text; the code keeps its `admin` guard and flag)

**Bootstrap account**:
The super admin account defined by the deployment configuration, outside the database. It creates the first super admin of an environment and is never listed, demoted or removed.
_Avoid_: Env admin, hardcoded admin, legacy admin

**Capability**:
One thing a role allows, anywhere it applies, such as deleting an email or managing a company's technical settings. A role is its list of capabilities; what it does not list, it cannot do.
_Avoid_: Permission, right (for this list; "rights" stays fine in prose)

### Sign-in

**Two-factor authentication**:
A second proof asked after the password, a code only the account's owner can get. A company requires it of all its members or of none; a super admin always has it.
_UI_: Double authentification
_Avoid_: 2FA, MFA (in UI text), two-step verification

**Verification method**:
How a member gets their verification codes: an authenticator app or an email. Each member has one, chosen when they set up two-factor authentication.
_UI_: Application d'authentification, Code par email

**Verification code**:
The short code a verification method gives, valid a few minutes.
_UI_: Code de vérification
_Avoid_: OTP, token, PIN

**Recovery code**:
One of the codes given once at setup, each standing in for a verification code a single time, for a member without their verification method at hand.
_UI_: Code de secours
_Avoid_: Backup code

**Trusted device**:
A browser a member chose to remember after a verification: for thirty days, signing in from it asks the password only, unless the sign-in is suspicious.
_UI_: Appareil de confiance
_Avoid_: Remembered device, known device

**Suspicious sign-in**:
A sign-in from a trusted device that asks the verification code all the same, because something about it does not match the device remembered.
_Avoid_: Risky login, unusual activity

**Two-factor reset**:
A tech admin or a super admin erasing a member's two-factor setup, trusted devices included, so that the member sets it up again at their next sign-in. Changing the address of a member whose method is the code by email does it too.
_UI_: Réinitialiser la double authentification
_Avoid_: Disable two-factor, remove two-factor

**Security event**:
A record, kept a year, of an action on an account's two-factor authentication: who did it, to whom, when.
_Avoid_: Audit log, activity log

### Image gallery

**Gallery**:
The images the editor offers for the image blocks of an email. Removing an image takes it out of the gallery, not out of storage, so the emails that use it keep it.
_UI_: Galerie
_Avoid_: Media library, image bank

**Mailing gallery**:
The gallery of one email: the images uploaded while designing it.
_UI_: Spécifique à l'email
_Avoid_: Email images, local gallery

**Template gallery**:
The gallery of one template, shared by every email made from it.
_UI_: Commun au template
_Avoid_: Shared gallery, common gallery

**Stored name**:
The name a gallery image is stored and addressed under, derived from its content. It never changes, and every email that uses the image points at it.
_Avoid_: File name, image id, hash

**Label**:
The name of a gallery image as users read, search and rename it. An upload starts with the name of the file the user sent; renaming changes the label, never the stored name.
_UI_: Libellé
_Avoid_: Title, file name, original name

**Numbered copy**:
The new gallery image that editing an image produces, labelled after it with the next free number of its series (`photo (2).png`). The original is never replaced.
_Avoid_: Version, revision, edited image

### Email listing

**Workspace**:
A place of a company where its emails are designed, whose members it lists. It holds emails and folders.
_UI_: Espace de travail

**Folder**:
A place inside a workspace that holds emails. A folder may hold subfolders, which hold emails but no folders.
_UI_: Dossier
_Avoid_: Directory

**Location**:
The workspace or folder an email sits in, shown from the workspace down: workspace, folder, subfolder. An email has exactly one.
_UI_: Emplacement
_Avoid_: Parent, path (for the place itself)

**Accessible workspace**:
A workspace whose emails a user may read: one they are a member of, every workspace of their company for a company admin or when the company opens all workspaces to its users, and every workspace of the selected company for a super admin.
_Avoid_: Allowed workspace, my workspace

**Search scope**:
What the email search looks through: the emails sitting directly in the current location, or every email of the user's accessible workspaces, in any folder.
_UI_: Dossier courant, Tous mes espaces de travail
_Avoid_: Search mode, global search (in UI text)

### Editor

**Template**:
The email model a company is given, built by the operator: its blocks, styles and defaults. Every mailing of the company starts from one.
_UI_: Template
_Avoid_: Wireframe (the code keeps `_wireframe`)

**Right panel**:
One of the three panels that take turns on the right of the editor, one open at a time: the comments, the quality panel ("Tester l'email") and the AI panel. They share one shell: header, close button, body, foot, empty, loading and error states.
_UI_: Commentaires, Tester l'email, Outils IA
_Avoid_: Drawer, sidebar, slidebar (in prose; the code keeps `.slidebar`)

**Panel rail**:
The vertical strip on the right edge of the editor, below the top bar, holding the button of each right panel and its badge.
_Avoid_: Toolbar, dock

**Comment markers rail**:
The column beside the email, in the canvas, with a marker on each block that has unresolved comments.
_Avoid_: Panel rail (the rail of the panel buttons)

### Comments

**Comment**:
A remark posted on an email, on the whole email or on one of its blocks, with a type and a priority; it is resolved once dealt with. A reply belongs to a root comment and has no type, priority or reply of its own.
_UI_: Commentaire
_Avoid_: Note, annotation

**Comment target**:
What a new comment is about: the whole email or one block. It follows the selection in the canvas until the user changes it, and is distinct from the filter of the list, which only reads.
_UI_: « Sur : Tout l'email », « Sur : <bloc> »
_Avoid_: Selected block, filter

**Blocking comment**:
A root comment of priority "blocking", not resolved. While one is open, the email cannot be approved. Not to be confused with a blocking rule of the quality control (see Check state), which stops the export.
_UI_: Bloquant

**Approval**:
The event by which someone allowed to approve says an email may be sent. It shows in the thread of comments but is not a comment to resolve: it has no type, priority or block, and counts in no counter of unresolved comments. Its author, or a moderator of the comments, withdraws it by deleting it; editing the email does not withdraw it.
_UI_: « Approuver l'email » ; « Bon pour envoi »
_Avoid_: Validation (for the event), sign-off

**Approved email**:
An email whose last root comment is an approval and that has no blocking comment open. A new root comment lifts it, even once resolved: only deleting that comment restores the approval.
_UI_: Validé
_Avoid_: Validated, signed off

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
A public URL that shows the last saved version of an email to someone without an account, for 1, 7 or 30 days. Created from the "Send a test" tab of the quality panel by anyone who can send a test of the email (a reviewer included), when the email's company allows it. Revoked by hand from the email, by expiry, or when the mailing changes company. Suspended while the company has sharing turned off.
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

**Ready email**:
An email whose quality run went through every check and left no error and no warning unignored; an info counts only if it is blocking. Ready or not, only blocking findings stop the download and the ESP send.
_UI_: Prêt ; « Prêt à partir »
_Avoid_: Cleared, passed, valid

### AI

**AI feature**:
A capability of the product that relies on an AI provider, enabled per company with its own integration and model (translation, text generation).
_UI_: Fonctionnalité IA
_Avoid_: Feature config, AI module

**Text generation**:
The AI feature that writes or corrects the text of an email for the user to accept: proposals to pick from (the subject, the preheader) or corrections to accept one by one.
_UI_: Génération de texte
_Avoid_: Textgen, copywriting, AI writing

**AI action**:
What the user triggers to have AI work on a target — the whole email, a block or a field —, from the AI panel or from the AI icon of that target; it relies on an AI feature and may chain several invocations.
_UI_: Action IA
_Avoid_: AI tool, AI command, prompt

**AI panel**:
The right-hand panel where the user picks an AI action, gives its options and instruction, and chooses among its proposals; it shares its place with the comments and the quality control panels, one open at a time.
_UI_: Outils IA
_Avoid_: AI sidebar, AI drawer, assistant

**Skill**:
A versioned prompt, written by Badsender consultants, that turns one input into one output; it never fetches context and never calls another skill.
_UI_: Skill
_Avoid_: Prompt, agent

**Expertise**:
A piece of Badsender know-how in structured Markdown, split into sections, that a skill reads as part of its input; either transversal or tied to one kind of content (its scope).
_UI_: Expertise
_Avoid_: Knowledge base, doctrine, guideline

**Scope**:
The kind of content an expertise is about (subject, preheader, call to action…); a transversal expertise has none and applies to every kind.
_Avoid_: Category, perimeter

**Invocation**:
One call of one skill with one input; the unit of logging, cost and traceability. An AI feature may make several invocations, chained in its own code.
_Avoid_: Run, execution, request

**Proposal**:
One piece of text an AI feature offers the user, who picks it or not; nothing is written into the email until the user picks.
_UI_: Proposition
_Avoid_: Suggestion, variant, generation

**Correction**:
One localized change to the spelling, grammar or typography of a text, with the text before, the text after and the reason; the user accepts it or ignores it, and nothing is written until they accept. Never a change of style or meaning.
_UI_: Correction
_Avoid_: Suggestion, fix, mistake

### Email

**Subject**:
The subject line of an email, edited in the email's metadata when the company uses them; otherwise it lives in the ESP.
_UI_: Objet
_Avoid_: Title, object

**Preheader**:
The hidden preview text shown after the subject in the inbox, declared by the template.
_UI_: Préheader
_Avoid_: Preview text, pre-header, view-online banner
