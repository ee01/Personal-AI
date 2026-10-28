import * as React from 'react';
import { useEffect, useState } from 'react';
import { getJiraAutomationRuleUrl } from '../botAutomationConfig';
import { calculateScheduledMessageNextExecution } from '../scheduleNextExecution';
import { formatLocalScheduleDate } from '../scheduleDateTime';
import { ScheduledMessage, SheetConfig } from '../types';
import { GOOGLE_AUTH_SCOPE_SETS, getGoogleAuthToken } from '../../utils/googleAuth';
import { ScheduledMessagesUpgrade, UpgradeDraft, UPGRADE_DRAFT_KEY, probeRuntime } from '../ScheduledMessagesUpgrade';
import { ImportPreview, compatibleRuntime, inspectUpgradeRows } from '../upgradeContracts';

interface Props { config: SheetConfig; onCompatibility: (ready: boolean) => void; }
const panel: React.CSSProperties = { margin: '16px 0', padding: 20, background: '#fff8eb', border: '1px solid #c8a65d', borderRadius: 10, color: '#302b24', fontSize: 14, lineHeight: 1.65 };
const button: React.CSSProperties = { margin: '8px 12px 8px 0', padding: '8px 14px', cursor: 'pointer' };
const DISMISSED_RECEIPT_KEY = 'scheduledMessagesUpgradeDismissedReceipt';

function nextPlan(preview: ImportPreview): string {
  const now = new Date();
  const today = formatLocalScheduleDate(now);
  const plans: string[] = [];
  let queued = false;
  let timeline = false;
  for (const row of preview.rows.slice(1)) {
    const fields = Object.fromEntries(preview.rows[0].map((column, i) => [column, row[i] || '']));
    if (fields.Status !== 'Active') continue;
    if (fields.Last_Exec.startsWith(today) && /✅/.test(fields.Exec_Log)) continue;
    if (fields.Timeline_Milestone) { timeline = true; continue; }
    const message = { ...fields, Repeat_Every: Number(fields.Repeat_Every), Repeat_Count: Number(fields.Repeat_Count), Exec_Count: Number(fields.Exec_Count) } as unknown as ScheduledMessage;
    const next = calculateScheduledMessageNextExecution(message, now);
    const time = Date.parse(next.replace(' ', 'T'));
    if (Number.isFinite(time) && time >= now.getTime()) plans.push(next);
    else if (Number.isFinite(time) && (now.getTime() - time <= 30 * 60 * 1000 || !fields.Schedule_Time)) queued = true;
  }
  return queued ? '已有到期任务，等待下一轮实际领取' : plans.sort()[0] || (timeline ? '等待 Timeline 缓存刷新后匹配' : '暂无未来计划，请检查新表');
}

