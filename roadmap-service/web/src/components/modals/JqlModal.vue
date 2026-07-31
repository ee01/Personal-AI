<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoadmapState } from '../../composables/useRoadmapState';

const state = useRoadmapState();
const jql = ref('');

watch(
  () => state.modals.value.jql,
  (open) => {
    if (open) jql.value = state.snapshot.value?.team.jql || '';
  },
);

async function save() {
  if (!jql.value.trim() || !state.snapshot.value) return;
  try {
    await state.applySnapshotFromIntent({
      op: 'update_jql',
      jql: jql.value.trim(),
    });
    state.modals.value.jql = false;
    state.toast('<span class="ok">✓</span> JQL 已更新，下次导入按新 JQL 执行');
  } catch {
    /* handled */
  }
}
</script>

<template>
  <div class="modal-back" :class="{ show: state.modals.value.jql }" @click.self="state.modals.value.jql = false">
    <div class="modal">
      <div class="m-head">
        <div class="m-title">编辑团队 JQL</div>
        <div class="m-sub">
          修改仅影响<b>之后的导入</b>；已导入数据与排期不受影响。
        </div>
      </div>
      <div class="m-body">
        <label class="f-label">数据源 JQL</label>
        <textarea v-model="jql" class="f-input" style="min-height: 140px" />
      </div>
      <div class="m-foot">
        <button class="btn btn-ghost" @click="state.modals.value.jql = false">取消</button>
        <button class="btn btn-primary" :disabled="!state.editable.value" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>
