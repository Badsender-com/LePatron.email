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

**Check**:
One verification the quality control runs on a mailing, such as "Links" or "Font size".
_UI_: Contrôle
_Avoid_: Test, rule (in prose and UI text; the code keeps its `rules`)

**Finding**:
What a check reports about one place of a mailing, with a severity.
_UI_: Résultat
_Avoid_: Issue, error, alert

**Check state**:
How a check applies to a company or a template: off, it does not run; on, its findings warn; blocking, any of its findings stops the download and the ESP send.
_UI_: Désactivé, Actif, Bloquant

**Threshold**:
A limit a check compares a mailing with, such as the length of a subject or the weight of an image.
_UI_: Seuil
_Avoid_: Limit, setting

**Quality settings**:
The state and thresholds of every check for a company. A template overrides them one by one; whatever it does not set is inherited from its company.
_UI_: Réglages du contrôle qualité
_Avoid_: QC config, quality configuration

**Recommended values**:
The state and thresholds of a check when nothing is set: the catalogue's. They cannot be changed.
_UI_: Valeurs recommandées ; « Recommandé : 40 »
_Avoid_: Default (in UI text)

**Exception**:
A check whose state or thresholds a company or a template sets differently from what applies below it. The company's exceptions are its **general settings**, for all its templates; a template's own exceptions apply over them, for that template only. The settings page lists exceptions only, and names neither a company nor a group: its readers are the company's admins.
_UI_: Exception ; Réglages généraux ; Exception propre à ce template ; « Réglage général : … »
_Avoid_: Override, surcharge, Hérité du groupe, Propre au template

**Ignored finding**:
A finding a user chose not to see again on a mailing; it comes back when its content changes. A finding of a blocking check cannot be ignored.
_UI_: Ignoré
