#!/usr/bin/env node
'use strict';

/**
 * Migration: backfill AIPlaygroundScenario.expertiseFilter.categories.
 *
 * findApplicable now requires `categories` alongside `scope` (cf.
 * expertise.repository). Scenarios in FILTER mode (non-empty expertiseFilter,
 * empty expertiseRefs) created before this change have no categories and would
 * resolve to no expertise. Backfill them with the category of the scenario's
 * skill — the same default the UI now pre-fills. Scenarios in explicit-refs
 * mode are untouched.
 *
 * Idempotent — a scenario that already has categories is left alone.
 *
 * Usage:
 *   node scripts/migrate-playground-filter-categories.js              # apply
 *   node scripts/migrate-playground-filter-categories.js --dry-run    # report
 */

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();
const config = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'node.config.js'
));
const { AIPlaygroundScenarios, LePatronSkills } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'common',
  'models.common.js'
));

const DRY = process.argv.includes('--dry-run');

function isFilterMode(scenario) {
  const refs = scenario.expertiseRefs || [];
  const filter = scenario.expertiseFilter || {};
  const hasScope = Array.isArray(filter.scope) && filter.scope.length > 0;
  return refs.length === 0 && hasScope;
}

/**
 * Pure planning step (unit-testable without a DB).
 * @param {Array} scenarios
 * @param {(skillId: string) => (string|null)} categoryOf — skill category lookup
 * @returns {{ toUpdate: Array<{scenarioId, categories}>, skipped: number }}
 */
function planScenarioMigration(scenarios, categoryOf) {
  const toUpdate = [];
  let skipped = 0;
  for (const sc of scenarios) {
    const filter = sc.expertiseFilter || {};
    const hasCategories =
      Array.isArray(filter.categories) && filter.categories.length > 0;
    if (!isFilterMode(sc) || hasCategories) {
      skipped += 1;
      continue;
    }
    const category = categoryOf(sc.skillRef && sc.skillRef.skillId);
    if (!category) {
      skipped += 1;
      continue;
    }
    toUpdate.push({ scenarioId: sc.scenarioId, categories: [category] });
  }
  return { toUpdate, skipped };
}

async function main() {
  console.log(`Connecting to ${config.database} (dry-run=${DRY})…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    const scenarios = await AIPlaygroundScenarios.find(
      {},
      { scenarioId: 1, skillRef: 1, expertiseRefs: 1, expertiseFilter: 1 }
    ).lean();
    const skillIds = [
      ...new Set(
        scenarios.map((s) => s.skillRef && s.skillRef.skillId).filter(Boolean)
      ),
    ];
    const skills = await LePatronSkills.find(
      { skillId: { $in: skillIds } },
      { skillId: 1, category: 1 }
    ).lean();
    const categoryById = new Map(skills.map((s) => [s.skillId, s.category]));

    const { toUpdate, skipped } = planScenarioMigration(scenarios, (id) =>
      categoryById.get(id)
    );

    for (const u of toUpdate) {
      if (DRY) {
        console.log(
          `[dry] would set categories=${JSON.stringify(u.categories)} on "${
            u.scenarioId
          }"`
        );
      } else {
        await AIPlaygroundScenarios.updateOne(
          { scenarioId: u.scenarioId },
          { $set: { 'expertiseFilter.categories': u.categories } }
        );
        console.log(
          `set categories=${JSON.stringify(u.categories)} on "${u.scenarioId}"`
        );
      }
    }
    console.log(
      `Playground filter categories: ${toUpdate.length} scenario(s) ${
        DRY ? 'would be updated' : 'updated'
      }, ${skipped} skipped.`
    );
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { planScenarioMigration, isFilterMode };
