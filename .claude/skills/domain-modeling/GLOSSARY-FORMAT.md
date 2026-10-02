# GLOSSARY.md Format

`GLOSSARY.md` lives at the repository root. Terms are in English, like the code; the French label shown in the UI goes on an optional `_UI_` line when it differs.

## Structure

```md
# LePatron.email

{One or two sentence description of what the product is.}

## Language

**Mailing**:
An email being designed in the editor, from a template, inside a workspace.
_UI_: Email
_Avoid_: Campaign, newsletter

**Group**:
A client company: it owns users, workspaces, templates and ESP profiles.
_UI_: Groupe
_Avoid_: Company, organization, account
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others under `_Avoid_`.
- **Keep definitions tight.** One or two sentences max. Define what it IS, not what it does.
- **Only include terms specific to this product.** General programming concepts (timeouts, error types, utility patterns) don't belong even if the project uses them extensively. Before adding a term, ask: is this a concept unique to LePatron.email, or a general programming concept? Only the former belongs.
- **Group terms under subheadings** when natural clusters emerge (Editor, Organization, Export, AI).
