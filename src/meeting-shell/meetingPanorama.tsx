import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSafeExternalUrl } from '../modals/topic-link-safety';
import { getMemoryServiceClient } from '../services/MemoryServiceClient';
import { getEnvConfig } from '../utils';
import { getDemoMeetingSessionSnapshot } from './demo';
import {
  MeetingPilotActionItem,
  MeetingPilotSessionSnapshot,
  MeetingPilotParticipantStance,
  createMeetingPilotSessionSnapshot,
} from './protocol';
import { TierBadge } from './components/TierBadge';
import { useMeetingPilotState } from './useMeetingPilotState';

const panoramaStyle = `
  :root {
    --bg: #0b0d14;
    --surface: #141720;
    --surface-2: #1c2030;
    --surface-3: #252a3a;
    --border: #2a2f42;
    --text: #e8eaf0;
    --text-dim: #7c819a;
    --text-muted: #4e5268;
    --accent: #6c5ce7;
    --accent-light: #a29bfe;
    --gradient-start: #6c5ce7;
    --gradient-end: #a29bfe;
    --p0: #ff6b6b;
    --p1: #ffd43b;
    --p2: #69db7c;
    --blue: #74b9ff;
    --orange: #ffa502;
    --teal: #00cec9;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    line-height: 1.5;
  }
  #meeting-panorama-root { min-height: 100vh; }
  .entry-banner {
    background: linear-gradient(90deg,rgba(108,92,231,0.12),rgba(162,155,254,0.06));
    border-bottom: 1px solid rgba(108,92,231,0.2);
    padding: 8px 32px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: #8b8fa3;
  }
  .synced-pill {
    margin-left: auto;
    padding: 3px 10px;
    border-radius: 6px;
    background: rgba(105,219,124,0.12);
    color: #69db7c;
    font-weight: 600;
    font-size: 11px;
  }
  .page-header {
    position: sticky;
    top: 0;
    z-index: 20;
    background: rgba(11, 13, 20, 0.85);
    backdrop-filter: blur(16px) saturate(1.8);
    border-bottom: 1px solid var(--border);
    padding: 16px 32px;
    display: flex;
    align-items: flex-start;
    gap: 16px;
  }
  .logo {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 2px 16px rgba(108, 92, 231, 0.4);
  }
  .header-info { display: flex; flex-direction: column; gap: 2px; }
  .header-info h1 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--text), var(--accent-light));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .header-meta { display: flex; gap: 16px; font-size: 12px; color: var(--text-dim); margin-top: 2px; flex-wrap: wrap; }
  .header-meta span { display: flex; align-items: center; gap: 4px; }
  .header-actions { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
  .header-copy-state {
    min-width: 88px;
    align-self: center;
    color: var(--text-dim);
    font-size: 11px;
    text-align: right;
  }
  .header-btn {
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-dim);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
  }
  .header-btn:hover {
    background: var(--surface-3);
    color: var(--text);
    border-color: var(--accent);
  }
  .header-btn.primary {
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    border-color: transparent;
    color: white;
  }
  .header-btn.primary:hover {
    opacity: 0.92;
    box-shadow: 0 2px 16px rgba(108, 92, 231, 0.4);
  }
  .stats-strip {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
    padding: 20px 32px;
    border-bottom: 1px solid var(--border);
    background: rgba(11, 13, 20, 0.38);
  }
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px 16px;
    position: relative;
    overflow: hidden;
    transition: all 0.3s;
    animation: fadeInUp 0.5s ease-out both;
  }
  .stat-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  .stat-card::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 3px; }
  .stat-card:nth-child(1)::before { background: linear-gradient(90deg, var(--accent), var(--accent-light)); }
  .stat-card:nth-child(2)::before { background: linear-gradient(90deg, var(--teal), #55efc4); }
  .stat-card:nth-child(3)::before { background: linear-gradient(90deg, var(--orange), #ffd43b); }
  .stat-card:nth-child(4)::before { background: linear-gradient(90deg, var(--p0), #fab1a0); }
  .stat-card:nth-child(5)::before { background: linear-gradient(90deg, var(--blue), #81ecec); }
  .stat-card:nth-child(1) { animation-delay: 0.05s; }
  .stat-card:nth-child(2) { animation-delay: 0.1s; }
  .stat-card:nth-child(3) { animation-delay: 0.15s; }
  .stat-card:nth-child(4) { animation-delay: 0.2s; }
  .stat-card:nth-child(5) { animation-delay: 0.25s; }
  .stat-label { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-value { font-size: 24px; font-weight: 800; margin: 4px 0 2px; }
  .stat-unit { font-size: 14px; color: var(--text-dim); font-weight: 500; }
  .stat-sub { font-size: 11px; color: var(--text-muted); }
  .main-layout { display: grid; grid-template-columns: 1fr 340px; gap: 0; min-height: calc(100vh - 180px); }
  .main-content { padding: 24px 32px; border-right: 1px solid var(--border); overflow-y: auto; }
  .sidebar { padding: 24px 20px; overflow-y: auto; max-height: calc(100vh - 180px); scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
  .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .section-header h2 { margin: 0; font-size: 15px; font-weight: 700; }
  .count { font-size: 11px; background: var(--surface-3); padding: 2px 8px; border-radius: 10px; color: var(--text-dim); }
  .energy-chart { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; }
  .energy-canvas-wrap { position: relative; height: 120px; margin-bottom: 8px; }
  canvas#energyCanvas { width: 100%; height: 100%; border-radius: 8px; }
  .energy-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); }
  .heatmap-row { display: flex; gap: 2px; margin-top: 12px; }
  .heatmap-cell { flex: 1; height: 28px; border-radius: 4px; position: relative; transition: all 0.2s; cursor: pointer; }
  .heatmap-cell:hover { transform: scaleY(1.25); z-index: 1; }
  .heatmap-legend { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 11px; color: var(--text-muted); }
  .heatmap-legend-gradient { width: 80px; height: 8px; border-radius: 4px; background: linear-gradient(90deg, rgba(108, 92, 231, 0.1), rgba(108, 92, 231, 0.4), var(--accent), var(--p0)); }
  .timeline { position: relative; padding-left: 32px; }
  .timeline::before { content: ''; position: absolute; left: 11px; top: 8px; width: 2px; height: calc(100% - 16px); background: linear-gradient(180deg, var(--accent), var(--border)); }
  .timeline-item { position: relative; margin-bottom: 20px; animation: tl-in 0.5s ease-out both; }
  .timeline-item:nth-child(1) { animation-delay: 0.1s; }
  .timeline-item:nth-child(2) { animation-delay: 0.2s; }
  .timeline-item:nth-child(3) { animation-delay: 0.3s; }
  .timeline-item:nth-child(4) { animation-delay: 0.4s; }
  .timeline-item:nth-child(5) { animation-delay: 0.5s; }
  @keyframes tl-in {
    from { opacity: 0; transform: translateX(-12px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .timeline-dot { position: absolute; left: -27px; top: 14px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid; background: var(--bg); }
  .timeline-item.topic .timeline-dot { border-color: var(--accent); box-shadow: 0 0 8px rgba(108, 92, 231, 0.4); }
  .timeline-item.action .timeline-dot { border-color: var(--orange); box-shadow: 0 0 8px rgba(255, 165, 2, 0.3); }
  .timeline-item.decision .timeline-dot { border-color: var(--teal); box-shadow: 0 0 8px rgba(0, 206, 201, 0.3); }
  .timeline-item.mention .timeline-dot { border-color: var(--p0); box-shadow: 0 0 8px rgba(255, 107, 107, 0.3); background: rgba(255, 107, 107, 0.2); }
  .timeline-item.screen .timeline-dot { border-color: var(--blue); box-shadow: 0 0 8px rgba(116, 185, 255, 0.3); }
  .timeline-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; transition: all 0.25s; cursor: default; }
  .timeline-card:hover { border-color: var(--accent); transform: translateX(4px); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3); }
  .card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .type-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .type-badge.topic { background: rgba(108, 92, 231, 0.15); color: var(--accent-light); }
  .type-badge.action { background: rgba(255, 165, 2, 0.15); color: var(--orange); }
  .type-badge.decision { background: rgba(0, 206, 201, 0.15); color: var(--teal); }
  .type-badge.mention { background: rgba(255, 107, 107, 0.15); color: var(--p0); }
  .type-badge.screen { background: rgba(116, 185, 255, 0.15); color: var(--blue); }
  .timestamp { font-size: 11px; color: var(--text-muted); margin-left: auto; }
  .card-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
  .card-desc { font-size: 13px; color: var(--text-dim); line-height: 1.5; }
  .speaker-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; background: var(--surface-3); padding: 2px 8px; border-radius: 10px; color: var(--text-dim); margin-top: 6px; }
  .screenshot-thumb {
    margin-top: 8px;
    width: 100%;
    height: 120px;
    background: var(--surface-3);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 12px;
    border: 1px solid var(--border);
    position: relative;
  }
  .placeholder-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .placeholder-content .icon { font-size: 28px; opacity: 0.5; }
  .sidebar-section { margin-bottom: 28px; }
  .sidebar-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-dim); }
  .participant-list, .action-list, .decision-list { display: flex; flex-direction: column; gap: 8px; }
  .participant-row, .action-item, .decision-item { padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; transition: all 0.2s; }
  .action-item.dismissed { opacity: 0.68; border-style: dashed; }
  .participant-row:hover { border-color: var(--accent); transform: translateX(2px); }
  .participant-row { display: flex; align-items: center; gap: 10px; }
  .participant-avatar { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
  .participant-info { flex: 1; min-width: 0; }
  .participant-info .name { font-size: 13px; font-weight: 600; }
  .participant-info .role { font-size: 11px; color: var(--text-muted); }
  .speak-bar-mini { width: 60px; height: 16px; border-radius: 4px; background: var(--surface-3); overflow: hidden; position: relative; }
  .speak-bar-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--accent), var(--accent-light)); }
  .speak-pct { font-size: 10px; color: var(--text-muted); margin-left: 4px; width: 30px; text-align: right; }
  .action-item:hover { border-color: var(--orange); transform: translateX(2px); }
  .action-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; display: flex; align-items: flex-start; gap: 6px; }
  .action-meta { font-size: 11px; color: var(--text-muted); display: flex; gap: 8px; flex-wrap: wrap; }
  .action-evidence { margin-top: 6px; padding: 6px 8px; border-left: 2px solid var(--orange); border-radius: 6px; background: rgba(255,165,2,0.08); color: var(--text-dim); font-size: 11px; line-height: 1.45; }
  .action-gap-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
  .action-gap-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,165,2,0.28); color: var(--orange); background: rgba(255,165,2,0.08); font-weight: 600; }
  .action-status { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
  .status-pending { background: rgba(255, 165, 2, 0.15); color: var(--orange); }
  .status-done { background: rgba(105, 219, 124, 0.15); color: var(--p2); }
  .status-confirmed { background: rgba(116,185,255,0.15); color: var(--blue); }
  .status-dismissed { background: rgba(148,163,184,0.12); color: var(--text-dim); }
  .followup-readiness { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); padding: 12px; }
  .followup-readiness.ready { border-color: rgba(105,219,124,0.35); }
  .followup-readiness.needs-review { border-color: rgba(255,165,2,0.34); }
  .followup-readiness.empty { border-color: var(--border); opacity: 0.86; }
  .followup-head { display: flex; align-items: flex-start; gap: 9px; margin-bottom: 10px; }
  .followup-icon { width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: rgba(116,185,255,0.12); color: var(--blue); flex-shrink: 0; }
  .followup-title { font-size: 13px; font-weight: 700; color: var(--text); line-height: 1.35; }
  .followup-subtitle { margin-top: 2px; font-size: 11px; color: var(--text-dim); line-height: 1.45; }
  .followup-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
  .followup-metric { border: 1px solid var(--border); border-radius: 8px; background: rgba(11,13,20,0.36); padding: 8px; min-width: 0; }
  .followup-metric strong { display: block; font-size: 17px; line-height: 1.1; color: var(--text); }
  .followup-metric span { display: block; margin-top: 3px; font-size: 10px; color: var(--text-dim); }
  .followup-blockers { display: flex; flex-direction: column; gap: 6px; margin: 0 0 10px; }
  .followup-blocker { border-left: 2px solid var(--orange); border-radius: 7px; background: rgba(255,165,2,0.07); padding: 7px 8px; font-size: 11px; color: var(--text-dim); line-height: 1.45; }
  .followup-blocker strong { color: var(--text); }
  .followup-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .followup-copy {
    padding: 7px 12px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-dim);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .followup-copy:hover:not(:disabled) { border-color: var(--accent); color: var(--text); }
  .followup-copy:disabled { opacity: 0.48; cursor: not-allowed; }
  .followup-copy-state { font-size: 11px; color: var(--text-muted); }
  .decision-item { border-left: 3px solid var(--teal); font-size: 13px; line-height: 1.5; }
  .decision-item:hover { border-color: var(--teal); transform: translateX(2px); }
  .dec-time { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
  .stance-section { margin-bottom: 28px; }
  .stance-rail { display: flex; flex-direction: column; gap: 16px; }
  .stance-participant { margin-bottom: 0; }
  .stance-participant-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .stance-participant-avatar { width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
  .stance-participant-name { font-size: 12px; font-weight: 600; }
  .stance-participant-role { font-size: 10px; color: var(--text-muted); margin-left: auto; }
  .stance-item { padding: 8px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 6px; transition: all 0.2s; cursor: default; }
  .stance-item:hover { border-color: var(--accent); transform: translateX(2px); }
  .stance-item-top { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
  .stance-badge { font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.3px; }
  .stance-badge.lead { background: rgba(108, 92, 231, 0.15); color: var(--accent-light); }
  .stance-badge.support { background: rgba(105, 219, 124, 0.15); color: var(--p2); }
  .stance-badge.neutral { background: rgba(255, 212, 59, 0.1); color: var(--p1); }
  .stance-badge.question { background: rgba(255, 165, 2, 0.15); color: var(--orange); }
  .stance-topic-title { font-size: 11px; font-weight: 600; color: var(--text); }
  .stance-item-quote { font-size: 11px; color: var(--text-dim); font-style: italic; line-height: 1.4; }
  .stance-item-time { font-size: 10px; color: var(--text-muted); margin-top: 3px; }
  .stance-toggle { padding: 5px 0; font-size: 11px; color: var(--accent-light); cursor: pointer; text-align: center; transition: opacity 0.2s; }
  .stance-toggle:hover { opacity: 0.7; }
  .stance-details { display: none; }
  .stance-details.open { display: block; }
  .digest-list { display: flex; flex-direction: column; gap: 8px; }
  .digest-item { padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; transition: all 0.2s; }
  .digest-item:hover { border-color: var(--accent-light); transform: translateX(2px); }
  .digest-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
  .digest-desc { font-size: 11px; line-height: 1.55; color: var(--text-muted); margin-bottom: 8px; }
  .digest-links { display: flex; flex-wrap: wrap; gap: 6px; }
  .digest-link { padding: 5px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-dim); font-size: 11px; text-decoration: none; transition: all 0.2s; }
  .digest-link:hover { border-color: var(--accent); color: var(--text); }
  .pdf-digest-item { scroll-margin-top: 96px; }
  .pdf-digest-preview {
    margin: 10px 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--surface-3);
  }
  .pdf-digest-preview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
  }
  .pdf-digest-preview-name {
    font-size: 12px;
    color: var(--text-dim);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pdf-digest-preview-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .pdf-digest-preview-frame {
    width: 100%;
    height: 280px;
    border: 0;
    display: block;
    background: #fff;
  }
  .pdf-digest-placeholder {
    min-height: 280px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--text-dim);
    font-size: 13px;
    padding: 20px 16px;
    text-align: center;
  }
  .pdf-digest-placeholder-icon { font-size: 48px; opacity: 0.5; }
  .pdf-digest-placeholder-title { font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .pdf-digest-placeholder-meta { font-size: 11px; color: var(--text-dim); line-height: 1.6; }
  .pdf-digest-placeholder-sub { font-size: 11px; margin-top: 4px; color: var(--text-muted); }
  .pdf-digest-placeholder-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; justify-content: center; }
  .pdf-digest-action {
    padding: 6px 16px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-dim);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .pdf-digest-action.primary {
    border-color: var(--accent);
    background: rgba(108,92,231,0.1);
    color: var(--accent-light);
  }
  .pdf-digest-action:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--text);
  }
  .pdf-digest-action:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  .page-footer { padding: 16px 32px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 16px; font-size: 12px; color: var(--text-muted); }
  .feedback-btns { margin-left: auto; display: flex; gap: 8px; }
  .feedback-btn { padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-dim); font-size: 12px; cursor: pointer; transition: all 0.2s; }
  .feedback-btn:hover { border-color: var(--accent); color: var(--text); }
  .feedback-btn.confirm:hover { border-color: var(--p2); color: var(--p2); }
  .feedback-btn.reject:hover { border-color: var(--p0); color: var(--p0); }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (max-width: 1100px) {
    .stats-strip { grid-template-columns: repeat(2, 1fr); }
    .main-layout { grid-template-columns: 1fr; }
  }
`;

