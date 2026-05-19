import type { ProjectAnalysisResult } from '../interfaces/analysisInterfaces';
import type { ProjectData, ProjectUpdateSuggestion } from '../slide';
import {
  containsSuggestionText,
  getNewSuggestionText,
  joinSuggestionText,
  normalizeComparableText,
} from './slidesAnalyzerSuggestions';

export function isWritableSlideColumnIndex(columnIndex: unknown): columnIndex is number {
  return Number.isInteger(columnIndex) && (columnIndex as number) >= 0;
}

function normalizeSuggestedField(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function hasMeaningfulChange(currentValue: unknown, suggestedValue: string | undefined): boolean {
  if (!suggestedValue) {
    return false;
  }

  return normalizeComparableText(currentValue) !== normalizeComparableText(suggestedValue);
}

function createBaseProjectSuggestion(
  project: ProjectData,
  result: ProjectAnalysisResult,
): ProjectUpdateSuggestion {
  return {
    projectId: project.id,
    projectName: project.name,
    currentStatus: project.status,
    currentOwner: project.owner,
    currentTrack: project.track,
    currentComments: project.comments,
    reason: Array.isArray(result.suggestions.risks) ? result.suggestions.risks : [],
    sourceInfo: {
      jiraIssues: result.jiraIssues ? Object.values(result.jiraIssues) : [],
      chatHistory: []
    },
    confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
    slideId: project.slideId,
    tableId: project.tableId,
    rowIndex: project.row,
    columnIndices: {
      status: project.columnIndices?.status,
      owner: project.columnIndices?.owner,
      track: project.columnIndices?.track,
      comments: project.columnIndices?.comments
    }
  };
}

export function createProjectReviewSuggestion(
  project: ProjectData,
  result: ProjectAnalysisResult,
): ProjectUpdateSuggestion {
  return createBaseProjectSuggestion(project, result);
}

export function createProjectUpdateSuggestion(
  project: ProjectData,
  result: ProjectAnalysisResult,
): ProjectUpdateSuggestion | null {
  const suggestedStatus = normalizeSuggestedField(result.suggestions.status);
  const suggestedOwner = normalizeSuggestedField(result.suggestions.owner);
  const suggestedTrack = normalizeSuggestedField(result.suggestions.track);
  const suggestedComments = normalizeSuggestedField(getNewSuggestionText(
    project.comments,
    joinSuggestionText(
      result.suggestions.highlights,
      result.suggestions.actionItems,
    ),
  ));
  const suggestedCommentsReason = suggestedComments ? joinSuggestionText(
    result.suggestions.highlightsReason,
    result.suggestions.actionItemsReason,
  ) : '';

  const needsStatusUpdate = Boolean(
    hasMeaningfulChange(project.status, suggestedStatus),
  );
  const needsOwnerUpdate = Boolean(
    hasMeaningfulChange(project.owner, suggestedOwner),
  );
  const needsTrackUpdate = Boolean(
    hasMeaningfulChange(project.track, suggestedTrack),
  );
  const needsCommentsUpdate = Boolean(
    suggestedComments && !containsSuggestionText(project.comments, suggestedComments),
  );

  if (!needsStatusUpdate && !needsOwnerUpdate && !needsTrackUpdate && !needsCommentsUpdate) {
    return null;
  }

  const suggestion = createBaseProjectSuggestion(project, result);

  if (needsStatusUpdate && suggestedStatus) {
    suggestion.suggestedStatus = suggestedStatus;
    suggestion.suggestedStatusReason = result.suggestions.statusReason || '';
  }

  if (needsOwnerUpdate && suggestedOwner) {
    suggestion.suggestedOwner = suggestedOwner;
    suggestion.suggestedOwnerReason = result.suggestions.ownerReason || '';
  }

  if (needsTrackUpdate && suggestedTrack) {
    suggestion.suggestedTrack = suggestedTrack;
    suggestion.suggestedTrackReason = result.suggestions.trackReason || '';
  }

  if (needsCommentsUpdate && suggestedComments) {
    suggestion.suggestedComments = suggestedComments;
    suggestion.suggestedCommentsReason = suggestedCommentsReason;
  }

  return suggestion;
}
