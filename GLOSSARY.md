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
A record, kept a year, of an action on an account's two-factor authentication, or of a company's MCP module opened or closed, its MCP access turned on or off, its retex allowed or stopped, a client registered by hand or deleted, named by its id and its name, or all its connections revoked: who did it, to whom, when.
_Avoid_: Audit log, activity log

### Image gallery

**Gallery**:
The images the editor offers for the image blocks of an email. Removing an image takes it out of the gallery, not out of storage, so the emails that use it keep it.
_UI_: Galerie
_Avoid_: Media library, image bank

**Mailing gallery**:
The gallery of one email: the images uploaded while designing it.
_UI_: Dans cet email
_Avoid_: Email images, local gallery

**Template gallery**:
The gallery of one template, shared by every email made from it.
_UI_: Galerie du template
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

### Mailings

**Mailing status**:
A label derived from a mailing's facts (approval, planned send date, ESP push), recomputed on every read and never stored: the first that applies of pushed to ESP, scheduled, approved and draft. Only a person changes it, by approving, planning or pushing; the planned day passing changes nothing. LePatron never knows that a mailing was sent, so no status says so.
_UI_: Statut
_Avoid_: Workflow state, sent

**Pushed to ESP**:
A mailing from which a campaign or a template was created in at least one ESP profile. It says nothing about delivery.
_UI_: Poussé vers l'ESP
_Avoid_: Sent, exported (a ZIP download is also called an export)

**Scheduled**:
An approved mailing with a planned send date, whichever day it is, not pushed to an ESP. It says nothing about delivery either.
_Avoid_: Planned (a draft may be planned too), sent

**Approved**:
A mailing whose latest top-level comment, not deleted, is an approval: any comment posted after it withdraws it, a reply does not. As a status, an approved mailing with no planned send date, not pushed to an ESP.
_UI_: Approuvé
_Avoid_: Validated

**Draft mailing**:
A mailing not approved yet, with a planned send date or not, and not pushed to an ESP. Draft is a status of the mailing itself, whereas a draft version is a version of a skill or an expertise kept apart from the one in use.
_Avoid_: Unapproved, pending

**Planned send date**:
The day a mailing is planned to be sent, without a time, the same day in every time zone. The editor stores it at noon UTC, and an assistant reads it as the day alone.
_UI_: Date d'envoi prévue
_Avoid_: Send time, scheduled date

### Skills and expertises

