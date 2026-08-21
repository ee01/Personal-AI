# Findings: Release 结束分割节点

## Confirmed behavior (before)
- `relSegments`: segment for release R_i starts at R_i's split date, ends at next release's split (or last phase +4d)
- UI foot already said「从它开始、到下一班的它结束」— matched code
- Tip label「作为 release 分割节点」was ambiguous about start vs end ownership

## Target behavior
- Segment for release R_i: `[prevSplit, thisSplit)` labeled as R_i
- Split marker is the exclusive end / handoff into the next release column
- Releases missing the split phase still do not get their own column

## Files
- `roadmap-service/web/src/composables/useReleaseRuler.ts` — core
- `roadmap-service/web/src/__tests__/useReleaseRuler.test.ts`
- `roadmap-service/web/src/components/modals/JqlModal.vue`
- `roadmap-service/web/src/components/GanttPanel.vue`
- `docs/features/personal_roadmap.md`
- `docs/demo/roadmap-demo.html`
