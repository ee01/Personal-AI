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
  validateReaderProof(suite, cases);
  if (!cases.length) {
    warnings.push(`${prefix}: no cases yet. This is acceptable for a planned suite, but it cannot produce an experience report.`);
    return;
  }

  const ids = new Set();
  for (const caseItem of cases) {
    validateCase(suite, caseItem, ids);
  }
}

function validateReaderProof(suite, cases) {
  if (suite.readerProof == null) return;
  const prefix = `suite ${suite.id}: readerProof`;
  if (!suite.readerProof || typeof suite.readerProof !== 'object' || Array.isArray(suite.readerProof)) {
    errors.push(`${prefix} must be an object.`);
    return;
  }

  const claims = suite.readerProof.claims;
  if (!Array.isArray(claims) || !claims.length) {
    errors.push(`${prefix}.claims must contain at least one requirement claim.`);
    return;
  }
  if (!Array.isArray(suite.readerProof.boundaries) || !suite.readerProof.boundaries.length) {
    errors.push(`${prefix}.boundaries must state at least one honest validation boundary.`);
  } else {
    suite.readerProof.boundaries.forEach((boundary, index) => {
      requireString(boundary, `${prefix}.boundaries[${index}] must be a non-empty string.`);
    });
  }

  const knownCaseIds = new Set(cases.map((caseItem) => caseItem.id));
  const referencedCaseIds = new Set();
  const claimIds = new Set();
  claims.forEach((claim, index) => {
    const claimPrefix = `${prefix}.claims[${index}]`;
    requireString(claim?.id, `${claimPrefix}: missing id.`);
    requireString(claim?.statement, `${claimPrefix}: missing reader-facing statement.`);
    if (claim?.id) {
      if (claimIds.has(claim.id)) errors.push(`${claimPrefix}: duplicate id ${claim.id}.`);
      claimIds.add(claim.id);
    }

    if (!Array.isArray(claim?.caseIds) || !claim.caseIds.length) {
      errors.push(`${claimPrefix}.caseIds must map the claim to at least one case.`);
    } else {
      claim.caseIds.forEach((caseId) => {
        if (typeof caseId !== 'string' || !caseId.trim()) {
          errors.push(`${claimPrefix}.caseIds contains an invalid case id.`);
          return;
        }
        referencedCaseIds.add(caseId);
        if (!knownCaseIds.has(caseId)) {
          errors.push(`${claimPrefix}.caseIds references unknown case ${caseId}.`);
        }
      });
    }

    if (claim?.requiredScores != null) {
      if (
        typeof claim.requiredScores !== 'object' ||
        Array.isArray(claim.requiredScores) ||
        !Object.keys(claim.requiredScores).length
      ) {
        errors.push(`${claimPrefix}.requiredScores must be a non-empty score-to-threshold object.`);
      } else {
        for (const [scoreKey, threshold] of Object.entries(claim.requiredScores)) {
          if (!scoreKey.trim()) errors.push(`${claimPrefix}.requiredScores has an empty score key.`);
          if (!Number.isFinite(Number(threshold)) || Number(threshold) < 0 || Number(threshold) > 3) {
            errors.push(`${claimPrefix}.requiredScores.${scoreKey} must be between 0 and 3.`);
          }
        }
      }
    }
  });

  const unreferencedCaseIds = cases
    .map((caseItem) => caseItem.id)
    .filter((caseId) => !referencedCaseIds.has(caseId));
  if (unreferencedCaseIds.length) {
    warnings.push(
      `${prefix}: cases not mapped to a top-level requirement claim: ${unreferencedCaseIds.join(', ')}.`,
    );
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
    Boolean(caseItem.context) ||
    Boolean(caseItem.preview && caseItem.meeting);
  if (!hasInput) {
    errors.push(`${prefix}: missing input context. Add sampleContext, query, context, url, canonicalUrl, or a preview/meeting pair.`);
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
