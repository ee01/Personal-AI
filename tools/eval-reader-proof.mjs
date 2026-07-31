function normalizeTextList(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  );
}

function caseTitle(result) {
  return String(result?.caseTitle || result?.title || result?.caseId || '未命名 case');
}

function isSuccessfulCaseStatus(status) {
  return status === 'pass' || status === 'hide_expected';
}

function buildEvidence(result, requiredScores = {}) {
  return {
    caseId: result.caseId,
    title: caseTitle(result),
    status: result.status || 'unknown',
    scoreChecks: Object.entries(requiredScores).map(([scoreKey, minimum]) => {
      const rawActual = result.scores?.[scoreKey];
      const actual = rawActual == null || rawActual === '' ? Number.NaN : Number(rawActual);
      return {
        scoreKey,
        minimum: Number(minimum),
        actual: Number.isFinite(actual) ? actual : null,
        status:
          Number.isFinite(actual) && actual >= Number(minimum)
            ? 'pass'
            : 'fail',
      };
    }),
  };
}

function resolveDeclaredClaim(claim, resultByCaseId) {
  const caseIds = normalizeTextList(claim.caseIds);
  const requiredScores = claim.requiredScores && typeof claim.requiredScores === 'object'
    ? claim.requiredScores
    : {};
  const evidence = caseIds
    .map((caseId) => resultByCaseId.get(caseId))
    .filter(Boolean)
    .map((result) => buildEvidence(result, requiredScores));
  const missingCaseIds = caseIds.filter((caseId) => !resultByCaseId.has(caseId));
  const nonPassing = evidence.filter((item) => !isSuccessfulCaseStatus(item.status));
  const failedScoreChecks = evidence.flatMap((item) =>
    item.scoreChecks
      .filter((check) => check.status !== 'pass')
      .map((check) => ({ ...check, caseId: item.caseId, caseTitle: item.title })),
  );
  const reasons = [];

  if (!caseIds.length) reasons.push('主张没有映射任何 case。');
  if (missingCaseIds.length) reasons.push(`本次未运行：${missingCaseIds.join('、')}。`);
  if (nonPassing.length) {
    reasons.push(
      `未通过：${nonPassing.map((item) => `${item.title}（${item.status}）`).join('、')}。`,
    );
  }
  if (failedScoreChecks.length) {
    reasons.push(
      `证据门槛未达到：${failedScoreChecks
        .map((check) =>
          `${check.caseTitle} 的 ${check.scoreKey}=${check.actual ?? '缺失'}，要求 >= ${check.minimum}`,
        )
        .join('；')}。`,
    );
  }

  return {
    id: String(claim.id || claim.statement || 'unnamed-claim'),
    statement: String(claim.statement || '').trim() || '未命名需求主张',
    status: reasons.length ? 'not_proved' : 'proved',
    evidence,
    reason: reasons.join(' '),
  };
}

function fallbackStatements(result) {
  const explicit = normalizeTextList(result.proofSummary?.proves);
  if (explicit.length) return explicit;
  if (isSuccessfulCaseStatus(result.status) && String(result.userConclusion || '').trim()) {
    return [String(result.userConclusion).trim()];
  }
  return [`“${caseTitle(result)}”满足该 case 声明的预期行为。`];
}

function mergeFallbackClaims(claims) {
  const merged = new Map();
  for (const claim of claims) {
    const key = `${claim.status}\u0000${claim.statement}\u0000${claim.reason}`;
    const existing = merged.get(key);
    if (existing) {
      existing.evidence.push(...claim.evidence);
      continue;
    }
    merged.set(key, { ...claim, evidence: [...claim.evidence] });
  }
  return Array.from(merged.values());
}

function buildFallbackProof(caseResults) {
  const claims = mergeFallbackClaims(
    caseResults.flatMap((result, resultIndex) =>
      fallbackStatements(result).map((statement, statementIndex) => ({
        id: `case-${result.caseId || resultIndex}-${statementIndex}`,
        statement,
        status: isSuccessfulCaseStatus(result.status) ? 'proved' : 'not_proved',
        evidence: [buildEvidence(result)],
        reason:
          isSuccessfulCaseStatus(result.status)
            ? ''
            : String(result.userConclusion || result.why || result.error || `case 状态为 ${result.status || 'unknown'}`),
      })),
    ),
  );
  const explicitBoundaries = normalizeTextList(
    caseResults.flatMap((result) => result.proofSummary?.doesNotProve || []),
  );
  const boundaries = [
    ...explicitBoundaries,
    caseResults.length
      ? '该 suite 尚未声明 readerProof 契约；以上结论按本次实际 case 归纳，不能外推到未运行场景。'
      : '本次没有执行可判定样本，因此没有形成需求级证明。',
  ];

  return {
    source: 'case_fallback',
    claims,
    boundaries: normalizeTextList(boundaries),
  };
}

export function buildReaderProofModel({ contract, caseResults = [] } = {}) {
  const declaredClaims = Array.isArray(contract?.claims) ? contract.claims : [];
  if (!declaredClaims.length) return buildFallbackProof(caseResults);

  const resultByCaseId = new Map(
    caseResults
      .filter((result) => result?.caseId)
      .map((result) => [result.caseId, result]),
  );
  return {
    source: 'suite_contract',
    claims: declaredClaims.map((claim) => resolveDeclaredClaim(claim, resultByCaseId)),
    boundaries: normalizeTextList(contract.boundaries),
  };
}

export function readerProofLegacyLists(readerProof) {
  const claims = Array.isArray(readerProof?.claims) ? readerProof.claims : [];
  return {
    proved: claims
      .filter((claim) => claim.status === 'proved')
      .map((claim) => claim.statement),
    notProved: [
      ...claims
        .filter((claim) => claim.status !== 'proved')
        .map((claim) =>
          claim.reason ? `${claim.statement}（${claim.reason}）` : claim.statement,
        ),
      ...normalizeTextList(readerProof?.boundaries),
    ],
  };
}
