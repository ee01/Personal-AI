export const USER_CONFIG_PROMPT_CHAR_LIMIT = 1500;

type JsonRecord = Record<string, any>;

const cleanString = (value: any): string => (
  typeof value === 'string' ? value.trim() : ''
);

export const normalizePromptContent = (value: any): string => {
  const content = cleanString(value);
  return content.length > USER_CONFIG_PROMPT_CHAR_LIMIT
    ? content.slice(0, USER_CONFIG_PROMPT_CHAR_LIMIT)
    : content;
};

const cleanStringArray = (value: any): string[] => (
  Array.isArray(value)
    ? value.map(cleanString).filter(Boolean)
    : cleanString(value)
      ? [cleanString(value)]
      : []
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

const sanitizeStakeholders = (stakeholders: any): JsonRecord => ({
  ...(stakeholders || {}),
  directManager: cleanString(stakeholders?.directManager),
  reportingFrequency: cleanString(stakeholders?.reportingFrequency) || '每周',
  keyStakeholders: Array.isArray(stakeholders?.keyStakeholders)
    ? stakeholders.keyStakeholders
        .map((item: any) => ({
          name: cleanString(item?.name),
          position: cleanString(item?.position),
          relationship: cleanString(item?.relationship),
          priority: cleanString(item?.priority),
        }))
        .filter(hasStakeholderValue)
        .map((item: JsonRecord) => ({
          ...item,
          priority: item.priority || 'medium',
        }))
    : [],
});

const sanitizeTeamInfo = (teamInfo: any): JsonRecord => ({
  ...(teamInfo || {}),
  teamName: cleanString(teamInfo?.teamName),
  teamMission: cleanString(teamInfo?.teamMission),
  teamSize: Math.max(0, Number(teamInfo?.teamSize) || 0),
  members: Array.isArray(teamInfo?.members)
    ? teamInfo.members
        .map((item: any) => ({
          name: cleanString(item?.name),
          position: cleanString(item?.position),
          role: cleanString(item?.role),
          speciality: cleanString(item?.speciality),
        }))
        .filter(hasAnyValue)
    : [],
  workingHours: cleanString(teamInfo?.workingHours),
  timezone: cleanString(teamInfo?.timezone) || 'GMT+8',
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
      name: cleanString(personalInfo.name),
      email: cleanString(personalInfo.email),
      title: cleanString(personalInfo.title),
      department: cleanString(personalInfo.department),
      location: cleanString(personalInfo.location),
      timezone: cleanString(personalInfo.timezone) || 'GMT+8',
    },
    stakeholders: sanitizeStakeholders(userContext.stakeholders),
    teamInfo: sanitizeTeamInfo(userContext.teamInfo),
    workFocus: {
      ...workFocus,
      primaryConcerns: cleanStringArray(workFocus.primaryConcerns),
      businessDomains: cleanStringArray(workFocus.businessDomains),
      keyMetrics: cleanStringArray(workFocus.keyMetrics),
      riskTolerance: cleanString(workFocus.riskTolerance) || 'medium',
    },
    communicationContext: {
      ...communicationContext,
      audienceType: cleanStringArray(communicationContext.audienceType),
      communicationStyle:
        cleanString(communicationContext.communicationStyle) || '简洁直接',
      culturalContext: cleanString(communicationContext.culturalContext),
      languagePreference:
        cleanString(communicationContext.languagePreference) || '中英文混合',
      reportingFormat:
        cleanString(communicationContext.reportingFormat) || '项目状态报告',
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
        reviewCycle: cleanString(projectAnalysis.reviewCycle) || 'weekly',
      },
    },
  };
};

export function sanitizeIndependentUserConfig(config: any): JsonRecord {
  const source = config || {};
  const customPrompts = source.customPrompts || {};

  return {
    ...source,
    customPrompts: {
      ...customPrompts,
      message: sanitizePrompt(customPrompts.message),
      project: sanitizePrompt(customPrompts.project),
    },
    userContextConfig: sanitizeUserContextConfig(source.userContextConfig),
  };
}
