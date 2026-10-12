---
name: domain-modeling
description: Build and sharpen the project's domain model. Use when discussing codebase terminology, writing or editing GLOSSARY.md, or recording or editing an ADR in docs/adr/.
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the _active_ discipline: challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they crystallise. (Merely _reading_ `GLOSSARY.md` for vocabulary is not this skill: that's a one-line habit any skill can do. This skill is for when you're changing the model, not just consuming it.)

## File structure

LePatron.email has a single context:

```
/
├── GLOSSARY.md
├── docs/
│   └── adr/
│       ├── README.md
│       ├── 0001-grill-first-feature-workflow.md
│       └── 0002-....md
└── packages/
```

Create `GLOSSARY.md` lazily: only when the first term is resolved.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `GLOSSARY.md`, call it out immediately. "Your glossary defines 'workspace' as X, but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. Watch the places where the code already says one thing several ways: the `Group` model is referenced as `_company`, and a mailing points at its `Template` through `_wireframe`. "You're saying 'template': do you mean the Mosaico template a company is given, or a mailing saved as a model? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts (a user in two companies, a mailing moved between workspaces, a deleted template still used by mailings).

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "The code lets a group admin delete any folder, but you just said only the folder's creator can. Which is right?"

### Update GLOSSARY.md inline

When a term is resolved, update `GLOSSARY.md` right there. Don't batch these up: capture them as they happen. Use the format in [GLOSSARY-FORMAT.md](./GLOSSARY-FORMAT.md).

`GLOSSARY.md` should be totally devoid of implementation details. Do not treat `GLOSSARY.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Record decisions in ADRs

A decision belongs in an ADR when all three are true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful
2. **Surprising without context**: a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, leave the decision out of the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

In the new feature workflow (`AGENTS.md`), every feature ends with at least one ADR: the criteria above decide what goes in it, not whether it exists.

### Flag ADR conflicts

If a decision contradicts an existing ADR, surface it explicitly rather than silently overriding: "This contradicts ADR-0004, but worth reopening because…". A reversed decision gets a new ADR, and the old one is marked `superseded by ADR-NNNN`.
