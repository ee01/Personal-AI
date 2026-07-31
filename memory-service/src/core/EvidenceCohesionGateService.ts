import type {
  EvidenceCohesionReceipt,
  EvidenceCohesionState,
} from '../types/index.js';

export type {
  EvidenceCohesionReceipt,
  EvidenceCohesionState,
} from '../types/index.js';

export type EvidenceCohesionEntrypoint =
  | 'ask'
  | 'context_recall'
  | 'composer_assist'
  | 'reflection_worker'
  | 'action_queue'
  | 'context_pack'
  | 'keystone_brief';

export type EvidenceCohesionIntent =
  | 'answer_question'
  | 'generate_draft'
  | 'delegate_external_check'
  | 'build_context_pack'
  | 'distill_brief'
  | 'reflect_fact';

export type EvidenceCohesionScope = 'work' | 'personal' | 'unknown';

export interface EvidenceCohesionClaim {
  subject?: string;
  propertyKey?: string;
  value?: string;
  stance?: 'supports' | 'contradicts' | 'asks' | 'background';
}

export interface EvidenceCohesionCandidate {
  evidenceRef: string;
  sourceType?: string;
  title?: string;
  snippet: string;
  sourceAnchor?: string;
  subjectKeys?: string[];
  sceneAnchors?: string[];
  claimSlots?: string[];
  claims?: EvidenceCohesionClaim[];
  scope?: EvidenceCohesionScope;
  role?: 'authority' | 'supporting' | 'background' | 'query' | 'prior';
  score?: number;
  timestamp?: number;
}

export interface EvidenceCohesionRequest {
  entrypoint: EvidenceCohesionEntrypoint;
  intent: EvidenceCohesionIntent;
  questionOrTask: string;
  selectedTopic?: {
    id?: string;
    label: string;
    aliases?: string[];
    sourceAnchors?: string[];
  };
  sceneAnchors?: string[];
  claimSlots?: string[];
  candidates: EvidenceCohesionCandidate[];
  policy?: {
    allowBackground?: boolean;
    allowedScopes?: EvidenceCohesionScope[];
    minPrimaryClusterSize?: number;
    minScoreMargin?: number;
    unanchoredMultipleClusters?: 'split' | 'preserve';
  };
}

export interface EvidenceCohesionCluster {
  id: string;
  label: string;
  evidenceRefs: string[];
  subjectKeys: string[];
  sceneAnchors: string[];
  claimSlots: string[];
  score: number;
  anchorMatchCount: number;
  termCoverage: number;
}

export type EvidenceCohesionExclusionReason =
  | 'subject_mismatch'
  | 'scene_mismatch'
  | 'claim_slot_mismatch'
  | 'scope_mismatch'
  | 'secondary_cluster'
  | 'insufficient_anchor';

export interface EvidenceCohesionResult {
  state: EvidenceCohesionState;
  includedEvidenceRefs: string[];
  primaryCluster?: EvidenceCohesionCluster;
  secondaryClusters: EvidenceCohesionCluster[];
  excluded: Array<{
    evidenceRef: string;
    reason: EvidenceCohesionExclusionReason;
    clusterId?: string;
  }>;
  receipt: EvidenceCohesionReceipt;
  diagnostics: {
    querySubjectAnchors: string[];
    querySceneAnchors: string[];
    queryClaimSlots: string[];
    scoreMargin?: number;
  };
}

interface CandidateProfile {
  candidate: EvidenceCohesionCandidate;
  subjectKeys: Set<string>;
  sceneAnchors: Set<string>;
  identifiers: Set<string>;
  claimSlots: Set<string>;
  terms: Set<string>;
}

interface QueryProfile {
  subjectAnchors: Set<string>;
  sceneAnchors: Set<string>;
  identifiers: Set<string>;
  claimSlots: Set<string>;
  terms: Set<string>;
}

interface InternalCluster {
  profiles: CandidateProfile[];
  result: EvidenceCohesionCluster;
}

const POLICY_VERSION = 'evidence-cohesion-v1' as const;

