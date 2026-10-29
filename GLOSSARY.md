# LePatron.email

An email builder for marketing teams: each client company designs its emails in a shared editor, from templates it is given, and exports them to its sending platform.

## Language

### Organization

**Company**:
A client company: it owns users, workspaces, templates and ESP profiles. Users never understood "group"; the code keeps `Group` and `_company`.
_UI_: Entreprise
_Avoid_: Group, organization, account

**Platform group**:
The group of the operator running the platform. It is the home of the super admins and of the AI playground. An environment has at most one, flagged by a super admin when the platform is set up.
_Avoid_: Badsender group, admin group

**Selected group**:
The group a super admin is working in, chosen in the group selector and shared by the modules and the settings. Every other user's selected group is their own group.
_UI_: Groupe
_Avoid_: Current company, active group, working group

### Roles

**Regular user**:
A member of a group who designs emails in the workspaces they are given.
_UI_: Utilisateur

**Writer**:
A member of a group who edits the content of emails and declines them into variants, without touching their structure or style, creating or deleting one.
_UI_: Rédacteur

**Reviewer**:
A member of a group who reads, comments, approves, tests and exports emails, and changes none.
_UI_: Relecteur
_Avoid_: Validator, viewer

**Company admin**:
A member of a group who also administers that group: its users, workspaces and settings, apart from its technical settings.
_UI_: Administrateur du groupe
_Avoid_: Group admin, owner

**Tech admin**:
A company admin who also administers the group's technical settings: integrations, AI features, content feeds and tracking.
_UI_: Admin technique
_Avoid_: Technical admin, integrator

**Super admin**:
A person operating the platform, with full rights on every group. A super admin belongs to the platform group and is an ordinary account otherwise.
_UI_: Super administrateur
_Avoid_: Admin, platform admin (in prose and UI text; the code keeps its `admin` guard and flag)

**Bootstrap account**:
The super admin account defined by the deployment configuration, outside the database. It creates the first super admin of an environment and is never listed, demoted or removed.
_Avoid_: Env admin, hardcoded admin, legacy admin

**Capability**:
One thing a role allows, anywhere it applies, such as deleting an email or managing a group's technical settings. A role is its list of capabilities; what it does not list, it cannot do.
_Avoid_: Permission, right (for this list; "rights" stays fine in prose)

### Sign-in

**Two-factor authentication**:
A second proof asked after the password, a code only the account's owner can get. A group requires it of all its members or of none; a super admin always has it.
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
A place of a group where its emails are designed, whose members it lists. It holds emails and folders.
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
A workspace whose emails a user may read: one they are a member of, every workspace of their group for a company admin or when the group opens all workspaces to its users, and every workspace of the selected group for a super admin.
_Avoid_: Allowed workspace, my workspace

**Search scope**:
What the email search looks through: the emails sitting directly in the current location, or every email of the user's accessible workspaces, in any folder.
_UI_: Dossier courant, Tous mes espaces de travail
_Avoid_: Search mode, global search (in UI text)

### Taxonomy

**Dimension**:
An axis a company declines its emails by: what an email brings, the markets it is sent to, the brand speaking, the audience it addresses. Its name is what a template reads, and it never changes.
_UI_: Dimension
_Avoid_: Axis, criterion, variant, taxonomy type

**Standard dimension**:
A dimension every company has, defined by the Badsender classification doctrine: the email type and the email trigger. A company can neither remove nor rename one.
_UI_: Standard

**Company dimension**:
A dimension a company declares for itself: market, language, brand, audience, or any other way it declines its emails.
_UI_: Propre à l'entreprise
_Avoid_: Custom dimension, group dimension

**Value**:
One of the possibilities of a dimension: Canada, French, Newsletter. An email carries at most one value per dimension.
_UI_: Valeur
_Avoid_: Item, entry, option, tag

**Email type**:
The standard dimension that says what an email brings to the person receiving it. Each company names its own values, and maps each onto one of the doctrine's six types.
_UI_: Typologie
_Avoid_: Category, campaign type

**Email trigger**:
The standard dimension that says whether someone decided this particular send: one shot or automated. Its two values are the doctrine's, and no company adds, renames or removes one.
_UI_: Déclenchement
_Avoid_: Send mode, scenario

**Identifier**:
The stable name of a value, which a template compares against, unlike its freely edited label.
_UI_: Identifiant
_Avoid_: Slug, code, key, canonical type

**Availability**:
The values of the parent dimension under which a value is offered: French is offered under Canada, Switzerland and Belgium, and nowhere else. A value with no availability is offered under all of them.
_UI_: Disponibilité
_Avoid_: Parent, hierarchy, dependency

**Design token**:
A named value that a value carries and a template reads under that name: a brand's main colour as a role, not as `#ffd845`.
_UI_: Token
_Avoid_: Variable, theme colour, palette entry

**Precedence**:
Which dimension wins when the values chosen for one email carry the same design token. Unrelated to the order dimensions are listed in.
_UI_: Priorité
_Avoid_: Order, weight