function getSessionForPanorama(
  state: ReturnType<typeof useMeetingPilotState>[0],
) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') === '1') {
    return undefined;
  }
  const meetingId = params.get('meetingId') || undefined;
  const tabId = params.get('tabId');
  if (meetingId) {
    return state?.sessions.find((item) => item.meetingId === meetingId);
  }
  if (tabId) {
    const parsed = Number(tabId);
    if (Number.isFinite(parsed)) {
      return state?.sessions.find((item) => item.tabId === parsed);
    }
  }
  return state?.activeSession;
}

function formatMeetingDate() {
  return '2026-04-03';
}

function parseTimestampParam(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
}

function parseHistoryParticipants(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  } catch {
    // ignore malformed history payloads and fall back to plain text parsing
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseHistoryDigestStatus(
  raw: string | null,
  pdfUrl?: string,
  digestId?: string,
): MeetingPilotSessionSnapshot['digest']['status'] {
  if (
    raw === 'idle' ||
    raw === 'uploading' ||
    raw === 'processing' ||
    raw === 'completed' ||
    raw === 'failed'
  ) {
    return raw;
  }
  if (pdfUrl) return 'completed';
  if (digestId) return 'processing';
  return 'idle';
}

function getArchivedSessionFromQuery():
  | MeetingPilotSessionSnapshot
  | undefined {
  const params = new URLSearchParams(window.location.search);
  if (params.get('history') !== '1') {
    return undefined;
  }

  const meetingId = params.get('meetingId') || '';
  if (!meetingId) {
    return undefined;
  }

  const date = parseTimestampParam(params.get('date')) || Date.now();
  const lastEventAt = parseTimestampParam(params.get('lastEventAt')) || date;
  const participants = parseHistoryParticipants(params.get('participants'));
  const pdfUrl = getSafeExternalUrl(params.get('pdfUrl')) || undefined;
  const digestId = (params.get('digestId') || '').trim() || undefined;
  const digestStatus = parseHistoryDigestStatus(
    params.get('digestStatus'),
    pdfUrl,
    digestId,
  );
  const digestErrorCode =
    (params.get('digestErrorCode') || '').trim() || undefined;
  const base = createMeetingPilotSessionSnapshot({
    meetingId,
    tabId: parseTimestampParam(params.get('tabId')) || 0,
    url: '',
    title: params.get('title') || '会议记录',
    detectedAt: date,
  });

  return {
    ...base,
    status: 'ended',
    inMeeting: false,
    participantCount: participants.length,
    participants: participants.map((name, index) => ({
      id: `archived-participant-${index}`,
      name,
      role: '参会者',
      speakingPct: 0,
    })),
    capture: {
      kind: 'completed',
      chunkCount: 0,
      startedAt: date,
    },
    digest: {
      status: digestStatus,
      taskId: digestId,
      lookupId: digestId,
      resultUrl: pdfUrl,
      errorCode: digestErrorCode,
      updatedAt: lastEventAt,
      message: pdfUrl
        ? '会议纪要 PDF 已就绪。'
        : digestStatus === 'failed'
        ? '会议记录已归档，但 PDF 生成失败。'
        : digestId
        ? '会议记录已归档，PDF 仍在生成中。'
        : '会议记录已归档。',
    },
    currentTopic: '会议结果已归档',
    summary:
      participants.length > 0
        ? `这是一条从“会议记录”入口打开的归档会议，参会者包括：${participants.join(
            '、',
          )}。`
        : '这是一条从“会议记录”入口打开的归档会议。',
    updatedAt: lastEventAt,
    endedAt: lastEventAt,
  };
}

function hydrateArchivedSession(
  baseSession: MeetingPilotSessionSnapshot,
  detail: {
    summary?: string;
    latestObservationText?: string;
    chapters?: Array<Record<string, unknown>>;
    actionItems?: Array<Record<string, unknown>>;
    decisions?: Array<Record<string, unknown>>;
    timelineEvents?: Array<Record<string, unknown>>;
    participantStances?: Array<Record<string, unknown>>;
  },
): MeetingPilotSessionSnapshot {
  const chapters = Array.isArray(detail.chapters)
    ? detail.chapters
        .map((item) => {
          const id = String(item.id || '').trim();
          const title = String(item.title || '').trim();
          const summary = String(item.summary || '').trim();
          if (!id || !title) return null;
          return {
            id,
            title,
            summary,
            viewMode: 'outline' as const,
            startLabel: String(item.startLabel || '').trim(),
            actionCount: Number(item.actionCount || 0),
            decisionCount: Number(item.decisionCount || 0),
          };
        })
        .filter(Boolean)
    : baseSession.chapters;

  const actionItems = Array.isArray(detail.actionItems)
    ? detail.actionItems
        .map((item) => {
          const id = String(item.id || '').trim();
          const title = String(item.title || '').trim();
          const owner = String(item.owner || '').trim();
          if (!id || !title) return null;
          return {
            id,
            title,
            owner: owner || 'Unknown',
            deadline: String(item.deadline || '').trim() || undefined,
            status: item.status === 'done' ? 'done' : 'pending',
            reviewState:
              item.reviewState === 'confirmed' ||
              item.reviewState === 'dismissed'
                ? item.reviewState
                : 'suggested',
            reviewedAt: Number.isFinite(Number(item.reviewedAt))
              ? Number(item.reviewedAt)
              : undefined,
            editedAt: Number.isFinite(Number(item.editedAt))
              ? Number(item.editedAt)
              : undefined,
            generatedTitle:
              String(item.generatedTitle || '').trim() || undefined,
            generatedOwner:
              String(item.generatedOwner || '').trim() || undefined,
            generatedDeadline:
              typeof item.generatedDeadline === 'string'
                ? item.generatedDeadline.trim()
                : undefined,
            chapterId: String(item.chapterId || '').trim() || undefined,
            evidence: String(item.evidence || '').trim() || undefined,
            timestamp: String(item.timestamp || '').trim() || undefined,
            source:
              item.source === 'llm'
                ? 'llm'
                : item.source === 'heuristic'
                ? 'heuristic'
                : undefined,
          };
        })
        .filter(Boolean)
    : baseSession.actionItems;

  const decisions = Array.isArray(detail.decisions)
    ? detail.decisions
        .map((item) => {
          const id = String(item.id || '').trim();
          const text = String(item.text || '').trim();
          if (!id || !text) return null;
          return {
            id,
            text,
            timestamp: String(item.timestamp || '').trim(),
          };
        })
        .filter(Boolean)
    : baseSession.decisions;

  const timelineEvents = Array.isArray(detail.timelineEvents)
    ? detail.timelineEvents
        .map((item) => {
          const id = String(item.id || '').trim();
          const title = String(item.title || '').trim();
          if (!id || !title) return null;
          const type = String(item.type || 'topic') as
            | 'topic'
            | 'decision'
            | 'action'
            | 'mention'
            | 'screen';
          return {
            id,
            type,
            title,
            description: String(item.description || '').trim(),
            timestamp: String(item.timestamp || '').trim(),
            speaker: String(item.speaker || '').trim() || undefined,
            chapterId: String(item.chapterId || '').trim() || undefined,
          };
        })
        .filter(Boolean)
    : baseSession.timelineEvents;

  const participantStances = Array.isArray(detail.participantStances)
    ? detail.participantStances
    : [];

  const participants = baseSession.participants.map((participant) => ({
    ...participant,
    stances: participantStances
      .filter((item) => item.participant === participant.name)
      .map((item) => ({
        topic: String(item.topic || '').trim(),
        stance: String(
          item.stance || '中立',
        ) as MeetingPilotParticipantStance['stance'],
        keyQuote: String(item.keyQuote || '').trim(),
        timeRange: String(item.timeRange || '').trim() || undefined,
      }))
      .filter((item) => item.topic && item.keyQuote),
  }));

  return {
    ...baseSession,
    summary: detail.summary || baseSession.summary,
    latestObservationText:
      detail.latestObservationText || baseSession.latestObservationText,
    chapters,
    actionItems,
    decisions,
    timelineEvents,
    participants,
    participantCount: participants.length,
    currentTopic:
      chapters[chapters.length - 1]?.title || baseSession.currentTopic,
  };
}

function formatSessionDate(timestamp?: number) {
  const date = new Date(timestamp || Date.now());
  if (Number.isNaN(date.getTime())) return formatMeetingDate();
  return date.toISOString().slice(0, 10);
}

function formatSessionTimeRange(
  session: ReturnType<typeof getDemoMeetingSessionSnapshot>,
) {
  const start = session.detectedAt || session.capture.startedAt;
  const end = session.endedAt || session.updatedAt || Date.now();
  if (!start || !end) return '--:-- - --:--';
  const startDate = new Date(start);
  const endDate = new Date(end);
  const formatPart = (date: Date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes(),
    ).padStart(2, '0')}`;
  return `${formatPart(startDate)} - ${formatPart(endDate)}`;
}

function formatSessionDuration(
  session: ReturnType<typeof getDemoMeetingSessionSnapshot>,
) {
  const start = session.capture.startedAt || session.detectedAt;
  const end = session.endedAt || session.updatedAt || Date.now();
  if (!start || !end) return '--';
  return `${Math.max(1, Math.round((end - start) / 60000))} 分钟`;
}

function getEnergyLabels(
  session: ReturnType<typeof getDemoMeetingSessionSnapshot>,
) {
  const start = session.capture.startedAt || session.detectedAt || Date.now();
  const end = session.endedAt || session.updatedAt || Date.now();
  const step = Math.max(1, Math.floor((end - start) / 7));
  return Array.from({ length: 8 }, (_, index) => {
    const point = new Date(start + step * index);
    return `${String(point.getHours()).padStart(2, '0')}:${String(
      point.getMinutes(),
    ).padStart(2, '0')}`;
  });
}

function shouldUseMeetingPilotDemo() {
  return new URLSearchParams(window.location.search).get('demo') === '1';
}

function getActionReviewState(
  item: MeetingPilotActionItem,
): 'suggested' | 'confirmed' | 'dismissed' {
  if (item.reviewState === 'dismissed') {
    return 'dismissed';
  }
  if (item.reviewState === 'confirmed' || item.status === 'done') {
    return 'confirmed';
  }
  return 'suggested';
}

function getActionStatusLabel(item: MeetingPilotActionItem): string {
  const reviewState = getActionReviewState(item);
  if (reviewState === 'dismissed') return '已忽略';
  if (item.status === 'done') return '已完成';
  if (reviewState === 'confirmed') return '已确认';
  return '待复核';
}

function getActionStatusClass(item: MeetingPilotActionItem): string {
  const reviewState = getActionReviewState(item);
  if (reviewState === 'dismissed') return 'status-dismissed';
  if (item.status === 'done') return 'status-done';
  if (reviewState === 'confirmed') return 'status-confirmed';
  return 'status-pending';
}

function isMissingActionOwner(owner: string | undefined): boolean {
  const normalized = (owner || '').trim().toLowerCase();
  return (
    !normalized ||
    normalized === 'unknown' ||
    normalized === 'unassigned' ||
    normalized === '待分配'
  );
}

function getActionReadinessGaps(item: MeetingPilotActionItem): string[] {
  const gaps: string[] = [];
  if (isMissingActionOwner(item.owner)) {
    gaps.push('补负责人');
  }
  if (!item.deadline?.trim()) {
    gaps.push('补截止');
  }
  if (!item.evidence?.trim()) {
    gaps.push('缺依据');
  }
  return gaps;
}

function getFollowUpReadinessClass(
  activeActionCount: number,
  suggestedCount: number,
  gapCount: number,
): string {
  if (!activeActionCount) return 'empty';
  if (suggestedCount > 0 || gapCount > 0) return 'needs-review';
  return 'ready';
}

function getFollowUpReadinessText(
  activeActionCount: number,
  suggestedCount: number,
  gapCount: number,
): string {
  if (!activeActionCount) return '暂无需要跟进的行动项。';
  if (suggestedCount > 0 || gapCount > 0) {
    return '先处理待复核和缺信息项，再外发给团队。';
  }
  return '行动项已具备负责人、截止和依据，可以直接外发。';
}

function buildFollowUpChecklist(
  session: MeetingPilotSessionSnapshot,
  activeActionItems: MeetingPilotActionItem[],
): string {
  const lines = [
    `# ${session.title || 'Meeting Pilot'} 会后跟进`,
    '',
    `会议: ${formatSessionDate(session.detectedAt)} ${formatSessionTimeRange(
      session,
    )}`,
    '',
  ];

  if (!activeActionItems.length) {
    lines.push('暂无需要跟进的行动项。');
    return lines.join('\n');
  }

  activeActionItems.forEach((item) => {
    const owner = isMissingActionOwner(item.owner) ? '待补负责人' : item.owner;
    const deadline = item.deadline?.trim() || '待补截止';
    const status = getActionStatusLabel(item);
    const gaps = getActionReadinessGaps(item);
    lines.push(
      `- [${item.status === 'done' ? 'x' : ' '}] ${
        item.title
      }（${status}；负责人：${owner}；截止：${deadline}${
        gaps.length ? `；需补：${gaps.join('、')}` : ''
      }）`,
    );
    if (item.evidence?.trim()) {
      lines.push(`  - 依据：${item.evidence.trim()}`);
    }
  });

  return lines.join('\n');
}