**Expertise**:
A piece of email know-how the platform company writes, in Markdown and versioned, that a feature, a skill or an assistant reads before acting.
_UI_: Expertise
_Avoid_: Doctrine, knowledge base, guideline (a client's writing guidelines belong to its CRM governance)

**Feature skill**:
A skill a LePatron feature calls as a function: its input fills a template, its output follows a contract LePatron checks.
_UI_: Skill de fonctionnalité

**Task skill**:
A skill written as a procedure for an assistant, with the expertises it consumes in order, and no template or contract.
_UI_: Skill de tâche
_Avoid_: Workflow, playbook, recipe

**Audience**:
The companies that may use a skill or an expertise, in the editor as through an assistant: the platform company alone, while it is tried, or every company. A new one starts with the platform company.
_UI_: Audience
_Avoid_: Visibility, exposure, subscribers, scope (an expertise's scope is the part of an email it covers)

**Draft version**:
The open draft of a skill or an expertise: its latest version newer than the active one, not published yet, which no client is served outside the drafts mode and only a person publishes. It is a version kept apart from the one in use, whereas a draft mailing is a status of the mailing itself.
_UI_: Brouillon
_Avoid_: Pending version, unpublished version

**Drafts mode**:
A connection's mode in which an assistant is served the draft version of every skill and expertise that has one, and those never published, so that whoever may manage the platform tries them before publishing. It ends after four hours and at every new connection.
_Avoid_: Preview mode, test mode, sandbox

**CRM governance**:
A company's own rules for its emails, such as its brand charter and its writing guidelines, kept by the company rather than written as skills or expertises. A module to come.
_Avoid_: Client expertise, brand skill

**Skills export**:
A file that carries the active version of chosen skills and expertises from one LePatron instance to another, where each arrives as a draft to publish.
_UI_: Export de skills
_Avoid_: Backup (it holds no history), sync (nothing happens on its own), package

**Copy**:
A LePatron instance (staging, development) whose skills and expertises follow production's, which is their only source. An item that came from production follows it in everything, its versions, audience and state, unless it is kept on the copy. What the copy wrote itself is never lost: the follow leaves an item written on the copy alone as long as production has none with its identifier, and sets the copy's work aside in a new item rather than overwrite it.
_UI_: Copie
_Avoid_: Mirror (a copy keeps its own items), replica, sync target, sync (the concept is the copy, the act is following)

**Kept on this copy**:
Said of an item of a copy that a super admin detached from production: the follow no longer touches it and only reports that production changed it. Following production again attaches it back.
_UI_: Gardé sur cette copie
_Avoid_: Frozen, pinned, local override

**Copy's work**:
An item of a copy holding, as a draft, what was written on the copy that the follow had to replace, or a version duplicated there to be tried. Its identifier is the original's with a suffix, its title the original's followed by "(travail de la copie)", and the follow never touches it.
_UI_: Travail de la copie
_Avoid_: Fork, backup, conflict copy

**Used by a feature**:
Said of an active skill or expertise that a LePatron feature calls or loads, as worked out from the features' own declarations, never set by hand. Publishing a new version of one replays its test cases first.
_UI_: Utilisé par une fonctionnalité
_Avoid_: Production-grade, locked, frozen

**Test case**:
An input a feature skill is checked against, kept with the skill's version, replayed before a change it depends on is published.
_UI_: Cas de test
_Avoid_: Golden run (the playground run that proves a case), unit test

### AI assistants

**Connected application**:
An AI assistant outside LePatron (Claude, ChatGPT, Copilot…) that a user has allowed to read LePatron on their behalf, with that user's rights, in one company. The user revokes it at any time; the company's tech admin or a super admin revokes all of the company's at once. A change of the user's credentials revokes all of theirs: the account deactivated, a new password, a two-factor reset.
_UI_: Application connectée
_Avoid_: Integration (the AI provider settings of a company), connector, client

**MCP module**:
What is sold to a company so that its users may connect applications: opened or closed by a super admin, like the other modules. Closed, the company's MCP access cannot be used, and its connected applications are revoked.
_UI_: Module MCP
_Avoid_: MCP subscription, MCP licence

**MCP access**:
The company's switch that lets its users connect applications, once the company has the MCP module. Off unless the company's tech admin or a super admin turns it on; opening the module does not turn it on.
_UI_: Accès MCP
_Avoid_: MCP subscription (MCP access is not what is sold)

**Connection**:
One consent of one user, in one company, through one connected application: what an access token opens, and what the rate limit counts first, before the user across their applications and the company. Connecting again opens another one, so two machines with the same application make two connections; past 10 of them for one application in one company, the oldest is revoked.
_UI_: Connexion d'assistant IA
_Avoid_: Session, link, integration

**Call log**:
The record of each call a connected application makes to LePatron: who, in which company, from which application, which tool, prompt or resource, the ids it named, how long it took and how it ended. Never what was typed nor what LePatron answered. Kept for the company's log retention.
_Avoid_: Audit log, activity log, trace (the security events are another record)

**Relayed image**:
An image of a mailing hosted outside the instance over https, that the instance fetches and serves itself so that the preview in an assistant shows it, through a signed address for that image only.
_UI_: Image relayée
_Avoid_: Proxied image, cached image (the instance keeps it a few minutes only, to spare a second fetch)

**Feedback**:
A rating and a comment a user sends from a connected application about what LePatron gave them. Both reach the platform company whatever the retex; it is kept for the company's log retention.
_UI_: Avis

**Retex**:
What a user's work taught about a skill or an expertise, recorded on its own from a connected application: a divergence or a complement. Never a summary of the session: no divergence and nothing brought, no retex. A super admin's is recorded as soon as it occurs, and belongs to the platform company whatever company they connected to, which is kept as context; another user's needs the company's permission, which its tech admin or a super admin gives, and the user's approval of that retex.
_UI_: Retour d'expérience
_Avoid_: Feedback (a rating and a comment), telemetry, session log, session summary

**Divergence**:
A retex where the user decided otherwise than a passage of a skill or an expertise recommended: what it recommended, what the user decided, and why.
_UI_: Divergence
_Avoid_: Disagreement, error, bug

**Complement**:
A retex where the user brought what a skill or an expertise lacked for the case at hand, with where it comes from (experience, a source, a test). It may concern no existing skill or expertise, then a kind of know-how and a part of the email.
_UI_: Complément
_Avoid_: Suggestion, wish, request

**Passage**:
The part of a skill or an expertise a retex is about: a section of an expertise, by its anchor, or a short quotation of a skill.
_UI_: Passage
_Avoid_: Paragraph, rule (a rule belongs to the quality control)

**Addressed retex**:
A retex a published version took into account: the draft cites it, and it is marked addressed, with that skill or expertise and its version, when the version is published. A retex on one skill may be addressed by another, or by an expertise. A draft deleted before leaves it open.
_UI_: Pris en compte en <version>
_Avoid_: Done, fixed, applied

**Dismissed retex**:
A retex a super admin decided not to act on, with the reason. It stays readable and no longer counts towards a convergence.
_UI_: Écarté
_Avoid_: Rejected, closed, deleted

### Editor

**Template**:
The email model a company is given, built by the operator: its blocks, styles and defaults. Every mailing of the company starts from one.
_UI_: Template
_Avoid_: Wireframe (the code keeps `_wireframe`)

**Right panel**:
One of the three panels that take turns on the right of the editor, one open at a time: the comments, the quality panel ("Tester l'email") and the AI panel. They share one shell: header, close button, body, foot, empty, loading and error states.
_UI_: Commentaires, Tester l'email, Actions IA
_Avoid_: Drawer, sidebar, slidebar (in prose; the code keeps `.slidebar`)

**Left bar**:
The column on the left of the editor, under the top bar, with three tabs of two sub-tabs each: the blocks to add (the template's and the saved ones), the images (the email's gallery and the template's) and the settings (the content and the styles of the selected block, or of the email).
_UI_: Blocs, Images, Réglages
_Avoid_: Toolbox, sidebar (the code keeps `#main-toolbox`)

**Saved block**:
A block a user saved from an email, with its content, to add it again to the emails of the same template.
_UI_: Enregistrés ; bloc enregistré
_Avoid_: Custom block, personalized block (the code keeps `personalizedBlocks`)

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
_UI_: Actions IA
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
