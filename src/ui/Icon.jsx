// Icon.jsx — SF-Symbols-style monoline icons, ported verbatim from rd-base.jsx
import React from 'react';

// ─────────────────────────────────────────────────────────────
// ICONS — SF-Symbols-style monoline (1.6px stroke, round)
// ─────────────────────────────────────────────────────────────
const ICON_PATHS = {
  overview:  'M8 4V18 M5 15 8 18 11 15 M16 20V6 M13 9 16 6 19 9',
  balance:   'M12 4v15 M6 19h12 M5 9l3-4 3 4a3 3 0 0 1-6 0Z M13 9l3-4 3 4a3 3 0 0 1-6 0Z',
  income:    'M12 4.2m-2.3 0a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0 M12 8V12.2 M9.7 10 12 12.5 14.3 10 M5 14.6c0-1 .5-1.9 1.5-2.1 M5 14.6c0 3 3.1 4.9 7 4.9s7-1.9 7-4.9',
  expenses:  'M12 4.2m-2.3 0a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0 M12 12.5V8.3 M9.7 10.8 12 8.3 14.3 10.8 M5 14.6c0-1 .5-1.9 1.5-2.1 M5 14.6c0 3 3.1 4.9 7 4.9s7-1.9 7-4.9',
  assets:    'M4 18l5-5 3 3 6-7 M16 9h3v3',
  portfolio: 'M21 12a9 9 0 1 1 -18 0a9 9 0 1 1 18 0 M12 12V3.2 M12 12 19.6 15.3',
  postings:  'M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01',
  options:   'M6 6h12 M6 12h12 M6 18h12 M9 6v0 M15 12v0 M11 18v0',
  files:     'M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z',
  search:    'M11 11m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0 M20 20l-4.5-4.5',
  chevron:   'M9 6l6 6-6 6',
  chevronD:  'M6 9l6 6 6-6',
  check:     'M5 12l4 4 10-10',
  plus:      'M12 5v14 M5 12h14',
  minus:     'M5 12h14',
  reload:    'M20 11a8 8 0 1 0-2.3 5.6 M20 5v6h-6',
  close:     'M6 6l12 12 M18 6 6 18',
  cornerDownRight: 'M7 5v7a3 3 0 0 0 3 3h7 M14 12l3 3-3 3',
  sliders:   'M4 8h10 M18 8h2 M4 16h2 M10 16h10 M16 6v4 M8 14v4',
  sparkle:   'M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6Z',
};

export function Icon({ name, size = 16, stroke = 'currentColor', sw = 1.6, fill = 'none', style }) {
  const d = ICON_PATHS[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
         strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
         style={{ display: 'block', flexShrink: 0, ...style }} aria-hidden="true">
      {d.split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg} />)}
    </svg>
  );
}