async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the textarea path for browsers that expose clipboard
      // but reject extension-page writes in automated or restricted contexts.
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    if (!document.execCommand('copy')) {
      throw new Error('clipboard_copy_failed');
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

function getStanceBadgeClass(stance: MeetingPilotParticipantStance['stance']) {
  if (stance === '主导') return 'lead';
  if (stance === '支持') return 'support';
  if (stance === '质疑') return 'question';
  return 'neutral';
}

function EnergyChart() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;
    const energyData = [
      0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.55, 0.65, 0.72, 0.8, 0.85, 0.78, 0.7,
      0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.4, 0.5, 0.6, 0.65, 0.78, 0.82, 0.75,
      0.7, 0.65, 0.85, 0.92, 0.95, 0.8, 0.75, 0.7, 0.65, 0.7, 0.75, 0.8, 0.85,
      0.9, 0.88, 0.92, 0.85, 0.8, 0.78, 0.72, 0.65, 0.6, 0.55, 0.5, 0.48, 0.55,
      0.6, 0.65, 0.58, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.18, 0.15, 0.12,
      0.1,
    ];
    const padY = 16;
    const usableH = h - padY * 2;
    const gradient = ctx.createLinearGradient(0, padY, 0, h);
    gradient.addColorStop(0, 'rgba(108,92,231,0.3)');
    gradient.addColorStop(1, 'rgba(108,92,231,0)');
    ctx.beginPath();
    ctx.moveTo(0, h);
    const stepX = w / (energyData.length - 1);
    for (let i = 0; i < energyData.length; i += 1) {
      const x = i * stepX;
      const y = padY + usableH * (1 - energyData[i]);
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        const prevX = (i - 1) * stepX;
        const prevY = padY + usableH * (1 - energyData[i - 1]);
        const cpx = (prevX + x) / 2;
        ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
      }
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
    lineGrad.addColorStop(0, '#6c5ce7');
    lineGrad.addColorStop(0.45, '#a29bfe');
    lineGrad.addColorStop(0.5, '#ff6b6b');
    lineGrad.addColorStop(0.55, '#a29bfe');
    lineGrad.addColorStop(1, '#6c5ce7');
    ctx.beginPath();
    for (let i = 0; i < energyData.length; i += 1) {
      const x = i * stepX;
      const y = padY + usableH * (1 - energyData[i]);
      if (i === 0) ctx.moveTo(x, y);
      else {
        const prevX = (i - 1) * stepX;
        const prevY = padY + usableH * (1 - energyData[i - 1]);
        const cpx = (prevX + x) / 2;
        ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
      }
    }
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }, []);

  return <canvas id="energyCanvas" ref={canvasRef} />;
}

