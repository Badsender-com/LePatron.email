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
