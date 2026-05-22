export const USER_CONFIG_PROMPT_CHAR_LIMIT = 1500;
export const USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT = 200;
export const USER_CONFIG_CONTEXT_ARRAY_LIMIT = 20;

type JsonRecord = Record<string, any>;

const cleanString = (value: any): string => (
  typeof value === 'string' ? value.trim() : ''
);

const normalizeContextText = (value: any): string => {
  const text = cleanString(value);
  return text.length > USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT
    ? text.slice(0, USER_CONFIG_CONTEXT_TEXT_CHAR_LIMIT)
    : text;
};

const DEFAULT_USER_CONTEXT_SCALARS = new Set([
  'GMT+8',
  'medium',
  'weekly',
  '每周',
  '中英文混合',
  '简洁直接',
  '项目状态报告',
]);

export const isDefaultUserContextScalar = (value: any): boolean => (
  DEFAULT_USER_CONTEXT_SCALARS.has(cleanString(value))
);

export const normalizePromptContent = (value: any): string => {
  const content = cleanString(value);
  return content.length > USER_CONFIG_PROMPT_CHAR_LIMIT
    ? content.slice(0, USER_CONFIG_PROMPT_CHAR_LIMIT)
    : content;
};

const cleanStringArray = (value: any): string[] => (
  (Array.isArray(value)
    ? value.map(normalizeContextText).filter(Boolean)
    : normalizeContextText(value)
      ? [normalizeContextText(value)]
      : []
  ).slice(0, USER_CONFIG_CONTEXT_ARRAY_LIMIT)
);

const hasAnyValue = (value: JsonRecord): boolean => (
  Object.values(value).some((item) => {
    if (Array.isArray(item)) return item.length > 0;
    return item !== undefined && item !== null && item !== '';
  })
);

const hasStakeholderValue = (value: JsonRecord): boolean => (
  Boolean(value.name || value.position || value.relationship)
);

const sanitizePrompt = (prompt: any): JsonRecord => ({
  ...(prompt || {}),
  enabled: Boolean(prompt?.enabled),
  content: normalizePromptContent(prompt?.content),
  position: cleanString(prompt?.position) || 'after_analysis_guide',
});

const sanitizePreferenceInjection = (settings: any): JsonRecord => ({
  ...(settings || {}),
  enabled: settings?.enabled !== false,
  customPromptsEnabled: settings?.customPromptsEnabled !== false,
  messagePromptEnabled: settings?.messagePromptEnabled !== false,
  projectPromptEnabled: settings?.projectPromptEnabled !== false,
  userContextEnabled: settings?.userContextEnabled !== false,
});

const sanitizeStakeholders = (stakeholders: any): JsonRecord => ({
  ...(stakeholders || {}),
  directManager: normalizeContextText(stakeholders?.directManager),
  reportingFrequency: normalizeContextText(stakeholders?.reportingFrequency) || '每周',
  keyStakeholders: Array.isArray(stakeholders?.keyStakeholders)
    ? stakeholders.keyStakeholders
        .map((item: any) => ({
          name: normalizeContextText(item?.name),
          position: normalizeContextText(item?.position),
          relationship: normalizeContextText(item?.relationship),
          priority: normalizeContextText(item?.priority),
        }))
        .filter(hasStakeholderValue)
        .slice(0, USER_CONFIG_CONTEXT_ARRAY_LIMIT)
        .map((item: JsonRecord) => ({
          ...item,
          priority: item.priority || 'medium',
        }))
    : [],
});

const sanitizeTeamInfo = (teamInfo: any): JsonRecord => ({
  ...(teamInfo || {}),
  teamName: normalizeContextText(teamInfo?.teamName),
  teamMission: normalizeContextText(teamInfo?.teamMission),
  teamSize: Math.max(0, Number(teamInfo?.teamSize) || 0),
  members: Array.isArray(teamInfo?.members)
    ? teamInfo.members
        .map((item: any) => ({
          name: normalizeContextText(item?.name),
          position: normalizeContextText(item?.position),
          role: normalizeContextText(item?.role),
          speciality: normalizeContextText(item?.speciality),
        }))
        .filter(hasAnyValue)
        .slice(0, USER_CONFIG_CONTEXT_ARRAY_LIMIT)
    : [],
  workingHours: normalizeContextText(teamInfo?.workingHours),
  timezone: normalizeContextText(teamInfo?.timezone) || 'GMT+8',
});

const sanitizeUserContextConfig = (config: any): JsonRecord => {
  const userContext = config || {};
  const personalInfo = userContext.personalInfo || {};
  const workFocus = userContext.workFocus || {};
  const communicationContext = userContext.communicationContext || {};
  const analysisPreferences = userContext.analysisPreferences || {};
  const messageAnalysis = analysisPreferences.messageAnalysis || {};
  const projectAnalysis = analysisPreferences.projectAnalysis || {};

  return {
    ...userContext,
    personalInfo: {
      ...personalInfo,
      name: normalizeContextText(personalInfo.name),
      email: normalizeContextText(personalInfo.email),
      title: normalizeContextText(personalInfo.title),
      department: normalizeContextText(personalInfo.department),
      location: normalizeContextText(personalInfo.location),
      timezone: normalizeContextText(personalInfo.timezone) || 'GMT+8',
    },
    stakeholders: sanitizeStakeholders(userContext.stakeholders),
    teamInfo: sanitizeTeamInfo(userContext.teamInfo),
    workFocus: {
      ...workFocus,
      primaryConcerns: cleanStringArray(workFocus.primaryConcerns),
      businessDomains: cleanStringArray(workFocus.businessDomains),
      keyMetrics: cleanStringArray(workFocus.keyMetrics),
      riskTolerance: normalizeContextText(workFocus.riskTolerance) || 'medium',
    },
    communicationContext: {
      ...communicationContext,
      audienceType: cleanStringArray(communicationContext.audienceType),
      communicationStyle:
        normalizeContextText(communicationContext.communicationStyle) || '简洁直接',
      culturalContext: normalizeContextText(communicationContext.culturalContext),
      languagePreference:
        normalizeContextText(communicationContext.languagePreference) || '中英文混合',
      reportingFormat:
        normalizeContextText(communicationContext.reportingFormat) || '项目状态报告',
    },
    analysisPreferences: {
      ...analysisPreferences,
      messageAnalysis: {
        ...messageAnalysis,
        focusAreas: cleanStringArray(messageAnalysis.focusAreas),
        ignoredTopics: cleanStringArray(messageAnalysis.ignoredTopics),
        urgencyKeywords: cleanStringArray(messageAnalysis.urgencyKeywords),
      },
      projectAnalysis: {
        ...projectAnalysis,
        riskFactors: cleanStringArray(projectAnalysis.riskFactors),
        successCriteria: cleanStringArray(projectAnalysis.successCriteria),
        reviewCycle: normalizeContextText(projectAnalysis.reviewCycle) || 'weekly',
      },
    },
  };
};

export function sanitizeIndependentUserConfig(config: any): JsonRecord {
  const source = config || {};
  const customPrompts = source.customPrompts || {};

  return {
    ...source,
    preferenceInjection: sanitizePreferenceInjection(source.preferenceInjection),
    customPrompts: {
      ...customPrompts,
      message: sanitizePrompt(customPrompts.message),
      project: sanitizePrompt(customPrompts.project),
    },
    userContextConfig: sanitizeUserContextConfig(source.userContextConfig),
  };
}
