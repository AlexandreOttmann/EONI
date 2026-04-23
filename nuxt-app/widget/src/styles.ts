export function getStyles(color: string, position: 'bottom-right' | 'bottom-left'): string {
  const side = position === 'bottom-right' ? 'right' : 'left'
  return `
    :host {
      all: initial;
      position: fixed;
      ${side}: 20px;
      bottom: 20px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --c-primary: ${color};
      --c-primary-light: ${color}1a;
      --c-primary-border: ${color}40;
      display: block;
    }

    /* ── FAB ──────────────────────────────────────────────── */
    #eoni-fab {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--c-primary);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      outline: none;
    }
    #eoni-fab:hover {
      transform: scale(1.06);
      box-shadow: 0 6px 20px rgba(0,0,0,0.3);
    }
    #eoni-fab:focus-visible {
      box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--c-primary);
    }
    #eoni-fab svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: #fff;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* ── Panel ────────────────────────────────────────────── */
    #eoni-panel {
      position: absolute;
      bottom: 64px;
      ${side}: 0;
      width: 320px;
      height: 480px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.16);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform-origin: bottom ${side === 'right' ? 'right' : 'left'};
      /* slide-up + scale animation */
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    #eoni-panel[aria-hidden="true"] {
      opacity: 0;
      transform: translateY(8px) scale(0.97);
      pointer-events: none;
    }
    #eoni-panel[aria-hidden="false"] {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    /* ── Panel header ─────────────────────────────────────── */
    #eoni-header {
      padding: 14px 16px;
      background: var(--c-primary);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    #eoni-header-title {
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      margin: 0;
    }
    #eoni-close-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      color: rgba(255,255,255,0.8);
      outline: none;
    }
    #eoni-close-btn:hover { color: #fff; }
    #eoni-close-btn:focus-visible {
      box-shadow: 0 0 0 2px rgba(255,255,255,0.7);
    }
    #eoni-close-btn svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
    }

    /* ── Messages area ────────────────────────────────────── */
    #eoni-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }
    #eoni-messages::-webkit-scrollbar { width: 4px; }
    #eoni-messages::-webkit-scrollbar-thumb {
      background: rgba(0,0,0,0.15);
      border-radius: 2px;
    }

    /* ── Message bubbles ──────────────────────────────────── */
    .eoni-msg {
      max-width: 85%;
      font-size: 13px;
      line-height: 1.5;
      word-break: break-word;
    }
    .eoni-msg--user {
      align-self: flex-end;
      background: var(--c-primary);
      color: #fff;
      padding: 8px 12px;
      border-radius: 14px 14px 3px 14px;
    }
    .eoni-msg--assistant {
      align-self: flex-start;
      color: #1a1a1a;
      padding: 4px 0;
    }

    /* ── Markdown inside assistant bubbles ───────────────── */
    .eoni-msg--assistant strong { font-weight: 600; }
    .eoni-msg--assistant em { font-style: italic; }
    .eoni-msg--assistant code {
      font-family: 'Menlo', 'Monaco', monospace;
      font-size: 0.85em;
      background: rgba(0,0,0,0.06);
      padding: 0.1em 0.3em;
      border-radius: 3px;
    }
    .eoni-msg--assistant pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 10px 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 0.82em;
      margin: 4px 0;
    }
    .eoni-msg--assistant pre code {
      background: none;
      padding: 0;
      color: inherit;
    }
    .eoni-msg--assistant ul,
    .eoni-msg--assistant ol {
      margin: 4px 0;
      padding-left: 18px;
    }
    .eoni-msg--assistant li { margin: 2px 0; }
    .eoni-msg--assistant p { margin: 4px 0; }
    .eoni-msg--assistant p:first-child { margin-top: 0; }
    .eoni-msg--assistant p:last-child { margin-bottom: 0; }

    /* ── Tables ───────────────────────────────────────────── */
    .eoni-msg--assistant table {
      border-collapse: collapse;
      width: 100%;
      font-size: 0.82em;
      margin: 6px 0;
      display: block;
      overflow-x: auto;
    }
    .eoni-msg--assistant th,
    .eoni-msg--assistant td {
      border: 1px solid rgba(0,0,0,0.12);
      padding: 5px 8px;
      text-align: left;
      white-space: nowrap;
    }
    .eoni-msg--assistant th {
      background: rgba(0,0,0,0.04);
      font-weight: 600;
    }
    .eoni-msg--assistant tr:nth-child(even) td {
      background: rgba(0,0,0,0.02);
    }

    /* ── Headings ─────────────────────────────────────────── */
    .eoni-msg--assistant h1,
    .eoni-msg--assistant h2,
    .eoni-msg--assistant h3 {
      font-size: 0.95em;
      font-weight: 600;
      margin: 8px 0 4px;
      line-height: 1.3;
    }
    .eoni-msg--assistant h1 { font-size: 1em; }

    /* ── Images ───────────────────────────────────────────── */
    .eoni-msg--assistant img {
      max-width: 100%;
      border-radius: 6px;
      margin: 4px 0;
      display: block;
    }

    /* ── Links ────────────────────────────────────────────── */
    .eoni-msg--assistant a {
      color: var(--c-primary);
      text-decoration: none;
      word-break: break-all;
    }
    .eoni-msg--assistant a:hover { text-decoration: underline; }

    /* ── Horizontal rule ──────────────────────────────────── */
    .eoni-msg--assistant hr {
      border: none;
      border-top: 1px solid rgba(0,0,0,0.1);
      margin: 8px 0;
    }

    /* ── Typing indicator ─────────────────────────────────── */
    .eoni-typing {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 0;
      align-self: flex-start;
    }
    .eoni-typing span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #bbb;
      animation: eoni-bounce 1.2s ease-in-out infinite;
    }
    .eoni-typing span:nth-child(1) { animation-delay: 0s; }
    .eoni-typing span:nth-child(2) { animation-delay: 0.2s; }
    .eoni-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes eoni-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-5px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .eoni-typing span { animation: none; opacity: 0.6; }
      #eoni-panel { transition: none; }
      #eoni-fab { transition: none; }
    }

    /* ── Input row ────────────────────────────────────────── */
    #eoni-input-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid #eee;
      flex-shrink: 0;
    }
    #eoni-input {
      flex: 1;
      min-width: 0;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.4;
      padding: 8px 10px;
      border: 1px solid #ddd;
      border-radius: 10px;
      resize: none;
      max-height: 100px;
      outline: none;
      color: #1a1a1a;
      background: #fafafa;
      transition: border-color 0.15s ease;
    }
    #eoni-input:focus {
      border-color: var(--c-primary);
      background: #fff;
    }
    #eoni-send-btn {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: var(--c-primary);
      border: none;
      cursor: pointer;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.15s ease;
      outline: none;
    }
    #eoni-send-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    #eoni-send-btn:not(:disabled):hover { opacity: 0.88; }
    #eoni-send-btn:focus-visible {
      box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--c-primary);
    }
    #eoni-send-btn svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: #fff;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* ── Consent overlay ──────────────────────────────────── */
    #eoni-consent {
      position: absolute;
      inset: 0;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
      gap: 12px;
    }
    #eoni-consent[hidden] { display: none; }
    #eoni-consent-title {
      font-size: 15px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0;
    }
    #eoni-consent-body {
      font-size: 12px;
      color: #555;
      line-height: 1.6;
      margin: 0;
    }
    #eoni-consent-accept {
      width: 100%;
      padding: 10px;
      background: var(--c-primary);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
    }
    #eoni-consent-accept:hover { opacity: 0.9; }
    #eoni-consent-accept:focus-visible {
      box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--c-primary);
    }
    #eoni-consent-decline {
      background: transparent;
      border: none;
      font-size: 12px;
      color: #888;
      cursor: pointer;
      padding: 4px 8px;
      outline: none;
    }
    #eoni-consent-decline:hover { color: #444; }
    #eoni-consent-decline:focus-visible {
      box-shadow: 0 0 0 2px var(--c-primary);
      border-radius: 4px;
    }

    /* ─── Product cards ─────────────────────────────────────── */
    .eoni-products {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 8px;
    }
    .eoni-product-card {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(0,0,0,0.04);
      border-radius: 8px;
      padding: 6px;
      text-decoration: none;
      color: inherit;
      transition: background 0.15s ease;
      cursor: pointer;
    }
    .eoni-product-card:hover {
      background: rgba(0,0,0,0.08);
    }
    .eoni-product-card img {
      width: 52px;
      height: 52px;
      object-fit: cover;
      border-radius: 6px;
      flex-shrink: 0;
      background: rgba(0,0,0,0.06);
    }
    .eoni-product-info {
      flex: 1;
      min-width: 0;
    }
    .eoni-product-name {
      font-size: 0.82em;
      font-weight: 500;
      margin: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .eoni-product-price {
      font-size: 0.78em;
      color: var(--c-primary);
      font-weight: 600;
      margin: 2px 0 0;
    }
  `
}