const GENERIC_TERMS = new Set([
  'about',
  'also',
  'answer',
  'attachment',
  'attachment_id',
  'context',
  'current',
  'data',
  'detail',
  'for',
  'evidence',
  'find',
  'id',
  'information',
  'is',
  'issue',
  'memory',
  'meeting',
  'note',
  'notes',
  'project',
  'question',
  'repo',
  'repository',
  'status',
  'task',
  'team',
  'the',
  'thing',
  'update',
  'verify',
  'what',
  'when',
  'where',
  'which',
  'with',
  '关于',
  '什么',
  '信息',
  '当前',
  '情况',
  '状态',
  '项目',
  '记忆',
  '证据',
  '这个',
]);

const CLAIM_SLOT_ALIASES: Array<[string, RegExp]> = [
  ['repository_url', /\b(repository[_\s-]?url|repo[_\s-]?url|git[_\s-]?url)\b|仓库地址|代码仓库/iu],
  ['attachment_id', /\battachment[_\s-]?id\b|附件\s*id/iu],
  ['purpose', /\b(purpose|goal|objective)\b|用途|目标|做什么/iu],
  ['status', /\b(status|state|ready|readiness)\b|状态|进展|完成情况/iu],
  ['owner', /\b(owner|assignee|responsible)\b|负责人|责任人/iu],
  ['deadline', /\b(deadline|due[_\s-]?date|target[_\s-]?date)\b|截止时间|目标日期/iu],
  ['eta', /\beta\b|预计时间|什么时候完成/iu],
  ['estimate', /\b(story[_\s-]?point|estimate|original[_\s-]?estimate)\b|估时|故事点/iu],
];