function PanoramaPage() {
  const [state] = useMeetingPilotState();
  const [archivedDetailSession, setArchivedDetailSession] = useState<
    MeetingPilotSessionSnapshot | undefined
  >(undefined);
  const [serviceConfig, setServiceConfig] = useState({
    minutesConfigured: false,
    whisperConfigured: false,
    transcribeModel: 'whisper-1',
  });
  const [expandedStanceParticipants, setExpandedStanceParticipants] = useState<
    string[]
  >([]);
  const [renamingParticipantId, setRenamingParticipantId] = useState<
    string | null
  >(null);
  const [renameDraft, setRenameDraft] = useState<string>('');
  const [followUpCopyState, setFollowUpCopyState] = useState('');
  const [linkCopyState, setLinkCopyState] = useState('');
  const archivedSession = useMemo(() => getArchivedSessionFromQuery(), []);
  const isArchivedHistoryMode = Boolean(archivedSession);
  const session =
    getSessionForPanorama(state) ||
    archivedDetailSession ||
    archivedSession ||
    (new URLSearchParams(window.location.search).get('demo') === '1'
      ? getDemoMeetingSessionSnapshot(0)
      : createMeetingPilotSessionSnapshot({
          meetingId: 'unbound',
          tabId: 0,
          url: '',
          title: 'Meeting Pilot',
        }));

  const submitRenameParticipant = async (
    participantId: string,
    newName: string,
  ) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setRenamingParticipantId(null);
      return;
    }
    try {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_RENAME_PARTICIPANT',
        tabId: session.tabId,
        meetingId: session.meetingId,
        participantId,
        newName: trimmed,
      });
    } catch {
      // best effort; UI will refresh on next snapshot push
    }
    setRenamingParticipantId(null);
  };

  useEffect(() => {
    if (!archivedSession) return;
    let cancelled = false;
    const loadArchivedDetail = async () => {
      try {
        const client = getMemoryServiceClient();
        const detail = await client.getMeetingDetail(archivedSession.meetingId);
        if (!cancelled) {
          setArchivedDetailSession(
            hydrateArchivedSession(archivedSession, detail),
          );
        }
      } catch {
        if (!cancelled) {
          setArchivedDetailSession(undefined);
        }
      }
    };
    void loadArchivedDetail();
    return () => {
      cancelled = true;
    };
  }, [archivedSession]);

  useEffect(() => {
    let cancelled = false;
    const syncConfig = async () => {
      const envConfig = await getEnvConfig();
      if (cancelled) return;
      setServiceConfig({
        minutesConfigured: Boolean(
          String(
            envConfig.MEETING_MINUTES_API_URL ||
              envConfig.MEETING_DIGEST_API_BASE_URL ||
              '',
          ).trim(),
        ),
        whisperConfigured: Boolean(
          String(envConfig.MEETING_PROVIDER_BASE_URL || '').trim() &&
            String(envConfig.MEETING_PROVIDER_API_KEY || '').trim(),
        ),
        transcribeModel: String(
          envConfig.MEETING_TRANSCRIBE_MODEL || 'whisper-1',
        ).trim(),
      });
    };
    void syncConfig();
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === 'local' && changes.envConfig) {
        void syncConfig();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);
  const mentionCount = session.alerts.filter(
    (alert) => alert.source === 'mention' || alert.source === 'action',
  ).length;
  const activeActionItems = session.actionItems.filter(
    (item) => getActionReviewState(item) !== 'dismissed',
  );
  const suggestedActions = activeActionItems.filter(
    (item) => getActionReviewState(item) === 'suggested',
  );
  const confirmedOpenActions = activeActionItems.filter(
    (item) =>
      getActionReviewState(item) === 'confirmed' && item.status !== 'done',
  );
  const completedActions = activeActionItems.filter(
    (item) => item.status === 'done',
  );
  const actionsWithReadinessGaps = activeActionItems.filter(
    (item) => getActionReadinessGaps(item).length > 0,
  );
  const readyFollowUpActions = activeActionItems.filter(
    (item) =>
      getActionReviewState(item) === 'confirmed' &&
      item.status !== 'done' &&
      getActionReadinessGaps(item).length === 0,
  );
  const followUpReadinessClass = getFollowUpReadinessClass(
    activeActionItems.length,
    suggestedActions.length,
    actionsWithReadinessGaps.length,
  );
  const followUpReadinessText = getFollowUpReadinessText(
    activeActionItems.length,
    suggestedActions.length,
    actionsWithReadinessGaps.length,
  );
  const pdfUrl = session.digest.resultUrl;
  const minutesConfigured = serviceConfig.minutesConfigured;
  const whisperConfigured = serviceConfig.whisperConfigured;
  const missingMinutesAsset = !session.digest.videoUrl;
  const missingMinutesForThisMeeting =
    session.digest.errorCode === 'missing_minutes_api_base_url' ||
    (!minutesConfigured && !pdfUrl);
  const energyLabels = useMemo(() => getEnergyLabels(session), [session]);
  const heatData = useMemo(() => {
    if (!session.timelineEvents.length) {
      return Array.from({ length: 32 }, (_, index) =>
        Math.max(0.08, Math.min(0.95, 0.12 + index * 0.02)),
      );
    }
    const buckets = Array.from({ length: 32 }, () => 0.12);
    session.timelineEvents.forEach((event, index) => {
      const bucket = Math.min(
        31,
        Math.floor((index / Math.max(1, session.timelineEvents.length)) * 32),
      );
      buckets[bucket] = Math.min(
        0.95,
        buckets[bucket] +
          (event.type === 'decision'
            ? 0.32
            : event.type === 'action'
            ? 0.24
            : event.type === 'mention'
            ? 0.28
            : event.type === 'screen'
            ? 0.18
            : 0.14),
      );
    });
    return buckets;
  }, [session.timelineEvents]);

  const toggleParticipantStance = (participantId: string) => {
    setExpandedStanceParticipants((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId],
    );
  };

  const exportSession = () => {
    const blob = new Blob([JSON.stringify(session, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${session.meetingId || 'meeting-pilot'}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const replayRecording = () => {
    if (!session.digest.videoUrl) return;
    void chrome.tabs.create({ url: session.digest.videoUrl, active: true });
  };

  const openMeetingArchive = () => {
    void chrome.tabs.create({
      url: chrome.runtime.getURL('memory-exploring.html#/meetings'),
      active: true,
    });
  };

  const openMeetingOptions = () => {
    const url = chrome.runtime.getURL('options.html#meeting-pilot-config');
    void chrome.tabs.create({
      url,
      active: true,
    });
  };

  const copyFollowUpChecklist = async () => {
    if (!activeActionItems.length) return;
    const checklist = buildFollowUpChecklist(session, activeActionItems);
    try {
      await writeClipboardText(checklist);
      setFollowUpCopyState('已复制');
    } catch {
      setFollowUpCopyState('复制失败');
    }
  };

  const copyLink = async (url: string | undefined, successMessage: string) => {
    if (!url) {
      setLinkCopyState('没有可复制链接');
      return;
    }
    try {
      await writeClipboardText(url);
      setLinkCopyState(successMessage);
      window.setTimeout(() => setLinkCopyState(''), 3200);
    } catch {
      setLinkCopyState('复制失败，请手动复制');
    }
  };

  useEffect(() => {
    if (shouldUseMeetingPilotDemo()) return;
    if (session.digest.resultUrl || !session.digest.lookupId || !session.tabId)
      return;

    let disposed = false;
    let timer: number | undefined;

    const refreshDigest = async () => {
      try {
        const envConfig = await getEnvConfig();
        const baseUrl = String(
          envConfig.MEETING_MINUTES_API_URL ||
            envConfig.MEETING_DIGEST_API_BASE_URL ||
            '',
        ).replace(/\/$/, '');
        if (!baseUrl) return;
        const response = await fetch(
          `${baseUrl}/api/v3/digest/${encodeURIComponent(
            session.digest.lookupId,
          )}`,
        );
        const data = await response.json();
        if (!response.ok || disposed) return;
        await chrome.runtime.sendMessage({
          type: 'MEETING_PILOT_DIGEST_STATUS',
          tabId: session.tabId,
          digest: {
            status:
              data.status === 'COMPLETED'
                ? 'completed'
                : data.status === 'FAILED'
                ? 'failed'
                : 'processing',
            taskId: session.digest.taskId,
            lookupId: session.digest.lookupId,
            videoUrl: session.digest.videoUrl,
            resultUrl: data.pdfUrl,
            message: data.message,
          },
        });
        if (
          !disposed &&
          data.status !== 'COMPLETED' &&
          data.status !== 'FAILED'
        ) {
          timer = window.setTimeout(refreshDigest, 30000);
        }
      } catch {
        if (!disposed) {
          timer = window.setTimeout(refreshDigest, 30000);
        }
      }
    };

    void refreshDigest();

    return () => {
      disposed = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [
    session.digest.resultUrl,
    session.digest.taskId,
    session.digest.lookupId,
    session.digest.videoUrl,
    session.meetingId,
    session.tabId,
  ]);

  return (
    <>
      <style>{panoramaStyle}</style>
      <div className="entry-banner">
        <span style={{ fontSize: 14 }}>📋</span>
        <span>
          <b style={{ color: '#a29bfe' }}>会后结果页</b> — 会议结束后由 Meeting
          Pilot 自动归档，也可以从「记忆查询 → 📡 会议记录」重新打开。
        </span>
        <span className="synced-pill">
          {session.digest.status === 'completed'
            ? '✅ 已同步'
            : session.digest.status === 'processing'
            ? '⏳ 生成中'
            : session.digest.status === 'failed'
            ? '⚠️ 需处理'
            : '🟣 已就绪'}
        </span>
        {isArchivedHistoryMode ? (
          <button className="header-btn" onClick={openMeetingArchive}>
            ↩️ 返回会议记录
          </button>
        ) : null}
      </div>

      <header className="page-header">
        <div className="logo">📡</div>
        <div className="header-info">
          <h1>{session.title}</h1>
          <div className="header-meta">
            <span>📅 {formatSessionDate(session.detectedAt)}</span>
            <span>🕐 {formatSessionTimeRange(session)}</span>
            <span>
              👥 {session.participantCount || session.participants.length}{' '}
              人参会
            </span>
            <span>⏱️ {formatSessionDuration(session)}</span>
            <span>
              <TierBadge tier={session.tier} />
            </span>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="header-btn"
            onClick={() =>
              document
                .getElementById('pdfPreviewSection')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          >
            📄 会议纪要 PDF
          </button>
          <button
            className="header-btn"
            onClick={() => void copyLink(window.location.href, '页面链接已复制')}
          >
            🔗 复制页面链接
          </button>
          <span className="header-copy-state" aria-live="polite">
            {linkCopyState}
          </span>
          <button className="header-btn" onClick={exportSession}>
            📋 导出
          </button>
          <button
            className="header-btn primary"
            onClick={replayRecording}
            disabled={!session.digest.videoUrl}
            title={
              session.digest.videoUrl
                ? '打开会议录制素材'
                : '当前会议没有可回放的录制素材，请查看 PDF 或会议记录'
            }
          >
            ▶️ 回放录制
          </button>
        </div>
      </header>

      <div className="stats-strip">
        <div className="stat-card">
          <div className="stat-label">会议时长</div>
          <div className="stat-value">
            {Math.max(
              1,
              Math.round(
                ((session.endedAt || session.updatedAt || Date.now()) -
                  (session.capture.startedAt ||
                    session.detectedAt ||
                    Date.now())) /
                  60000,
              ),
            )}
            <span className="stat-unit">min</span>
          </div>
          <div className="stat-sub">基于当前 session 时间动态计算</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">话题覆盖</div>
          <div className="stat-value">
            {session.chapters.length}
            <span className="stat-unit">个</span>
          </div>
          <div className="stat-sub">当前结构已对齐关键章节</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">行动项</div>
          <div className="stat-value">{activeActionItems.length}</div>
          <div className="stat-sub">
            {suggestedActions.length} 待复核 · {confirmedOpenActions.length}{' '}
            已确认 · {completedActions.length} 已完成
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">关键决议</div>
          <div className="stat-value">{session.decisions.length}</div>
          <div className="stat-sub">全部已记录</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">提及你</div>
          <div className="stat-value">
            {mentionCount}
            <span className="stat-unit">次</span>
          </div>
          <div className="stat-sub">提醒与分配已归档</div>
        </div>
      </div>

      <div className="main-layout">
        <div className="main-content">
          <div className="section-header">
            <span>📊</span>
            <h2>会议能量曲线 & 发言热力图</h2>
          </div>
          <div className="energy-chart">
            <div className="energy-canvas-wrap">
              <EnergyChart />
            </div>
            <div className="energy-labels">
              {energyLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="heatmap-row">
              {heatData.map((value, index) => {
                let r = 108;
                let g = 92;
                let b = 231;
                let a = value * 0.6;
                if (value >= 0.5 && value < 0.8) {
                  const t = (value - 0.5) / 0.3;
                  r = Math.round(108 + t * (255 - 108));
                  g = Math.round(92 + t * (165 - 92));
                  b = Math.round(231 + t * (2 - 231));
                  a = 0.4 + t * 0.3;
                } else if (value >= 0.8) {
                  const t = (value - 0.8) / 0.2;
                  r = 255;
                  g = Math.round(165 - t * (165 - 107));
                  b = Math.round(2 + t * (107 - 2));
                  a = 0.7 + t * 0.3;
                }
                return (
                  <div
                    key={index}
                    className="heatmap-cell"
                    style={{ background: `rgba(${r},${g},${b},${a})` }}
                  />
                );
              })}
            </div>
            <div className="heatmap-legend">
              <span>安静</span>
              <div className="heatmap-legend-gradient" />
              <span>激烈讨论</span>
            </div>
          </div>

          <div style={{ marginTop: 32 }}>
            <div className="section-header">
              <span>🗂️</span>
              <h2>会议时间线</h2>
              <span className="count">
                {session.timelineEvents.length} 事件
              </span>
            </div>
            <div className="timeline">
              {session.timelineEvents.map((event) => (
                <div className={`timeline-item ${event.type}`} key={event.id}>
                  <div className="timeline-dot" />
                  <div className="timeline-card">
                    <div className="card-top">
                      <span className={`type-badge ${event.type}`}>
                        {event.type === 'screen'
                          ? '共享画面'
                          : event.type === 'decision'
                          ? '决议'
                          : event.type === 'action'
                          ? '行动项'
                          : event.type === 'mention'
                          ? '提及你'
                          : '话题'}
                      </span>
                      <span className="timestamp">{event.timestamp}</span>
                    </div>
                    <div className="card-title">{event.title}</div>
                    <div className="card-desc">{event.description}</div>
                    {event.type === 'screen' ? (
                      <div className="screenshot-thumb">
                        <div className="placeholder-content">
                          <span className="icon">📊</span>
                          <span>共享画面截图</span>
                        </div>
                      </div>
                    ) : null}
                    {event.speaker ? (
                      <span className="speaker-tag">👤 {event.speaker}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-header">
              <span>👥</span> 参会者发言分布
            </div>
            <div className="participant-list">
              {session.participants.map((participant) => (
                <div className="participant-row" key={participant.id}>
                  <div
                    className="participant-avatar"
                    style={{
                      background:
                        participant.id === 'alex'
                          ? 'linear-gradient(135deg, var(--accent), var(--accent-light))'
                          : participant.id === 'esone'
                          ? 'linear-gradient(135deg, #00b894, #55efc4)'
                          : participant.id === 'sarah'
                          ? 'linear-gradient(135deg, #e17055, #fab1a0)'
                          : 'linear-gradient(135deg, #0984e3, #74b9ff)',
                    }}
                  >
                    {participant.name[0]}
                  </div>
                  <div className="participant-info">
                    <div className="name">{participant.name}</div>
                    <div className="role">{participant.role}</div>
                  </div>
                  <div className="speak-bar-mini">
                    <div
                      className="speak-bar-fill"
                      style={{ width: `${participant.speakingPct}%` }}
                    />
                  </div>
                  <span className="speak-pct">{participant.speakingPct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section stance-section">
            <div className="sidebar-header">
              <span>🎭</span> 立场与态度
            </div>
            <div className="stance-rail">
              {session.participants.map((participant) => {
                const stanceItems = participant.stances || [];
                const isExpanded = expandedStanceParticipants.includes(
                  participant.id,
                );
                const primaryItems = stanceItems.slice(0, 2);
                const extraItems = stanceItems.slice(2);
                return (
                  <div
                    className="stance-participant"
                    key={`${participant.id}-stance`}
                  >
                    <div className="stance-participant-header">
                      <div
                        className="stance-participant-avatar"
                        style={{
                          background:
                            participant.id === 'alex'
                              ? 'linear-gradient(135deg, var(--accent), var(--accent-light))'
                              : participant.id === 'esone'
                              ? 'linear-gradient(135deg, #00b894, #55efc4)'
                              : participant.id === 'sarah'
                              ? 'linear-gradient(135deg, #e17055, #fab1a0)'
                              : 'linear-gradient(135deg, #0984e3, #74b9ff)',
                        }}
                      >
                        {participant.name[0]}
                      </div>
                      {renamingParticipantId === participant.id ? (
                        <span style={{ display: 'inline-flex', gap: 4 }}>
                          <input
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                void submitRenameParticipant(
                                  participant.id,
                                  renameDraft,
                                );
                              } else if (e.key === 'Escape') {
                                setRenamingParticipantId(null);
                              }
                            }}
                            style={{
                              background: 'var(--surface-2)',
                              color: 'var(--text)',
                              border: '1px solid var(--accent)',
                              borderRadius: 6,
                              padding: '2px 6px',
                              fontSize: 13,
                            }}
                          />
                          <button
                            onClick={() =>
                              void submitRenameParticipant(
                                participant.id,
                                renameDraft,
                              )
                            }
                            style={{
                              background: 'var(--accent)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '2px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setRenamingParticipantId(null)}
                            style={{
                              background: 'var(--surface-2)',
                              color: 'var(--text-dim)',
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              padding: '2px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            ✕
                          </button>
                        </span>
                      ) : (
                        <span className="stance-participant-name">
                          {participant.name}
                        </span>
                      )}
                      <span className="stance-participant-role">
                        {participant.role} · {participant.speakingPct}%
                      </span>
                      {!isArchivedHistoryMode &&
                      renamingParticipantId !== participant.id ? (
                        <button
                          onClick={() => {
                            setRenamingParticipantId(participant.id);
                            setRenameDraft(participant.name);
                          }}
                          title="重命名"
                          style={{
                            marginLeft: 'auto',
                            background: 'transparent',
                            color: 'var(--text-dim)',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 11,
                          }}
                        >
                          ✎
                        </button>
                      ) : null}
                    </div>
                    {primaryItems.map((item) => (
                      <div
                        className="stance-item"
                        key={`${participant.id}-${item.topic}`}
                      >
                        <div className="stance-item-top">
                          <span
                            className={`stance-badge ${getStanceBadgeClass(
                              item.stance,
                            )}`}
                          >
                            {item.stance}
                          </span>
                          <span className="stance-topic-title">
                            {item.topic}
                          </span>
                        </div>
                        <div className="stance-item-quote">{item.keyQuote}</div>
                        <div className="stance-item-time">{item.timeRange}</div>
                      </div>
                    ))}
                    {extraItems.length ? (
                      <>
                        <div
                          className={`stance-details ${
                            isExpanded ? 'open' : ''
                          }`}
                        >
                          {extraItems.map((item) => (
                            <div
                              className="stance-item"
                              key={`${participant.id}-${item.topic}-extra`}
                            >
                              <div className="stance-item-top">
                                <span
                                  className={`stance-badge ${getStanceBadgeClass(
                                    item.stance,
                                  )}`}
                                >
                                  {item.stance}
                                </span>
                                <span className="stance-topic-title">
                                  {item.topic}
                                </span>
                              </div>
                              <div className="stance-item-quote">
                                {item.keyQuote}
                              </div>
                              <div className="stance-item-time">
                                {item.timeRange}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div
                          className="stance-toggle"
                          onClick={() =>
                            toggleParticipantStance(participant.id)
                          }
                        >
                          {isExpanded ? '收起 ▴' : '展开更多 ▾'}
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-header">
              <span>✅</span> 会后跟进状态
            </div>
            <div
              className={`followup-readiness ${followUpReadinessClass}`}
              data-followup-state={followUpReadinessClass}
            >
              <div className="followup-head">
                <span className="followup-icon">↗</span>
                <div>
                  <div className="followup-title">跟进清单可交付度</div>
                  <div className="followup-subtitle">
                    {followUpReadinessText}
                  </div>
                </div>
              </div>
              <div className="followup-grid">
                <div className="followup-metric">
                  <strong>{readyFollowUpActions.length}</strong>
                  <span>可直接跟进</span>
                </div>
                <div className="followup-metric">
                  <strong>{suggestedActions.length}</strong>
                  <span>待复核</span>
                </div>
                <div className="followup-metric">
                  <strong>{actionsWithReadinessGaps.length}</strong>
                  <span>需补信息</span>
                </div>
                <div className="followup-metric">
                  <strong>{completedActions.length}</strong>
                  <span>已完成</span>
                </div>
              </div>
              {actionsWithReadinessGaps.length ? (
                <div className="followup-blockers">
                  {actionsWithReadinessGaps.slice(0, 3).map((item) => (
                    <div className="followup-blocker" key={item.id}>
                      <strong>{item.title}</strong> ·{' '}
                      {getActionReadinessGaps(item).join('、')}
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="followup-actions">
                <button
                  className="followup-copy"
                  disabled={!activeActionItems.length}
                  onClick={() => void copyFollowUpChecklist()}
                >
                  复制跟进清单
                </button>
                <span className="followup-copy-state" aria-live="polite">
                  {followUpCopyState}
                </span>
              </div>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-header">
              <span>📋</span> 行动项总览
            </div>
            <div className="action-list">
              {session.actionItems.map((item) => {
                const readinessGaps =
                  getActionReviewState(item) === 'dismissed'
                    ? []
                    : getActionReadinessGaps(item);
                return (
                  <div
                    className={`action-item ${getActionReviewState(item)}`}
                    key={item.id}
                  >
                    <div className="action-title">
                      <span>📌</span>
                      {item.title}
                    </div>
                    <div className="action-meta">
                      <span>👤 {item.owner}</span>
                      {item.deadline ? <span>📅 {item.deadline}</span> : null}
                      {item.timestamp ? (
                        <span>🕒 {item.timestamp}</span>
                      ) : null}
                      <span
                        className={`action-status ${getActionStatusClass(
                          item,
                        )}`}
                      >
                        {getActionStatusLabel(item)}
                      </span>
                    </div>
                    {readinessGaps.length ? (
                      <div className="action-gap-tags">
                        {readinessGaps.map((gap) => (
                          <span className="action-gap-tag" key={gap}>
                            {gap}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {item.evidence ? (
                      <div className="action-evidence">
                        依据：{item.evidence}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-header">
              <span>⚖️</span> 关键决议
            </div>
            <div className="decision-list">
              {session.decisions.map((decision) => (
                <div className="decision-item" key={decision.id}>
                  ✅ {decision.text}
                  <div className="dec-time">📍 {decision.timestamp}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-header">
              <span>🔗</span> Digest 结果
            </div>
            <div className="digest-list">
              <div className="digest-item">
                <div className="digest-title">
                  <span>🌐</span> Webpage Panorama
                </div>
                <div className="digest-desc">
                  Meeting Pilot
                  默认打开的会后全景结果页，适合快速浏览时间线、行动项、关键决议与参会者统计。
                </div>
                <div className="digest-links">
                  <a className="digest-link" href={window.location.href}>
                    当前页面
                  </a>
                  <a
                    className="digest-link"
                    href={window.location.href}
                    onClick={(event) => {
                      event.preventDefault();
                      void copyLink(window.location.href, '页面链接已复制');
                    }}
                  >
                    复制链接
                  </a>
                </div>
              </div>
              <div className="digest-item">
                <div className="digest-title">
                  <span>🎙️</span> ASR Transcript
                </div>
                <div className="digest-desc">
                  {whisperConfigured
                    ? `当前会议允许使用 ${
                        serviceConfig.transcribeModel || 'whisper-1'
                      } 做音频转写，摘要、行动项和决议提取会优先结合 transcript。`
                    : 'ASR / 转写当前未配置。录制和基础归档仍然可用，但会缺少 transcript 驱动的实时总结，行动项、决议和摘要会更多依赖共享画面观测与启发式推断。'}
                </div>
                <div className="digest-links">
                  {whisperConfigured ? (
                    <span className="digest-link">转写已启用</span>
                  ) : (
                    <>
                      <a
                        className="digest-link"
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          openMeetingOptions();
                        }}
                      >
                        去配置转写
                      </a>
                      <span className="digest-link">不阻断 Capture</span>
                    </>
                  )}
                </div>
              </div>
              <div
                className="digest-item pdf-digest-item"
                id="pdfPreviewSection"
              >
                <div className="digest-title">
                  <span>📄</span> Meeting Minutes PDF
                </div>
                <div className="digest-desc">
                  {pdfUrl
                    ? '由 Meeting Minutes API 生成的正式会议纪要，包含完整 transcript、决议汇总、行动项与参会者签到。'
                    : missingMinutesForThisMeeting
                    ? '当前没有可用的 Meeting Minutes PDF。配置 Minutes API 后，新会议可以自动生成正式 PDF 纪要。'
                    : `Minutes API 仍在生成 PDF，当前 Digest 状态：${session.digest.status}。完成后这里会切换成正式预览。`}
                </div>
                <div className="pdf-digest-preview">
                  <div className="pdf-digest-preview-head">
                    <span className="pdf-digest-preview-name">
                      {pdfUrl
                        ? '📄 meeting-pilot-minutes.pdf'
                        : missingMinutesForThisMeeting
                        ? 'Minutes API 未配置'
                        : `Digest · ${session.digest.status}`}
                    </span>
                    <div className="pdf-digest-preview-actions">
                      <a
                        className="digest-link"
                        href={pdfUrl || '#'}
                        onClick={(event) => {
                          if (!pdfUrl) {
                            event.preventDefault();
                            return;
                          }
                          event.preventDefault();
                          void chrome.tabs.create({
                            url: pdfUrl,
                            active: true,
                          });
                        }}
                      >
                        新窗口打开
                      </a>
                      <a
                        className="digest-link"
                        href={pdfUrl || '#'}
                        onClick={(event) => {
                          if (!pdfUrl) {
                            event.preventDefault();
                            return;
                          }
                          event.preventDefault();
                          void chrome.downloads?.download({
                            url: pdfUrl,
                            filename: 'meeting-pilot-minutes.pdf',
                            saveAs: true,
                          });
                        }}
                      >
                        下载 PDF
                      </a>
                    </div>
                  </div>
                  {pdfUrl ? (
                    <iframe
                      className="pdf-digest-preview-frame"
                      src={pdfUrl}
                      title="Meeting Minutes PDF"
                    />
                  ) : (
                    <div className="pdf-digest-placeholder">
                      <div className="pdf-digest-placeholder-icon">📄</div>
                      <div>
                        <div className="pdf-digest-placeholder-title">
                          {missingMinutesForThisMeeting
                            ? 'Minutes API 尚未配置'
                            : '会议纪要生成中…'}
                        </div>
                        <div className="pdf-digest-placeholder-meta">
                          {missingMinutesForThisMeeting
                            ? '当前会议没有生成正式 PDF 纪要。配置后将对后续会议生效。'
                            : 'Minutes API 正在处理录制视频，预计需要几分钟完成。'}
                        </div>
                        <div className="pdf-digest-placeholder-sub">
                          {missingMinutesForThisMeeting
                            ? missingMinutesAsset
                              ? '这场会议结束时没有保留可重新提交的录制文件，因此当前实现下无法在配置后为这场历史会议补发 PDF。'
                              : '当前会话保留了录制素材，但前端还没有提供“重新发起 Minutes 生成”的动作。'
                            : `当前 Digest 状态：${session.digest.status}`}
                        </div>
                      </div>
                      <div className="pdf-digest-placeholder-actions">
                        {missingMinutesForThisMeeting ? (
                          <>
                            <button
                              className="pdf-digest-action primary"
                              onClick={openMeetingOptions}
                            >
                              ⚙️ 配置 Minutes API
                            </button>
                            <button className="pdf-digest-action" disabled>
                              {missingMinutesAsset
                                ? '当前无法补发'
                                : '补发能力未实现'}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="pdf-digest-action primary"
                              onClick={() => window.location.reload()}
                            >
                              🔄 刷新状态
                            </button>
                            <button className="pdf-digest-action" disabled>
                              📄 预览 PDF
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="digest-links">
                  {pdfUrl ? (
                    <>
                      <a
                        className="digest-link"
                        href={pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        在线预览
                      </a>
                      <a
                        className="digest-link"
                        href={pdfUrl}
                        onClick={(event) => {
                          event.preventDefault();
                          void chrome.downloads?.download({
                            url: pdfUrl,
                            filename: 'meeting-pilot-minutes.pdf',
                            saveAs: true,
                          });
                        }}
                      >
                        下载 PDF
                      </a>
                      <a
                        className="digest-link"
                        href={pdfUrl}
                        onClick={(event) => {
                          event.preventDefault();
                          void copyLink(pdfUrl, 'PDF 链接已复制');
                        }}
                      >
                        分享链接
                      </a>
                    </>
                  ) : missingMinutesForThisMeeting ? (
                    <>
                      <a
                        className="digest-link"
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          openMeetingOptions();
                        }}
                      >
                        去配置 Minutes API
                      </a>
                      <span className="digest-link">
                        {missingMinutesAsset
                          ? '当前历史会议无法补发'
                          : '暂不支持一键补发'}
                      </span>
                    </>
                  ) : (
                    <span className="digest-link">生成中</span>
                  )}
                </div>
              </div>
              <div className="digest-item">
                <div className="digest-title">
                  <span>🎬</span> 录制与原始素材
                </div>
                <div className="digest-desc">
                  保留会议录制原始素材，方便回放完整上下文；如果 PDF 仍在生成，
                  稍后也可以回到「会议记录」入口重新打开这场会议。
                </div>
                <div className="digest-links">
                  <a
                    className="digest-link"
                    href={session.digest.videoUrl || '#'}
                    onClick={(event) => {
                      if (!session.digest.videoUrl) {
                        event.preventDefault();
                        return;
                      }
                      event.preventDefault();
                      void chrome.tabs.create({
                        url: session.digest.videoUrl,
                        active: true,
                      });
                    }}
                  >
                    回放录制
                  </a>
                  <a
                    className="digest-link"
                    href={session.digest.videoUrl || '#'}
                    onClick={(event) => {
                      if (!session.digest.videoUrl) {
                        event.preventDefault();
                        return;
                      }
                      event.preventDefault();
                      void copyLink(session.digest.videoUrl, '录制链接已复制');
                    }}
                  >
                    复制链接
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="page-footer">
        <div
          className="logo"
          style={{ width: 20, height: 20, borderRadius: 6, fontSize: 10 }}
        >
          📡
        </div>
        <span>Generated by Meeting Pilot</span>
        <span>•</span>
        <span>基于会议录制和 AI 分析自动生成</span>
        <div className="feedback-btns">
          <button className="feedback-btn confirm">✅ 内容准确</button>
          <button className="feedback-btn reject">❌ 需要修正</button>
        </div>
      </footer>
    </>
  );
}

const container = document.getElementById('meeting-panorama-root');
if (container) {
  ReactDOM.render(<PanoramaPage />, container);
}
