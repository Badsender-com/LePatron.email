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

### Editor

**Template**:
The email model a group is given, built by the operator: its blocks, styles and defaults. Every mailing of the group starts from one.
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
How a check applies to a group or a template: off, it does not run; on, its findings warn; blocking, any of its findings stops the download and the ESP send.
_UI_: Désactivé, Actif, Bloquant

**Threshold**:
A limit a check compares a mailing with, such as the length of a subject or the weight of an image.
_UI_: Seuil
_Avoid_: Limit, setting

**Quality settings**:
The state and thresholds of every check for a group. A template overrides them one by one; whatever it does not set is inherited from its group.
_UI_: Réglages du contrôle qualité ; Hérité du groupe, Propre au template
_Avoid_: QC config, quality configuration

**Ignored finding**:
A finding a user chose not to see again on a mailing; it comes back when its content changes. A finding of a blocking check cannot be ignored.
_UI_: Ignoré
