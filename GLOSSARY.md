# LePatron.email

An email builder for marketing teams: each client company designs its emails in a shared editor, from templates it is given, and exports them to its sending platform.

## Language

### AI

**AI feature**:
A capability of the product that relies on an AI provider, enabled per group with its own integration and model (translation, text generation).
_UI_: Fonctionnalité IA
_Avoid_: Feature config, AI module

**Text generation**:
The AI feature that writes text for the user to pick from: today the subject and the preheader of an email.
_UI_: Génération de texte
_Avoid_: Textgen, copywriting, AI writing

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

### Email

**Subject**:
The subject line of an email, edited in the email's metadata when the group uses them; otherwise it lives in the ESP.
_UI_: Objet
_Avoid_: Title, object

**Preheader**:
The hidden preview text shown after the subject in the inbox, declared by the template.
_UI_: Préheader
_Avoid_: Preview text, pre-header, view-online banner
