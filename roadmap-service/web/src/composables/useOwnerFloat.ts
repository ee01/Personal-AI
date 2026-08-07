import { clamp, initials } from './useGeometry';
import type { TeamMember } from '../types';

const PERSON_SVG =
  '<svg width="11" height="11" viewBox="0 0 14 14"><circle cx="7" cy="4.6" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.4 12.2c.7-2.4 2.5-3.6 4.6-3.6s3.9 1.2 4.6 3.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

export function personSvgHtml(): string {
  return PERSON_SVG;
}

export function memberChipHtml(member: TeamMember | null | undefined): string {
  if (!member) return PERSON_SVG;
  return `<span class="own-av" style="background:${member.avatarColor}">${escapeHtml(initials(member.name))}</span>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Fixed-position member picker (list + “new name” input), matching the demo.
 * `onPick(null)` clears the owner when `allowClear` is set.
 */
export function openOwnerFloat(
  anchor: HTMLElement,
  members: TeamMember[],
  currentName: string | null | undefined,
  onPick: (member: TeamMember | null) => void,
  opts: { allowClear?: boolean } = {},
): void {
  document.querySelectorAll('.owner-float').forEach((el) => el.remove());
  const pop = document.createElement('div');
  pop.className = 'owner-pop show owner-float';
  const r = anchor.getBoundingClientRect();
  pop.style.position = 'fixed';
  pop.style.left = `${clamp(r.left, 8, window.innerWidth - 230)}px`;
  pop.style.top = `${r.bottom + 6}px`;

  const clearRow =
    opts.allowClear && currentName
      ? `<div class="owner-item" data-clear><span class="own-av" style="background:#C6CDD4">–</span>移除 Owner</div>`
      : '';
  pop.innerHTML =
    clearRow +
    members
      .map(
        (m, i) =>
          `<div class="owner-item ${currentName && m.name === currentName ? 'act' : ''}" data-i="${i}">
        <span class="own-av" style="background:${m.avatarColor}">${escapeHtml(initials(m.name))}</span>${escapeHtml(m.name)}</div>`,
      )
      .join('') +
    `<div class="owner-new"><input placeholder="输入新成员名，Enter 添加…"></div>`;

  document.body.appendChild(pop);

  const close = () => {
    pop.remove();
    document.removeEventListener('pointerdown', onOutside, true);
  };
  const onOutside = (e: PointerEvent) => {
    if (!pop.contains(e.target as Node) && e.target !== anchor) close();
  };
  setTimeout(() => document.addEventListener('pointerdown', onOutside, true));

  pop.querySelectorAll('.owner-item').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if ((el as HTMLElement).hasAttribute('data-clear')) onPick(null);
      else {
        const idx = Number((el as HTMLElement).dataset.i);
        onPick(members[idx] || null);
      }
      close();
    });
  });

  const ni = pop.querySelector('.owner-new input') as HTMLInputElement;
  ni.addEventListener('pointerdown', (e) => e.stopPropagation());
  ni.onkeydown = (e) => {
    if (e.key === 'Enter' && ni.value.trim()) {
      const name = ni.value.trim();
      const existing = members.find(
        (m) => m.name.toLowerCase() === name.toLowerCase(),
      );
      onPick(
        existing || {
          id: '',
          name,
          avatarColor: '#8895A5',
        },
      );
      close();
    }
    if (e.key === 'Escape') close();
  };
}
