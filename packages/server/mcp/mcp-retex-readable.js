'use strict';

// A retex as a reader sees it (ADR 0021): its company, the company a
// consultant worked for, and whether its author is a consultant or a client
// user, never who.

const { Groups } = require('../common/models.common.js');

// A company as a reader sees it: its id and its name, empty once deleted.
function named(id, companies) {
  const company = companies.get(String(id));
  return { id: String(id), name: company ? company.name : '' };
}

// The company a consultant worked for, when it is not the retex's own.
function connectedTo(retex, companies) {
  const context = retex._connectedCompany && String(retex._connectedCompany);
  if (!context || context === String(retex._company)) return {};
  return { connectedTo: named(context, companies) };
}

// A retex as a reader sees it: no author, no user. A consultant's says the
// company they worked for, as context.
function readable(retex, companies) {
  return {
    retexId: String(retex._id),
    kind: retex.kind,
    status: retex.status,
    about: retex.about || null,
    category: retex.category,
    part: retex.part,
    section: retex.section,
    quote: retex.quote,
    recommended: retex.recommended,
    decided: retex.decided,
    why: retex.why,
    missing: retex.missing,
    brought: retex.brought,
    source: retex.source,
    company: named(retex._company, companies),
    ...connectedTo(retex, companies),
    author: retex.author,
    createdAt: retex.createdAt ? new Date(retex.createdAt).toISOString() : null,
    ...(retex.addressedIn && { addressedIn: retex.addressedIn }),
    ...(retex.dismissal && { dismissal: { reason: retex.dismissal.reason } }),
  };
}

// Retex as a reader sees them, with their companies' names read once.
async function readableAll(found) {
  const companyIds = [
    ...new Set(
      found.flatMap((r) =>
        [r._company, r._connectedCompany].filter(Boolean).map(String)
      )
    ),
  ];
  const companies = await Groups.find(
    { _id: { $in: companyIds } },
    { name: 1 }
  ).lean();
  const byId = new Map(companies.map((g) => [String(g._id), g]));
  return found.map((retex) => readable(retex, byId));
}

module.exports = { readableAll };
