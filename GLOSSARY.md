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
A LePatron instance (staging, development) whose skills and expertises follow production's, which is their only source. A copy keeps what exists only on it.
_UI_: Copie
_Avoid_: Mirror (a copy keeps its own items), replica, sync target

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

**Feedback**:
A rating and a comment a user sends from a connected application about what LePatron gave them. Both reach the platform company whatever the retex; it is kept for the company's log retention.
_UI_: Avis

**Retex**:
The summary of an assistant session, attached to a feedback, so the platform company can improve its expertises, skills and features. Kept only when the company allows it, which its tech admin or a super admin decides, and the user agrees to it for that feedback. Stopping it forgets the summaries already kept.
_UI_: Retour d'expérience
_Avoid_: Telemetry, session log
