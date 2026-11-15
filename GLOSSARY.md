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

**Synthetic block**:
A block the editor injects into every template's palette rather than finding in the template's own markup. There are two, and one shared mechanism carries both.
_Avoid_: Virtual block, injected block

**HTML code block**:
The synthetic block whose content is markup the user pastes. LePatron does not own that markup.
_UI_: Bloc Code HTML

**Composed block**:
The synthetic block whose content is assembled in the Block Builder. LePatron owns the markup it ships, and regenerates it from the composition.
_UI_: Composer un bloc
_Avoid_: Builder block, custom block, personalized block

**Template block**:
A block a template provides, defined in the template's own markup. The counterpart of a composed block: one is received, the other assembled.
_UI_: Blocs du modèle
_Avoid_: Native block, standard block

**Saved block**:
A block promoted into a block library, whatever its origin: a template block whose settings were kept, or a composed block. Saving is a state, not a kind — a saved composed block is still a composed block, and still reopens in the Block Builder.
_UI_: Blocs enregistrés
_Avoid_: Personalized block (in UI text), bloc perso

**Block library**:
The saved blocks of one group, under one template. A block saved under a template is never offered under another.
_UI_: Bibliothèque de blocs

**Block Builder**:
The tool a composed block is assembled in: a palette, a composition area and a settings panel.
_UI_: Composer un bloc

**Composition**:
What a composed block holds, as stored: the rows, their columns, the elements inside them, and the block's own styling. Read and written as a serialised string.

**Row**:
One horizontal band of a composition, holding one to four columns. A composition is a list of rows; a row is not addressable by Mosaico, only from inside the Block Builder.
_UI_: Ligne

**Column**:
One cell of a row, carrying a width in percent and a list of elements. A column keeps its cell in the export even when it holds nothing, so the layout does not collapse.
_UI_: Colonne

**Element**:
The smallest thing a user places in a column: text, image, button, divider or spacer.
_UI_: Élément
_Avoid_: Component, widget, module

**Preset**:
A named set of column widths offered in the panel (1, 2×50, 66/33, 33/66, 3×33, 4×25). A shortcut for writing widths, never stored as such.
_UI_: Structure

### Generation

**Slot**:
A hole in a compiled element template, declaring the escaping context its value goes through. A value cannot reach the markup without passing one.

**Escaping context**:
What a slot declares about where its value lands — text, attribute, URL, colour, pixels, CSS value, rich text, or markup. It carries the escaping, so escaping is a property of the slot rather than the author's vigilance.

**Generated CSS**:
The stylesheet derived from a composition at export time, for the rules that cannot be inlined. Never stored: it is recomputed wherever the composition is rendered.

**Head CSS**:
The stylesheet an author writes by hand for an email, injected into the exported document's `<head>`.
_UI_: CSS personnalisé
