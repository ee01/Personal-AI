/** Glip's passive Lens card. Observes rendered messages without touching read state. */
import { isContextLensEnabledFromConfig } from './lensConfig';
import { CONFIG_LOCAL_STORAGE_KEY } from '../constants';
interface AttentionCard {
  id: string;
  postId: string;
  title: string;
  due_at: number;
  addressed_to: string;
  reasons_json: string;
  managerChip: boolean;
  sender_entity_id?: string;
}
const send = (request: Record<string, unknown>) =>
  new Promise<any>((resolve, reject) => {
    chrome.runtime.sendMessage(request, (result) => {
      if (chrome.runtime.lastError)
        reject(new Error(chrome.runtime.lastError.message));
      else if (!result?.success) reject(new Error(result?.error || '请求失败'));
      else resolve(result);
    });
  });
export function renderAttentionCard(host: Element, item: AttentionCard) {
  if (host.querySelector('.pai-attention-card')) return;
  const card = document.createElement('section');
  card.className = 'pai-attention-card';
  card.dataset.attentionId = item.id;
  card.setAttribute('aria-label', 'Memory Lens 注意力分诊');
  card.style.cssText =
    'margin:8px 0 8px 40px;padding:12px 14px;border:1px solid #cddbd8;border-left:3px solid #267a68;border-radius:8px;background:#f5faf8;color:#203d36;font:13px/1.5 system-ui;max-width:580px';
  const title = document.createElement('strong');
  title.textContent = `Memory Lens · 截止 ${new Date(
    item.due_at * 1000,
  ).toLocaleDateString('zh-CN')} · ${
    item.addressed_to === 'me' ? '给我的请求' : '群发含我'
  }`;
  const content = document.createElement('p');
  content.textContent = item.title;
  content.style.margin = '6px 0';
  const reasons = document.createElement('small');
  try {
    reasons.textContent = (JSON.parse(item.reasons_json) as string[])
      .map((r) =>
        r === 'matched_rule'
          ? '命中关注规则'
          : r === 'explicit_deadline'
          ? '消息含截止日期'
          : r.startsWith('sender_weight:')
          ? '结合发送者关系与互动频率'
          : r === 'me'
          ? '直接给我'
          : r === 'team_including_me'
          ? '面向所在团队'
          : r === 'default_workdays'
          ? '按工作日设置默认到期'
          : r,
      )
      .join(' · ');
  } catch {
    reasons.textContent = '请核对截止日和受众';
  }
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:9px';
  const receipt = document.createElement('p');
  receipt.setAttribute('role', 'status');
  receipt.style.margin = '6px 0 0';
  const button = (label: string, action: () => Promise<void>) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText =
      'cursor:pointer;padding:4px 9px;border:1px solid #a5bfb5;border-radius:5px;background:white;color:#225847';
    b.onclick = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const buttons = Array.from(card.querySelectorAll('button'));
      buttons.forEach((x) => (x.disabled = true));
      try {
        await action();
      } catch (error) {
        receipt.textContent = String((error as Error).message);
        buttons.forEach((x) => (x.disabled = false));
      }
    };
    controls.append(b);
    return b;
  };
  for (const [label, verdict] of [
    ['创建待办', 'accepted'],
    ['只创建提醒', 'remind'],
    ['已完成', 'completed'],
    ['不相关', 'not_relevant'],
  ]) {
    button(label, async () => {
      const result = await send({
        type: 'ATTENTION_DECISION',
        id: item.id,
        verdict,
      });
      const status = result.item?.status;
      receipt.textContent =
        status === 'armed'
          ? '已保存到任务中心；截止前两天、前一天和当天早晨提醒，间隔至少 24 小时。'
          : status === 'completed'
          ? '已标记完成，后续提醒已停止。'
          : status === 'dismissed'
          ? '已收下反馈，同一事项不再出卡。'
          : `当前状态：${status}`;
      controls.replaceChildren();
      if (status === 'armed')
        button('取消提醒', async () => {
          await send({
            type: 'ATTENTION_DECISION',
            id: item.id,
            verdict: 'cancelled',
          });
          receipt.textContent = '已取消，后续提醒已停止。';
          controls.replaceChildren();
        });
    });
  }
  if (item.managerChip) {
    const managerButton = button('确认发送者是我的上级', async () => {
      await send({
        type: 'ATTENTION_IDENTITY',
        id: item.id,
        key: 'manager',
        value: item.sender_entity_id,
      });
      receipt.textContent = '已保存你确认的上级关系。';
      managerButton.remove();
      card.querySelectorAll('button').forEach((b) => (b.disabled = false));
    });
    const roleButton = button('确认我的角色…', async () => {
      const value = window.prompt('你的工作角色（确认后写入画像）');
      if (value?.trim()) {
        await send({
          type: 'ATTENTION_IDENTITY',
          id: item.id,
          key: 'role',
          value: value.trim(),
        });
        receipt.textContent = '已保存你确认的角色。';
        roleButton.remove();
      }
      card.querySelectorAll('button').forEach((b) => (b.disabled = false));
    });
  }
  card.append(title, content, reasons, controls, receipt);
  // Card interactions must not reach the host's click-to-mark-read handlers.
  for (const event of ['click', 'mousedown', 'pointerdown'])
    card.addEventListener(event, (e) => e.stopPropagation());
  host.append(card);
}
export function initAttentionCards() {
  const visible = new Map<Element, number>();
  let enabled = true;
  let busy = false;
  let stopped = false;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5)
          visible.set(entry.target, Date.now());
        else visible.delete(entry.target);
      }
    },
    { threshold: 0.5 },
  );
  const watched = new WeakSet<Element>();
  const scan = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      const stored = await chrome.storage.local.get(CONFIG_LOCAL_STORAGE_KEY);
      enabled = isContextLensEnabledFromConfig(
        stored[CONFIG_LOCAL_STORAGE_KEY],
      );
      if (!enabled) {
        document
          .querySelectorAll('.pai-attention-card')
          .forEach((x) => x.remove());
        return;
      }
      document
        .querySelectorAll('.conversation-card-wrapper[data-id]')
        .forEach((el) => {
          if (!watched.has(el)) {
            watched.add(el);
            observer.observe(el);
          }
        });
      const hosts = [...visible]
        .filter(
          ([el, since]) =>
            el.isConnected &&
            Date.now() - since >= 1500 &&
            !el.querySelector('.pai-attention-card'),
        )
        .map(([el]) => el)
        .slice(0, 50);
      const postIds = hosts
        .map((el) => el.getAttribute('data-id'))
        .filter(Boolean);
      if (!postIds.length) return;
      const result = await send({ type: 'ATTENTION_LIST', postIds });
      for (const item of result.items ?? []) {
        const host = hosts.find(
          (el) => el.getAttribute('data-id') === item.postId,
        );
        if (host && visible.has(host)) renderAttentionCard(host, item);
      }
    } catch {
      /* Offline passive surface stays quiet. */
    } finally {
      busy = false;
    }
  };
  const interval = window.setInterval(() => void scan(), 5000);
  void scan();
  window.addEventListener(
    'pagehide',
    () => {
      stopped = true;
      window.clearInterval(interval);
      observer.disconnect();
      visible.clear();
    },
    { once: true },
  );
}
