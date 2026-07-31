<script setup lang="ts">
import { ref } from 'vue';

const open = ref(false);
</script>

<template>
  <button class="help-fab" @click.stop="open = !open">?</button>
  <div class="help-pop" :class="{ show: open }">
    <h4>使用说明</h4>
    <ul>
      <li><b>导入 / 创建 Jira 需要 Personal AI 扩展</b></li>
      <li>Bar 可<b>拖动 / 左右把手伸缩 / 上下换行</b>，按天吸附</li>
      <li><b>单击 bar 展开/收起</b>；<b>双击编辑备注名</b></li>
      <li>悬浮：bar <b>左侧 ＋ 添加任务</b>，<b>右上角 × 退回 Backlog</b></li>
      <li><b>人员视图</b>：按人查看任务（近 2 周 / 全部）</li>
      <li><b>清理过期</b>：过期 Epic 回退 Backlog，过期子任务从任务视图清理</li>
      <li>顶栏可<b>分享可编辑链接</b>或<b>只读链接</b>（无 token）</li>
      <li>颜色按「当前月」区分过去 / 当前 / 未来</li>
    </ul>
  </div>
</template>