export const UpgradeWizard: React.FC<Props> = ({ config, onCompatibility }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<UpgradeDraft | null>(null);
  const [health, setHealth] = useState('正在检查表与运行账本…');
  const [ready, setReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [manual, setManual] = useState(false);
  const [recoveryId, setRecoveryId] = useState('');
  const [receipt, setReceipt] = useState('尚无新表真实领取回执');
  const [timelineReceipt, setTimelineReceipt] = useState('新表 Timeline 缓存尚未核验；请手动运行同步规则后检查，期间里程碑任务可能延迟或错过。');

  const check = async () => {
    // The probe runs in the background: never block the manager while it is
    // pending, and only surface the panel (and read-only mode) once the check
    // concludes that this table is not compatible.
    try {
      const result = await probeRuntime(config);
      const compatible = compatibleRuntime(result, config.sheetId);
      setReady(compatible); onCompatibility(compatible);
      setHealth(compatible ? '当前表运行就绪' : result.error || `账本状态：${result.mode || '未知'}，需要创建兼容新表`);
    } catch (e) {
      setHealth('无法连接运行检查。可能是网络或授权问题，请先重试；当前页面只读。');
      setReady(false); onCompatibility(false);
    }
  };
  useEffect(() => {
    void check();
    void chrome.storage.local.get([UPGRADE_DRAFT_KEY, DISMISSED_RECEIPT_KEY]).then(result => {
      const saved = result[UPGRADE_DRAFT_KEY] as UpgradeDraft | undefined;
      if (saved && (saved.source.sheetId === config.sheetId || saved.candidate.sheetId === config.sheetId)) {
        setDraft(saved); setOpen(saved.stage !== 'complete' || result[DISMISSED_RECEIPT_KEY] !== saved.id);
      }
    });
  }, [config.sheetId]);

  const run = async (work: (service: ScheduledMessagesUpgrade) => Promise<void>) => {
    setBusy(true); setError('');
    let service: ScheduledMessagesUpgrade | undefined;
    try {
      await navigator.locks.request('scheduled-messages-upgrade-ui', { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('另一个窗口正在处理升级，请等待该窗口完成');
        const token = await getGoogleAuthToken({ scopes: [...GOOGLE_AUTH_SCOPE_SETS.IDENTITY, ...GOOGLE_AUTH_SCOPE_SETS.APPS_SCRIPT_ADMIN], caller: 'ScheduledMessages.upgrade' });
        if (!token) throw new Error('请完成 Google 授权后重试');
        const stored = (await chrome.storage.local.get(UPGRADE_DRAFT_KEY))[UPGRADE_DRAFT_KEY] as UpgradeDraft | undefined;
        if (stored && stored.source.sheetId !== config.sheetId && stored.candidate.sheetId !== config.sheetId && stored.stage !== 'complete') throw new Error('另一张表有尚未完成的升级，请先处理原向导');
        const current = stored && (stored.source.sheetId === config.sheetId || stored.candidate.sheetId === config.sheetId)
          ? stored : { id: crypto.randomUUID(), source: config, candidate: {}, token: crypto.randomUUID(), stage: 'create' as const };
        service = new ScheduledMessagesUpgrade(token, current);
        await service.save();
        await work(service);
      });
    } catch (e) {
      setError(e.message || '操作失败');
      if (service) await service.save({ error: e.message });
    } finally {
      if (service) setDraft({ ...service.draft });
      setBusy(false);
    }
  };

  if (ready !== false && !open) return null;
  return <section aria-label="新表升级向导" style={panel}>
    <strong>{ready === true || draft?.stage === 'complete' ? '新表升级收据' : '当前表只读 · 升级到兼容新表'}</strong>
    <p role="status">{draft?.stage === 'complete' ? `已有切换记录。${health}` : health}</p>
    {!open && <>
      <button style={button} onClick={() => setOpen(true)}>{draft?.stage === 'complete' ? '查看升级收据与修复' : '开始新表升级'}</button>
      <button style={button} onClick={check}>重新检查连接</button>
      <p>旧表与旧 Jira 不会因打开此页而停用。可以继续查看和导出原表。</p>
      <a href={config.sheetUrl} target="_blank" rel="noreferrer">查看旧 Google Sheet</a>
    </>}
    {open && <>
      <p>1 创建新表 → 2 带入消息 → 3 切换 → 4 完成</p>
      <p>保留旧历史；不转换执行账本。整行复制可保留当天成功记录与执行次数，但复制后仍可能有在途发送。没有时间的消息可能全天重发，不能承诺零重复。</p>
      {(!draft || draft.stage === 'create') && <>
        <h3>1. 创建并授权待接管新表</h3>
        <p>新表仅自己可访问，不建立发送触发器，不更换当前配置。</p>
        <button disabled={busy} style={button} onClick={() => run(async service => { await service.create(); })}>{draft?.candidate.sheetId ? '继续准备同一张新表' : '创建新表'}</button>
        {draft?.candidate.pendingCreation && <div>
          <p>创建请求结果未确认。请在 Google 中查找名称包含 [Upgrade {draft.id}] 的新表/项目。不会自动重复创建。</p>
          <input aria-label="恢复资源 ID" value={recoveryId} onChange={e => setRecoveryId(e.target.value.trim())} />
          <button disabled={busy || !recoveryId} style={button} onClick={() => run(async service => { await service.reconcileCreation(recoveryId); })}>恢复已创建资源</button>
          <button disabled={busy} style={button} onClick={() => {
            if (window.confirm('请先在 Google 中确认本次新资源确实没有创建。确认后才允许重新发起创建；结果不明时应恢复已有资源 ID。')) void run(async service => { await service.save({ candidate: { ...service.draft.candidate, pendingCreation: undefined } }); });
          }}>已核实未创建，允许重试</button>
        </div>}
        {draft?.candidate.sheetUrl && <a href={draft.candidate.sheetUrl} target="_blank" rel="noreferrer">查看新表</a>}
        {draft?.candidate.webAppUrl && <div>
          <a href={`${draft.candidate.webAppUrl}?action=authSuccess`} target="_blank" rel="noreferrer">打开 Google 授权页面</a>
          <button disabled={busy} style={button} onClick={() => run(async service => { await service.prepare(); })}>已授权，检查新表</button>
        </div>}
      </>}
      {draft?.stage === 'import' && <>
        <h3>2. 带入消息</h3>
        <p>可自动复制原表 Messages 全行；或在旧表复制含表头的全部列，按值粘贴到新表 Messages，保留 Last_Exec、Exec_Log、Exec_Count。不要复制 Config 或隐藏账本。</p>
        <a href={draft.source.sheetUrl} target="_blank" rel="noreferrer">打开旧表</a>{' · '}
        <a href={draft.candidate.sheetUrl} target="_blank" rel="noreferrer">打开新表</a>
        <p>自动复制会将待确认消息设为 Paused；手动复制也请先暂停这些行。</p>
        <button disabled={busy} style={button} onClick={() => run(async service => { await service.importFromSource(); setPreview(await service.inspect()); })}>自动带入并检查</button>
        <button disabled={busy} style={button} onClick={() => run(async service => { setPreview(await service.inspect()); })}>已手动粘贴，检查</button>
      </>}
      {draft?.stage === 'switch' && <>
        <h3>3. 切换到新表</h3>
        {preview && <p>检查通过：{preview.rows.length - 1} 条；保留成功记录 {preview.sent.length} 条；隔离待确认 {preview.pending.length} 条。{preview.warnings.join('；')}</p>}
        <button disabled={busy} style={button} onClick={() => run(async service => { setPreview(await service.inspect()); })}>重新读取消息预览</button>
        {preview && <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}>
          <thead><tr><th>消息</th><th>计划时间</th><th>最近执行</th><th>新表处理</th></tr></thead>
          <tbody>{preview.rows.slice(1).filter(row => row.some(Boolean)).map(row => {
            const get = (column: string) => row[preview.rows[0].indexOf(column)] || '';
            const id = get('ID');
            return <tr key={id}><td>{get('Topic') || id}</td><td>{get('Schedule_Time') || '未设时间（全天兜底）'}</td><td>{get('Last_Exec')} {get('Exec_Log')}</td>
              <td>{preview.pending.includes(id) ? '暂停，等待人工核对' : preview.sent.includes(id) ? '保留成功日期，按当日记录去重' : get('Status') === 'Active' ? '按原计划匹配（包含过去 30 分钟补偿）' : '保留原状态'}</td></tr>;
          })}</tbody>
        </table></div>}
        <ol><li>停用旧项目的发送触发器并核对回执，旧固定 Web App 保留接收确认。</li><li>短暂停止原 Jira 执行与 Timeline 规则，替换全部领取、确认和缓存地址，回读检查。</li><li>启用新表，恢复原规则状态，保存当前扩展配置。</li></ol>
        <p>自动导入会在 Jira 暂停后重新带入源表；手动导入需在停旧触发器后再次核对源表。跨午夜、超过 30 分钟或尚未确认的任务可能漏发或重复，请核对后补发。</p>
        <button disabled={busy || draft.retired} style={button} onClick={() => run(async service => {
          const retired = await service.retire();
          if (!retired) throw new Error('退役代码已写入，等待旧触发器下一次运行产生回执（通常约一分钟），再点击核对。尚未切换 Jira。');
        })}>{draft.retired ? '旧发送触发器已核对' : '停用旧触发器 / 核对回执'}</button>
        <details><summary>没有项目权限或旧项目没有运行中的触发器</summary>
          <a href={draft.source.scriptId ? `https://script.google.com/home/projects/${draft.source.scriptId}/triggers` : 'https://script.google.com/home/triggers'} target="_blank" rel="noreferrer">打开旧项目触发器列表</a>
          <p>删除发送触发器；核对其他创建者账号与已开始的执行。手动声明不是系统检测结果。</p>
          <label><input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)} />我已核实旧发送触发器停用，并检查其他账号及在途执行</label>
          <button disabled={busy || !manual} style={button} onClick={() => run(async service => { await service.save({ manualRetired: true, retired: true }); })}>记录人工核验</button>
        </details>
        <label style={{ display: 'block' }}><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />我已核对导入、所有账号旧触发器及在途发送状态，接受切换期间短暂延迟、漏发/重复风险，并授权更新原 Jira 规则及启用新表</label>
        <button disabled={busy || !draft.retired || !acknowledged} style={button} onClick={async () => {
          let completed = false;
          await run(async service => { await service.cutover(); completed = true; });
          // The manager and its service still point at the source until reloaded.
          // Reload only after the complete draft and active config are persisted.
          if (completed) window.location.reload();
        }}>切换到新表</button>
        <button disabled={busy || !!draft.cutoverAt} style={button} onClick={() => run(async service => { await service.save({ stage: 'import' }); })}>返回检查消息</button>
      </>}
      {draft?.stage === 'complete' && <>
        <h3>4. 新表已接管</h3>
        <p>若完成记录仍引用 HEAD 测试部署，可在原新表上修复。会核验正式部署并同步 Config、扩展和 Jira，短暂停止后恢复原规则；不会重新导入消息或清空执行账本。</p>
        <button disabled={busy} style={button} onClick={async () => {
          onCompatibility(false); setReady(false); setHealth('正在修复部署和引用，管理暂时只读…');
          let completed = false;
          await run(async service => { await service.cutover(); completed = true; });
          if (completed) window.location.reload();
          else setHealth('修复未完成，请处理下方错误后继续；管理保持只读。');
        }}>修复部署和引用（保留新表数据）</button>
        <p>切换时间：{draft.cutoverAt}。Jira 地址已回读验证；真实下游送达仍以消息确认和 Logs 为准。</p>
        <p>{receipt}</p>
        {draft.source.botAutomation?.timelineSyncRule && <div>
          <p>{timelineReceipt}</p>
          <a href={getJiraAutomationRuleUrl(draft.source.botAutomation.timelineSyncRule)} target="_blank" rel="noreferrer">打开原 Timeline Sync Rule，手动运行一次</a>
          <button disabled={busy} style={button} onClick={async () => {
            try {
              const response = await fetch(`${draft.candidate.webAppUrl}?action=getTimelineCacheStatus`);
              if (!response.ok) throw new Error('Timeline 缓存读取失败');
              const status = await response.json();
              setTimelineReceipt(status.success && Array.isArray(status.projects) && status.projects.length && status.projects.every((project: { status?: string }) => project.status === 'ready')
                ? 'Timeline 缓存已回读就绪；仍按各消息日期与里程碑规则匹配。'
                : 'Timeline 缓存尚未完整就绪，请检查同步规则审计和各项目返回结果。');
            } catch (e) { setError(e.message); }
          }}>检查 Timeline 缓存</button>
        </div>}
        <a href={draft.candidate.sheetUrl} target="_blank" rel="noreferrer">查看新表与隔离任务</a>{' · '}
        <a href={draft.source.sheetUrl} target="_blank" rel="noreferrer">查看旧表历史</a>
        <p>⏳ 消息保持 Paused。先核对旧表确认与接收端，再选择“已发出”或“现在补发”。补发会创建一条立即到期的新任务，可能实际发送或启动 Agent；原行仍保持暂停。</p>
        <button disabled={busy} style={button} onClick={() => run(async service => { setPreview(inspectUpgradeRows(await service.readRows(service.draft.candidate.sheetId!))); })}>读取隔离任务与下一次计划</button>
        {preview && <>
          <p>下一次计划：{nextPlan(preview)}</p>
          {preview.pending.map(id => <div key={id}>
            <strong>{id}</strong>{' '}<span>{draft.resolvedPending?.[id] || '发送结果未知'}</span>
            {!draft.resolvedPending?.[id] && <>
              <button disabled={busy} style={button} onClick={() => {
                if (window.confirm('确认接收端已经收到这次消息？将记录人工成功并恢复未来周期；单次任务标为 Done。')) void run(async service => { await service.resolvePending(id, 'sent'); });
              }}>已发出</button>
              <button disabled={busy} style={button} onClick={() => {
                if (window.confirm('确认现在创建一条补发任务？会实际发送或启动 Agent，旧执行若迟到可能重复。')) void run(async service => { await service.resolvePending(id, 'resend'); });
              }}>现在补发</button>
            </>}
          </div>)}
        </>}
        <button disabled={busy} style={button} onClick={async () => {
          try { const result = await probeRuntime(draft.candidate as SheetConfig); setReceipt(result.firstPollAt ? `首次真实领取：${result.firstPollAt}` : '尚无真实领取；可能暂无到期任务，请检查 Jira 审计与新表 Logs'); } catch (e) { setError(e.message); }
        }}>检查真实领取回执</button>
        <button style={button} onClick={() => window.location.reload()}>进入新表管理</button>
      </>}
      {busy && <p role="status">正在执行，请勿重复操作…</p>}
      {error && <p role="alert">{error}{draft?.retirementWritten || draft?.cutoverAt ? ' 旧触发器可能已停用或 Jira 已部分切换，请从当前步骤继续，不要直接恢复旧发送。' : ' 当前扩展配置尚未切换。'}</p>}
      <button disabled={busy} style={button} onClick={async () => {
        if (draft?.stage === 'complete') await chrome.storage.local.set({ [DISMISSED_RECEIPT_KEY]: draft.id });
        setOpen(false);
      }}>收起向导（保留进度）</button>
    </>}
  </section>;
};
