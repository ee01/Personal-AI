#!/usr/bin/env node
import fs from 'node:fs/promises';

import {
  loadRegistry,
  loadSuiteCases,
  readTextIfExists,
  resolveRepoPath,
} from './eval-lib.mjs';

const registry = await loadRegistry();
const errors = [];
const warnings = [];

if (registry.version !== 1) {
  errors.push('evals/registry.yaml: version must be 1.');
}

for (const suite of registry.suites || []) {
  await validateSuite(suite);
}

if (warnings.length) {
  console.log('Warnings:');
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (errors.length) {
  console.error('Eval validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Eval validation passed (${(registry.suites || []).length} suites).`);

async function validateSuite(suite) {
  const prefix = `suite ${suite.id || '<missing-id>'}`;
  requireString(suite.id, `${prefix}: missing id.`);
  requireString(suite.title, `${prefix}: missing title.`);
  requireString(suite.description, `${prefix}: missing Chinese description for overview/report pages.`);
  requireString(suite.workflow, `${prefix}: missing workflow path.`);
  requireString(suite.cases, `${prefix}: missing cases path.`);

  if (suite.workflow) {
    const workflowText = await readTextIfExists(suite.workflow);
    if (!workflowText) {
      errors.push(`${prefix}: workflow file not found: ${suite.workflow}`);
    } else if (!/report requirements/i.test(workflowText)) {
      errors.push(`${prefix}: workflow must include a "Report requirements" section.`);
    }
  }

  if (suite.cases) {
    try {
      await fs.access(resolveRepoPath(suite.cases));
    } catch {
      errors.push(`${prefix}: cases file not found: ${suite.cases}`);
      return;
    }
  }

  const cases = await loadSuiteCases(suite);
  if (!cases.length) {
    warnings.push(`${prefix}: no cases yet. This is acceptable for a planned suite, but it cannot produce an experience report.`);
    return;
  }

  const ids = new Set();
  for (const caseItem of cases) {
    validateCase(suite, caseItem, ids);
  }
}

function validateCase(suite, caseItem, ids) {
  const prefix = `case ${suite.id}:${caseItem.id || '<missing-id>'}`;
  requireString(caseItem.id, `${prefix}: missing id.`);
  if (caseItem.id) {
    if (ids.has(caseItem.id)) errors.push(`${prefix}: duplicate case id.`);
    ids.add(caseItem.id);
  }
  requireString(caseItem.kind, `${prefix}: missing kind.`);
  requireString(caseItem.title, `${prefix}: missing title.`);

  const hasInput =
    Boolean(caseItem.sampleContext) ||
    Boolean(caseItem.query) ||
    Boolean(caseItem.url) ||
    Boolean(caseItem.canonicalUrl) ||
    Boolean(caseItem.context);
  if (!hasInput) {
    errors.push(`${prefix}: missing input context. Add sampleContext, query, context, url, or canonicalUrl.`);
  }

  const hasExpected =
    Boolean(caseItem.expectedBehavior) ||
    hasArray(caseItem.expectedTopics) ||
    hasArray(caseItem.expectedTopMissions) ||
    hasArray(caseItem.expectedAllowedFacts);
  if (!hasExpected) {
    errors.push(`${prefix}: missing expected behavior. Add expectedBehavior or expected* anchors.`);
  }

  if (!caseItem.privacy && !caseItem.owner) {
    warnings.push(`${prefix}: missing privacy/owner metadata.`);
  }
}

function requireString(value, message) {
  if (typeof value !== 'string' || !value.trim()) errors.push(message);
}

function hasArray(value) {
  return Array.isArray(value) && value.length > 0;
}
