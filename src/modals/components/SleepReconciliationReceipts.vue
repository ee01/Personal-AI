<template>
  <section class="sleep-receipts" aria-label="夜间记忆整理回执">
    <div class="receipt-heading"><h3>夜间记忆整理</h3><button :disabled="loading" @click="load">刷新</button></div>
    <details>
      <summary>上线人工验收样本</summary>
      <p>模型判决先隐藏。导出后根据原文给 expectedDecision 填 corroborate、refine、supersede、dispute 或 noop；不会自动应用到记忆。样本含私人原文，请在本地保管。</p>
      <button :disabled="!!busy" @click="exportSamples('B')">导出更新判决验收样本</button>
      <button :disabled="!!busy" @click="exportSamples('C')">导出矛盾判决验收样本</button>
      <p v-if="sampleMessage" role="status">{{ sampleMessage }}</p>
    </details>
    <article v-for="proposal in proposals" :key="proposal.id" class="sleep-receipt">
      <strong>待确认的长期偏好</strong><p>{{ proposal.value }}</p>
      <button :disabled="!!busy" @click="confirmProfile(proposal,true)">确认这条偏好</button>
      <button :disabled="!!busy" @click="confirmProfile(proposal,false)">不采纳</button>
    </article>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-else-if="loading">正在读取整理回执…</p>
    <p v-else-if="!receipts.length">暂无整理回执。夜间执行后会在这里显示；候选判决不会立即改变记忆。</p>
    <article v-for="receipt in receipts" :key="receipt.id" class="sleep-receipt">
      <div class="receipt-heading">
        <strong>{{ decisionLabel(receipt.decision) }}</strong>
        <span>{{ stateLabel(receipt.state) }}</span>
      </div>
      <p>{{ receipt.reason }}</p>
      <div v-for="(unit,index) in receipt.units" :key="unit.id" class="receipt-unit">
        <small>{{ index === 0 ? '较早记忆' : '较新记忆' }} · {{ date(unit.observedAt) }} · {{ unit.sourceCount }} 个来源</small>
        <p>{{ unit.text }}</p>
        <router-link v-for="source in unit.sources" :key="source.episodeId" :to="`/timeline?focus=${encodeURIComponent(source.episodeId)}`">查看原文</router-link>
      </div>
      <button v-if="receipt.state === 'applied' && receipt.decision !== 'noop'" :disabled="busy === receipt.id" @click="revert(receipt.id)">
        {{ busy === receipt.id ? '正在撤销…' : '撤销这次整理' }}
      </button>
    </article>
  </section>
</template>

<script setup lang="ts">
import { ref,onMounted } from 'vue';
import { getMemoryServiceClient,type SleepReconciliationReceipt } from '../../services/MemoryServiceClient';
const receipts=ref<SleepReconciliationReceipt[]>([]),loading=ref(false),error=ref(''),busy=ref('');
const sampleMessage=ref('');
const proposals=ref<Array<{id:string;value:string;revision:number}>>([]);
const decisionLabel=(value:string|null)=>({supersede:'新记录替代旧记录',corroborate:'独立来源加固',refine:'保留互补记忆',dispute:'记忆存在冲突',noop:'无需修改'}[value??'']??'等待判决');
const stateLabel=(value:string)=>({shadow:'候选判决，未改真值',applied:'已应用',reverted:'已撤销',stale:'版本已变化，未应用',failed:'未完成',deferred:'等待预算',judging:'正在判决'}[value]??value);
const date=(value:number|null)=>value?new Date(value*1000).toLocaleDateString():'时间未知';
async function load() {
  loading.value=true;error.value='';
  try {
    const client=getMemoryServiceClient();
    const [receiptResult,profileResult]=await Promise.all([client.getReconciliationReceipts(),client.getSleepProfileProposals()]);
    receipts.value=receiptResult.receipts;proposals.value=profileResult.proposals;
  }
  catch { error.value='整理回执暂时不可用，请确认 Memory Service 已更新后重试。'; }
  finally { loading.value=false; }
}
async function revert(id:string) {
  busy.value=id;error.value='';
  try { await getMemoryServiceClient().revertReconciliationReceipt(id);await load(); }
  catch { error.value='未撤销：记忆可能已有更新，或服务暂时不可用。请刷新查看，原文始终保留。'; }
  finally { busy.value=''; }
}
async function exportSamples(phase:'B'|'C') {
  busy.value='sample';sampleMessage.value='';
  try {
    const result=await getMemoryServiceClient().getReconciliationSamples(phase);
    sampleMessage.value=`当前可用 ${result.availablePairs}/${result.requiredPairs} 对；人工填写标签后再导入验收。`;
    if(!result.availablePairs) return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(result.labels,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`sleep-reconciliation-${phase}-human-labels.json`;
    document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  } catch {sampleMessage.value='样本暂时不可用，请稍后重试。';}
  finally {busy.value='';}
}
onMounted(load);
async function confirmProfile(proposal:{id:string;revision:number},accept:boolean) {
  busy.value=proposal.id;error.value='';
  try {await getMemoryServiceClient().confirmSleepProfileProposal(proposal.id,accept,proposal.revision);await load();}
  catch {error.value='偏好未更新：来源或版本可能已变化，请刷新后再试。';}
  finally {busy.value='';}
}
</script>

<style scoped>
.sleep-receipts {margin:20px 0;padding:16px;border:1px solid #d9dfe7;border-radius:8px;background:#fff;color:#233044;}
.receipt-heading {display:flex;justify-content:space-between;align-items:center;gap:12px;}
.receipt-heading h3 {margin:0;}.sleep-receipt {border-top:1px solid #e5e9ef;margin-top:12px;padding-top:12px;}
.receipt-unit {padding:8px 12px;margin:8px 0;background:#f5f7fa;border-radius:4px;}.receipt-unit p {white-space:pre-wrap;overflow-wrap:anywhere;}
.receipt-unit a {margin-right:12px;}small {color:#596579;}button {cursor:pointer;}button:disabled {cursor:wait;}
</style>
