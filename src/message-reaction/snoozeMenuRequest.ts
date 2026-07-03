export interface SnoozeQuickMenuRequestState {
  requestSeq: number;
  currentSeq: number;
  activeAnchorMatches: boolean;
  anchorInDocument: boolean;
  anchorHovered: boolean;
  allowWithoutHover?: boolean;
  pickerOpen?: boolean;
}

export function shouldRenderSnoozeQuickMenuRequest({
  requestSeq,
  currentSeq,
  activeAnchorMatches,
  anchorInDocument,
  anchorHovered,
  allowWithoutHover = false,
  pickerOpen = false,
}: SnoozeQuickMenuRequestState): boolean {
  return (
    requestSeq === currentSeq &&
    activeAnchorMatches &&
    anchorInDocument &&
    (allowWithoutHover || anchorHovered) &&
    !pickerOpen
  );
}