const ISSUE_KEY_PATTERN = /\b[A-Z][A-Z0-9]{1,14}-\d+\b/g;
const MODEL_VERSION_PREFIXES = new Set([
  'CLAUDE',
  'CODEX',
  'DEEPSEEK',
  'GEMINI',
  'GPT',
  'LLAMA',
  'MISTRAL',
  'QWEN',
]);
const REPOSITORY_PATTERN =
  /(?:github\.com|gitlab\.com|bitbucket\.org)[/:]([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)/giu;
const REPOSITORY_SLUG_PATTERN =
  /(?:^|[\s`'"(])([A-Za-z0-9][A-Za-z0-9._-]{1,40}\/[A-Za-z0-9][A-Za-z0-9._-]{2,80})(?=$|[\s`'"),.;])/gu;
const QUOTED_ANCHOR_PATTERN = /[`"“”']([^`"“”']{3,80})[`"“”']/gu;

export class EvidenceCohesionGateService {
  evaluate(request: EvidenceCohesionRequest): EvidenceCohesionResult {
    const queryProfile = buildQueryProfile(request);
    const profiles = request.candidates.map(buildCandidateProfile);
    const allowedScopes = new Set(request.policy?.allowedScopes ?? []);
    const blockedProfiles =
      allowedScopes.size === 0
        ? []
        : profiles.filter(
            ({ candidate }) =>
              candidate.scope != null && !allowedScopes.has(candidate.scope),
          );
    const eligibleProfiles = profiles.filter(
      (profile) => !blockedProfiles.includes(profile),
    );
    const clusters = buildClusters(eligibleProfiles, queryProfile);
    const blockedExcluded = blockedProfiles.map(({ candidate }) => ({
      evidenceRef: candidate.evidenceRef,
      reason: 'scope_mismatch' as const,
    }));

    if (eligibleProfiles.length === 0) {
      const state: EvidenceCohesionState =
        blockedProfiles.length > 0 ? 'blocked_cross_scene' : 'insufficient_anchor';
      return buildResult({
        state,
        request,
        queryProfile,
        includedEvidenceRefs: [],
        clusters,
        excluded: blockedExcluded,
      });
    }

    if (clusters.length === 0) {
      return buildResult({
        state: 'insufficient_anchor',
        request,
        queryProfile,
        includedEvidenceRefs: [],
        clusters,
        excluded: eligibleProfiles.map(({ candidate }) => ({
          evidenceRef: candidate.evidenceRef,
          reason: 'insufficient_anchor' as const,
        })),
      });
    }

    const [primary, ...secondary] = clusters;
    const scoreMargin =
      secondary.length > 0 ? primary.result.score - secondary[0].result.score : undefined;
    const hasQueryIdentity =
      queryProfile.subjectAnchors.size > 0 ||
      queryProfile.sceneAnchors.size > 0 ||
      queryProfile.identifiers.size > 0;
    const primaryMatchesIdentity = primary.result.anchorMatchCount > 0;
    const meaningfulClusters = clusters.filter((cluster) =>
      hasMeaningfulIdentity(cluster),
    );
    const minScoreMargin = request.policy?.minScoreMargin ?? 1.25;
    const minPrimaryClusterSize = request.policy?.minPrimaryClusterSize ?? 1;

    // Without a query identity and without multiple independently anchored
    // clusters, there is no deterministic basis for deleting evidence. Keep
    // the full set and let downstream ranking handle weak unanchored context.
    if (!hasQueryIdentity && meaningfulClusters.length <= 1) {
      const includedEvidenceRefs = eligibleProfiles.map(
        ({ candidate }) => candidate.evidenceRef,
      );
      const state: EvidenceCohesionState = hasClaimConflict(eligibleProfiles)
        ? 'conflict_needs_authority'
        : 'cohesive';
      return buildResult({
        state,
        request,
        queryProfile,
        includedEvidenceRefs,
        clusters,
        excluded: blockedExcluded,
        scoreMargin,
      });
    }

    if (
      !hasQueryIdentity &&
      request.policy?.unanchoredMultipleClusters === 'preserve'
    ) {
      const includedEvidenceRefs = eligibleProfiles.map(
        ({ candidate }) => candidate.evidenceRef,
      );
      return buildResult({
        state: hasClaimConflict(eligibleProfiles)
          ? 'conflict_needs_authority'
          : 'cohesive',
        request,
        queryProfile,
        includedEvidenceRefs,
        clusters,
        excluded: blockedExcluded,
        scoreMargin,
      });
    }

    if (hasQueryIdentity && !primaryMatchesIdentity) {
      const state: EvidenceCohesionState =
        meaningfulClusters.length > 1 ? 'split_required' : 'insufficient_anchor';
      return buildResult({
        state,
        request,
        queryProfile,
        includedEvidenceRefs: [],
        clusters,
        excluded: [
          ...blockedExcluded,
          ...eligibleProfiles.map(({ candidate }) => ({
            evidenceRef: candidate.evidenceRef,
            reason: 'insufficient_anchor' as const,
          })),
        ],
        scoreMargin,
      });
    }

    if (
      !hasQueryIdentity &&
      meaningfulClusters.length > 1 &&
      (scoreMargin == null || scoreMargin < minScoreMargin)
    ) {
      return buildResult({
        state: 'split_required',
        request,
        queryProfile,
        includedEvidenceRefs: [],
        clusters,
        excluded: [
          ...blockedExcluded,
          ...eligibleProfiles.map(({ candidate }) => ({
            evidenceRef: candidate.evidenceRef,
            reason: 'secondary_cluster' as const,
          })),
        ],
        scoreMargin,
      });
    }

    if (primary.profiles.length < minPrimaryClusterSize) {
      return buildResult({
        state: 'insufficient_anchor',
        request,
        queryProfile,
        includedEvidenceRefs: [],
        clusters,
        excluded: [
          ...blockedExcluded,
          ...eligibleProfiles.map(({ candidate }) => ({
            evidenceRef: candidate.evidenceRef,
            reason: 'insufficient_anchor' as const,
          })),
        ],
        scoreMargin,
      });
    }

    const primaryClusters = hasQueryIdentity
      ? clusters.filter((cluster) => cluster.result.anchorMatchCount > 0)
      : [primary];
    const primaryClusterIds = new Set(
      primaryClusters.map((cluster) => cluster.result.id),
    );
    const includedProfiles = primaryClusters.flatMap(
      (cluster) => cluster.profiles,
    );
    if (request.policy?.allowBackground !== false) {
      for (const cluster of clusters) {
        if (primaryClusterIds.has(cluster.result.id)) continue;
        for (const profile of cluster.profiles) {
          if (isCompatibleBackground(profile, primary, queryProfile)) {
            includedProfiles.push(profile);
          }
        }
      }
    }
    const includedRefSet = new Set(
      includedProfiles.map(({ candidate }) => candidate.evidenceRef),
    );
    const excluded = [
      ...blockedExcluded,
      ...eligibleProfiles
        .filter(({ candidate }) => !includedRefSet.has(candidate.evidenceRef))
        .map((profile) => ({
          evidenceRef: profile.candidate.evidenceRef,
          reason: getExclusionReason(profile, queryProfile),
          clusterId: findClusterId(clusters, profile.candidate.evidenceRef),
        })),
    ];

    let state: EvidenceCohesionState = includedProfiles.some(
      ({ candidate }) => candidate.role === 'background',
    )
      ? 'cohesive_with_background'
      : 'cohesive';
    if (hasClaimConflict(includedProfiles)) {
      state = 'conflict_needs_authority';
    } else if (
      blockedProfiles.length > 0 &&
      (request.intent === 'build_context_pack' ||
        request.intent === 'delegate_external_check')
    ) {
      state = 'blocked_cross_scene';
    }

    return buildResult({
      state,
      request,
      queryProfile,
      includedEvidenceRefs: [...includedRefSet],
      clusters,
      excluded,
      scoreMargin,
    });
  }
}

function buildQueryProfile(request: EvidenceCohesionRequest): QueryProfile {
  const selectedTopicValues = [
    request.selectedTopic?.label,
    ...(request.selectedTopic?.aliases ?? []),
  ].filter((value): value is string => Boolean(value));
  const questionIdentifiers = extractIdentifiers(request.questionOrTask);
  return {
    subjectAnchors: normalizedSet(selectedTopicValues),
    sceneAnchors: normalizedSet([
      ...(request.selectedTopic?.sourceAnchors ?? []),
      ...(request.sceneAnchors ?? []),
    ]),
    identifiers: questionIdentifiers,
    claimSlots: normalizedValueSet([
      ...(request.claimSlots ?? []),
      ...extractClaimSlots(request.questionOrTask),
    ]),
    terms: tokenizeDistinctive([
      request.questionOrTask,
      ...selectedTopicValues,
    ].join(' ')),
  };
}

function buildCandidateProfile(
  candidate: EvidenceCohesionCandidate,
): CandidateProfile {
  const combinedText = [
    candidate.title,
    candidate.snippet,
    candidate.sourceAnchor,
    ...(candidate.subjectKeys ?? []),
    ...(candidate.sceneAnchors ?? []),
  ]
    .filter(Boolean)
    .join(' ');
  return {
    candidate,
    subjectKeys: normalizedSet([
      ...(candidate.subjectKeys ?? []),
      ...(candidate.claims ?? [])
        .map((claim) => claim.subject)
        .filter((value): value is string => Boolean(value)),
    ]),
    sceneAnchors: normalizedSet([
      candidate.sourceAnchor,
      ...(candidate.sceneAnchors ?? []),
    ]),
    identifiers: extractIdentifiers(combinedText),
    claimSlots: normalizedValueSet([
      ...(candidate.claimSlots ?? []),
      ...(candidate.claims ?? [])
        .map((claim) => claim.propertyKey)
        .filter((value): value is string => Boolean(value)),
      ...extractClaimSlots(combinedText),
    ]),
    terms: tokenizeDistinctive(combinedText),
  };
}

function buildClusters(
  profiles: CandidateProfile[],
  query: QueryProfile,
): InternalCluster[] {
  const parents = profiles.map((_, index) => index);
  const find = (index: number): number => {
    if (parents[index] !== index) parents[index] = find(parents[index]);
    return parents[index];
  };
  const union = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  for (let left = 0; left < profiles.length; left += 1) {
    for (let right = left + 1; right < profiles.length; right += 1) {
      if (profilesBelongTogether(profiles[left], profiles[right])) {
        union(left, right);
      }
    }
  }

  const grouped = new Map<number, CandidateProfile[]>();
  profiles.forEach((profile, index) => {
    const root = find(index);
    const group = grouped.get(root) ?? [];
    group.push(profile);
    grouped.set(root, group);
  });

  return [...grouped.values()]
    .map((group, index) => buildCluster(group, query, index))
    .sort((left, right) => {
      if (right.result.score !== left.result.score) {
        return right.result.score - left.result.score;
      }
      return right.profiles.length - left.profiles.length;
    })
    .map((cluster, index) => ({
      ...cluster,
      result: { ...cluster.result, id: `cluster-${index + 1}` },
    }));
}

function profilesBelongTogether(
  left: CandidateProfile,
  right: CandidateProfile,
): boolean {
  if (setsHaveRelatedAnchor(left.subjectKeys, right.subjectKeys)) return true;
  if (setsIntersect(left.sceneAnchors, right.sceneAnchors)) return true;
  if (setsIntersect(left.identifiers, right.identifiers)) return true;

  const commonTerms = intersectionSize(left.terms, right.terms);
  const denominator = Math.max(1, Math.min(left.terms.size, right.terms.size));
  return commonTerms >= 2 && commonTerms / denominator >= 0.6;
}

function buildCluster(
  profiles: CandidateProfile[],
  query: QueryProfile,
  index: number,
): InternalCluster {
  const subjectKeys = unionSets(profiles.map((profile) => profile.subjectKeys));
  const sceneAnchors = unionSets(
    profiles.map((profile) => profile.sceneAnchors),
  );
  const identifiers = unionSets(profiles.map((profile) => profile.identifiers));
  const claimSlots = unionSets(profiles.map((profile) => profile.claimSlots));
  const terms = unionSets(profiles.map((profile) => profile.terms));
  const subjectMatches =
    countRelatedAnchors(subjectKeys, query.subjectAnchors) +
    countSubjectAnchorsInTerms(query.subjectAnchors, terms);
  const sceneMatches = intersectionSize(sceneAnchors, query.sceneAnchors);
  const identifierMatches = intersectionSize(identifiers, query.identifiers);
  const claimMatches = intersectionSize(claimSlots, query.claimSlots);
  const termCoverage =
    query.terms.size === 0
      ? 0
      : intersectionSize(terms, query.terms) / query.terms.size;
  const anchorMatchCount = subjectMatches + sceneMatches + identifierMatches;
  const maxRecallScore = profiles.reduce(
    (max, profile) => Math.max(max, clamp01(profile.candidate.score ?? 0)),
    0,
  );
  const score =
    identifierMatches * 8 +
    subjectMatches * 6 +
    sceneMatches * 5 +
    claimMatches * 2 +
    termCoverage * 4 +
    maxRecallScore * 1.5 +
    Math.min(profiles.length, 3) * 0.2;

  return {
    profiles,
    result: {
      id: `cluster-${index + 1}`,
      label: chooseClusterLabel(profiles, subjectKeys, identifiers),
      evidenceRefs: profiles.map(({ candidate }) => candidate.evidenceRef),
      subjectKeys: [...subjectKeys],
      sceneAnchors: [...sceneAnchors],
      claimSlots: [...claimSlots],
      score: round(score),
      anchorMatchCount,
      termCoverage: round(termCoverage),
    },
  };
}

function buildResult(params: {
  state: EvidenceCohesionState;
  request: EvidenceCohesionRequest;
  queryProfile: QueryProfile;
  includedEvidenceRefs: string[];
  clusters: InternalCluster[];
  excluded: EvidenceCohesionResult['excluded'];
  scoreMargin?: number;
}): EvidenceCohesionResult {
  const [primary, ...secondary] = params.clusters;
  const receipt: EvidenceCohesionReceipt = {
    policyVersion: POLICY_VERSION,
    state: params.state,
    usedCount: params.includedEvidenceRefs.length,
    excludedCount: params.excluded.length,
    clusterCount: params.clusters.length,
    primarySubject: primary?.result.label,
    silent:
      params.state === 'cohesive' || params.state === 'cohesive_with_background',
    summary: buildReceiptSummary(
      params.state,
      params.includedEvidenceRefs.length,
      params.excluded.length,
      params.clusters.length,
    ),
  };
  return {
    state: params.state,
    includedEvidenceRefs: params.includedEvidenceRefs,
    primaryCluster: primary?.result,
    secondaryClusters: secondary.map((cluster) => cluster.result),
    excluded: params.excluded,
    receipt,
    diagnostics: {
      querySubjectAnchors: [...params.queryProfile.subjectAnchors],
      querySceneAnchors: [...params.queryProfile.sceneAnchors],
      queryClaimSlots: [...params.queryProfile.claimSlots],
      scoreMargin:
        params.scoreMargin == null ? undefined : round(params.scoreMargin),
    },
  };
}

function buildReceiptSummary(
  state: EvidenceCohesionState,
  usedCount: number,
  excludedCount: number,
  clusterCount: number,
): string {
  if (state === 'split_required') {
    return `候选证据分成 ${clusterCount} 个问题，暂未继续。`;
  }
  if (state === 'insufficient_anchor') {
    return '缺少足够的主题或场景锚点，暂未使用候选证据。';
  }
  if (state === 'conflict_needs_authority') {
    return `已对齐的证据存在事实冲突，保留 ${usedCount} 条等待权威判断。`;
  }
  if (state === 'blocked_cross_scene') {
    return `发现跨场景或范围证据，已阻止继续消费；排除 ${excludedCount} 条。`;
  }
  return `已对齐 ${usedCount} 条证据，排除 ${excludedCount} 条跨题线索。`;
}

function hasMeaningfulIdentity(cluster: InternalCluster): boolean {
  return cluster.profiles.some(
    (profile) =>
      profile.subjectKeys.size > 0 ||
      profile.sceneAnchors.size > 0 ||
      profile.identifiers.size > 0,
  );
}

function isCompatibleBackground(
  profile: CandidateProfile,
  primary: InternalCluster,
  query: QueryProfile,
): boolean {
  if (profile.candidate.role !== 'background') return false;
  const primarySubjects = unionSets(
    primary.profiles.map((candidate) => candidate.subjectKeys),
  );
  if (
    profile.subjectKeys.size > 0 &&
    primarySubjects.size > 0 &&
    !setsHaveRelatedAnchor(profile.subjectKeys, primarySubjects)
  ) {
    return false;
  }
  return (
    setsIntersect(profile.sceneAnchors, query.sceneAnchors) ||
    intersectionSize(profile.terms, query.terms) >= 2
  );
}

function getExclusionReason(
  profile: CandidateProfile,
  query: QueryProfile,
): EvidenceCohesionExclusionReason {
  if (
    query.subjectAnchors.size > 0 &&
    !setsHaveRelatedAnchor(profile.subjectKeys, query.subjectAnchors) &&
    !setsIntersect(profile.identifiers, query.identifiers)
  ) {
    return 'subject_mismatch';
  }
  if (
    query.sceneAnchors.size > 0 &&
    profile.sceneAnchors.size > 0 &&
    !setsIntersect(profile.sceneAnchors, query.sceneAnchors)
  ) {
    return 'scene_mismatch';
  }
  if (
    query.claimSlots.size > 0 &&
    profile.claimSlots.size > 0 &&
    !setsIntersect(profile.claimSlots, query.claimSlots)
  ) {
    return 'claim_slot_mismatch';
  }
  return 'secondary_cluster';
}

function findClusterId(
  clusters: InternalCluster[],
  evidenceRef: string,
): string | undefined {
  return clusters.find((cluster) =>
    cluster.result.evidenceRefs.includes(evidenceRef),
  )?.result.id;
}

function hasClaimConflict(profiles: CandidateProfile[]): boolean {
  const byClaim = new Map<string, Set<string>>();
  for (const profile of profiles) {
    for (const claim of profile.candidate.claims ?? []) {
      if (claim.stance === 'contradicts') return true;
      const propertyKey = normalizeAnchor(claim.propertyKey ?? '');
      const subject = normalizeAnchor(claim.subject ?? '');
      const value = normalizeAnchor(claim.value ?? '');
      if (!propertyKey || !value) continue;
      const key = `${subject || 'unknown'}:${propertyKey}`;
      const values = byClaim.get(key) ?? new Set<string>();
      values.add(value);
      byClaim.set(key, values);
    }
  }
  return [...byClaim.values()].some((values) => values.size > 1);
}

function chooseClusterLabel(
  profiles: CandidateProfile[],
  subjectKeys: Set<string>,
  identifiers: Set<string>,
): string {
  const rawSubject = profiles
    .flatMap(({ candidate }) => candidate.subjectKeys ?? [])
    .find((value) => normalizeAnchor(value));
  if (rawSubject) return compactLabel(rawSubject);
  const subject = [...subjectKeys][0];
  if (subject) return subject;
  const identifier = [...identifiers][0];
  if (identifier) return identifier;
  const title = profiles.find(({ candidate }) => candidate.title?.trim())
    ?.candidate.title;
  return compactLabel(title ?? profiles[0]?.candidate.snippet ?? '未命名证据');
}

function extractIdentifiers(text: string): Set<string> {
  const result = new Set<string>();
  for (const match of text.matchAll(ISSUE_KEY_PATTERN)) {
    const prefix = match[0].split('-', 1)[0]?.toUpperCase();
    if (!MODEL_VERSION_PREFIXES.has(prefix)) {
      result.add(normalizeAnchor(match[0]));
    }
  }
  for (const match of text.matchAll(REPOSITORY_PATTERN)) {
    result.add(normalizeAnchor(match[1]));
  }
  for (const match of text.matchAll(REPOSITORY_SLUG_PATTERN)) {
    result.add(normalizeAnchor(match[1]));
  }
  for (const match of text.matchAll(QUOTED_ANCHOR_PATTERN)) {
    const anchor = normalizeAnchor(match[1]);
    if (anchor && !isGenericAnchor(anchor)) result.add(anchor);
  }
  return result;
}

function extractClaimSlots(text: string): string[] {
  return CLAIM_SLOT_ALIASES.filter(([, pattern]) => pattern.test(text)).map(
    ([slot]) => slot,
  );
}

function tokenizeDistinctive(text: string): Set<string> {
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [];
  return new Set(
    tokens
      .map((token) => token.replace(/^[-_]+|[-_]+$/g, ''))
      .filter(
        (token) =>
          token.length >= 2 &&
          !GENERIC_TERMS.has(token) &&
          !/^\d+$/.test(token),
      ),
  );
}

function normalizedSet(values: Array<string | undefined>): Set<string> {
  return new Set(
    values
      .map((value) => normalizeAnchor(value ?? ''))
      .filter((value) => value && !isGenericAnchor(value)),
  );
}

function normalizedValueSet(values: Array<string | undefined>): Set<string> {
  return new Set(
    values.map((value) => normalizeAnchor(value ?? '')).filter(Boolean),
  );
}

function normalizeAnchor(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\.git$/, '')
    .replace(/[^\p{L}\p{N}_./-]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isGenericAnchor(value: string): boolean {
  const terms = value.split(/[\s/]+/).filter(Boolean);
  return terms.length === 0 || terms.every((term) => GENERIC_TERMS.has(term));
}

function setsHaveRelatedAnchor(left: Set<string>, right: Set<string>): boolean {
  for (const leftValue of left) {
    for (const rightValue of right) {
      if (anchorsRelated(leftValue, rightValue)) return true;
    }
  }
  return false;
}

function countRelatedAnchors(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const rightValue of right) {
    if ([...left].some((leftValue) => anchorsRelated(leftValue, rightValue))) {
      count += 1;
    }
  }
  return count;
}

function countSubjectAnchorsInTerms(
  anchors: Set<string>,
  terms: Set<string>,
): number {
  let count = 0;
  for (const anchor of anchors) {
    const anchorTerms = tokenizeDistinctive(anchor);
    if (
      anchorTerms.size > 0 &&
      [...anchorTerms].every((term) => terms.has(term))
    ) {
      count += 1;
    }
  }
  return count;
}

function anchorsRelated(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length < 4 || right.length < 4) return false;
  return left.includes(right) || right.includes(left);
}

function setsIntersect(left: Set<string>, right: Set<string>): boolean {
  return intersectionSize(left, right) > 0;
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) count += 1;
  }
  return count;
}

function unionSets(sets: Set<string>[]): Set<string> {
  const result = new Set<string>();
  for (const set of sets) {
    for (const value of set) result.add(value);
  }
  return result;
}

function compactLabel(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= 72 ? normalized : `${normalized.slice(0, 69)}...`;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
