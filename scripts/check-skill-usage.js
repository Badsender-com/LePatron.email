#!/usr/bin/env node
'use strict';

/**
 * CI gate: verify that every `skillInvocation.invoke({ skillId: '...' })` call
 * detected in packages/server/** is declared by a feature manifest, and that
 * declared skills/expertise actually exist in DB and are ACTIVE.
 *
 * Optional `--dry` flag skips the DB check (useful in environments without
 * Mongo, e.g. CI on a fresh checkout). The static AST/regex scan still runs.
 *
 * Exit codes:
 *   0  OK
 *   1  hard error (undeclared skill, manifest pointing at missing skill)
 *   2  warning-only run (orphan skills detected)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'packages', 'server');
const INVOKE_REGEX = /skillInvocation\.invoke\s*\(\s*\{[^}]*skillId\s*:\s*['"]([^'"]+)['"]/g;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

function findManifestFiles() {
  const out = [];
  for (const entry of fs.readdirSync(SERVER_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(SERVER_DIR, entry.name, 'skill-manifest.js');
    if (fs.existsSync(candidate)) out.push(candidate);
  }
  return out;
}

function scanInvocations() {
  const invocations = new Map(); // skillId → [file paths]
  for (const file of walk(SERVER_DIR)) {
    if (file.endsWith('skill-manifest.js')) continue;
    if (file.includes(path.join('ai-skill', 'services'))) continue; // exclude the service itself
    const content = fs.readFileSync(file, 'utf8');
    let match;
    INVOKE_REGEX.lastIndex = 0;
    while ((match = INVOKE_REGEX.exec(content)) !== null) {
      const id = match[1];
      if (!invocations.has(id)) invocations.set(id, []);
      invocations.get(id).push(file);
    }
  }
  return invocations;
}

function loadManifests() {
  const manifests = [];
  for (const file of findManifestFiles()) {
    // eslint-disable-next-line import/no-dynamic-require
    const manifest = require(file);
    manifests.push({ file, manifest });
  }
  return manifests;
}

async function checkDB(declaredSkillIds, declaredExpertiseIds, allowDraft) {
  const { LePatronSkills, Expertises } = require(path.join(
    SERVER_DIR,
    'common',
    'models.common.js'
  ));
  const skillStatuses = allowDraft ? ['ACTIVE', 'DRAFT'] : ['ACTIVE'];

  const errors = [];
  if (declaredSkillIds.length > 0) {
    const skills = await LePatronSkills.find(
      { skillId: { $in: declaredSkillIds }, status: { $in: skillStatuses } },
      { skillId: 1 }
    ).lean();
    const found = new Set(skills.map((s) => s.skillId));
    for (const id of declaredSkillIds) {
      if (!found.has(id)) {
        errors.push(
          `Manifest references skill "${id}" but it is missing or not ${skillStatuses.join(
            '/'
          )}`
        );
      }
    }
  }
  if (declaredExpertiseIds.length > 0) {
    const expertise = await Expertises.find(
      { expertiseId: { $in: declaredExpertiseIds } },
      { expertiseId: 1 }
    ).lean();
    const found = new Set(expertise.map((e) => e.expertiseId));
    for (const id of declaredExpertiseIds) {
      if (!found.has(id)) {
        errors.push(
          `Manifest references expertise "${id}" but it is missing in DB`
        );
      }
    }
  }
  return errors;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dry = args.has('--dry');
  const allowDraft =
    args.has('--allow-draft') || process.env.NODE_ENV !== 'production';

  const invocations = scanInvocations();
  const manifests = loadManifests();
  const declaredSkillIds = new Set();
  const declaredExpertiseIds = new Set();
  for (const { manifest } of manifests) {
    for (const s of manifest.usedSkills || []) declaredSkillIds.add(s.skillId);
    for (const e of manifest.usedExpertise || [])
      declaredExpertiseIds.add(e.expertiseId);
  }

  const undeclared = [];
  for (const [id, files] of invocations.entries()) {
    if (!declaredSkillIds.has(id)) {
      undeclared.push({ id, files });
    }
  }

  const orphans = [];
  for (const id of declaredSkillIds) {
    if (!invocations.has(id)) orphans.push(id);
  }

  const errors = [];
  if (undeclared.length > 0) {
    for (const u of undeclared) {
      errors.push(
        `Undeclared skill invocation "${
          u.id
        }" — add it to a feature manifest (called from: ${u.files.join(', ')})`
      );
    }
  }

  if (!dry) {
    try {
      const dbErrors = await checkDB(
        Array.from(declaredSkillIds),
        Array.from(declaredExpertiseIds),
        allowDraft
      );
      errors.push(...dbErrors);
    } catch (err) {
      console.warn(`[check-skill-usage] DB check skipped: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error('\n[check-skill-usage] FAILED:');
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }

  if (orphans.length > 0) {
    console.warn(
      '\n[check-skill-usage] orphan skills (declared but never invoked):'
    );
    for (const id of orphans) console.warn(`  • ${id}`);
  }

  console.log(
    `\n[check-skill-usage] OK — ${invocations.size} invocation site(s), ${declaredSkillIds.size} declared skill(s)`
  );
  process.exit(orphans.length > 0 ? 2 : 0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { scanInvocations, loadManifests };
