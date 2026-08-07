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
      <li><b>单击 bar 展开/收起</b>；<b>双击编辑备注名</b>（子任务可改 Owner）</li>
      <li>添加任务：左侧头像点选，或标题里输入 <b>@</b> 指定 Owner（可选）</li>
      <li>悬浮：bar <b>左侧 ＋ 添加任务</b>，<b>右侧 ◆＋ 阶段节点/外部依赖</b>，<b>右上角 × 退回 Backlog</b></li>
      <li><b>阶段节点</b>与有 ETA 的依赖落在标记轨；缺 ETA 时红色 🔗 角标持续提醒</li>
      <li><b>人员视图</b>：按人查看任务（近 2 周 / 全部）；双击改名、添加/移除空闲成员</li>
      <li><b>清理过期</b>：过期 Epic 回退 Backlog；过期子任务标记清理（可再拖回还原）</li>
      <li><b>发布时间表标尺</b>：✎ 弹窗可配置 Google Sheet（Release / Phase / Date）；可用 Release 过滤去掉小版本；保存后主标尺换成发布 Sprint，工具栏可临时切回月份</li>
      <li>顶栏可<b>分享可编辑链接</b>或<b>只读链接</b>（无 token）</li>
      <li>颜色按「当前月」区分过去 / 当前 / 未来</li>
    </ul>
  </div>
</template>
