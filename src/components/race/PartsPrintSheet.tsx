// ═══════════════════════════════════════════════════════════════════════
// PARTS PRINT SHEET — printable standalone-parts report for ONE component
// ═══════════════════════════════════════════════════════════════════════
// Renders a hidden, print-only container (#mc-print-root) containing a clean
// white report: component header (name, serial, install / refresh dates,
// total passes) + a table of every standalone part with passes, wear limit,
// percent of limit used, date replaced and notes. Rows at or over their wear
// limit are highlighted.
//
// It mounts, waits a frame so the DOM is painted, then calls window.print().
// The @media print rules below hide the entire app chrome (nav, modals, etc.)
// by flipping visibility, so the browser's print / Save-as-PDF dialog shows
// ONLY this sheet.
//
// Used by: src/components/race/MainComponents.tsx
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import { ComponentPart } from '@/lib/database';
import { ExportableComponent, getTabLabel } from '@/lib/mainComponentsIO';

interface PartsPrintSheetProps {
  /** The component being printed (null = nothing to print) */
  component: ExportableComponent | null;
  /** That component's standalone parts */
  parts: ComponentPart[];
  /** partId -> wear limit (max passes before replacement) */
  wearThresholds: Record<string, number>;
  /** Called after the print dialog closes so the parent can clear its state */
  onDone: () => void;
}

const PRINT_CSS = `
/* Hidden on screen — only ever visible in the print output */
#mc-print-root { display: none; }

@media print {
  /* Hide the entire app chrome */
  body * { visibility: hidden !important; }

  /* …except the print sheet */
  #mc-print-root,
  #mc-print-root * { visibility: visible !important; }

  #mc-print-root {
    display: block !important;
    position: absolute !important;
    left: 0;
    top: 0;
    width: 100%;
    background: #ffffff !important;
    color: #000000 !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  @page { margin: 12mm; }

  #mc-print-root .mcp-title {
    font-size: 20pt;
    font-weight: 700;
    margin: 0 0 2px 0;
  }
  #mc-print-root .mcp-subtitle {
    font-size: 10pt;
    color: #555;
    margin: 0 0 14px 0;
  }
  #mc-print-root .mcp-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 28px;
    border: 1px solid #bbb;
    border-radius: 4px;
    padding: 10px 12px;
    margin-bottom: 16px;
    font-size: 10pt;
  }
  #mc-print-root .mcp-meta div { min-width: 150px; }
  #mc-print-root .mcp-meta .k {
    color: #555;
    text-transform: uppercase;
    font-size: 7.5pt;
    letter-spacing: 0.06em;
    display: block;
  }
  #mc-print-root .mcp-meta .v { font-weight: 600; font-size: 10.5pt; }

  #mc-print-root table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
  }
  #mc-print-root thead { display: table-header-group; }
  #mc-print-root th {
    text-align: left;
    border-bottom: 2px solid #333;
    padding: 6px 6px;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #333;
  }
  #mc-print-root td {
    border-bottom: 1px solid #ddd;
    padding: 6px 6px;
    vertical-align: top;
  }
  #mc-print-root tr { page-break-inside: avoid; }
  #mc-print-root .num { text-align: center; white-space: nowrap; }
  #mc-print-root .over td {
    background: #ffe3e3 !important;
    font-weight: 700;
    color: #8a0000 !important;
  }
  #mc-print-root .warn td { background: #fff6da !important; }
  #mc-print-root .mcp-flag {
    font-size: 7.5pt;
    font-weight: 700;
    border: 1px solid #8a0000;
    border-radius: 3px;
    padding: 0 4px;
    margin-left: 6px;
  }
  #mc-print-root .mcp-foot {
    margin-top: 18px;
    padding-top: 8px;
    border-top: 1px solid #ccc;
    font-size: 8pt;
    color: #666;
  }
  #mc-print-root .mcp-empty {
    border: 1px dashed #999;
    padding: 20px;
    text-align: center;
    color: #666;
    font-size: 10pt;
  }
}
`;

const PartsPrintSheet: React.FC<PartsPrintSheetProps> = ({
  component,
  parts,
  wearThresholds,
  onDone,
}) => {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!component || firedRef.current) return;
    firedRef.current = true;

    const handleAfterPrint = () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      onDone();
    };
    window.addEventListener('afterprint', handleAfterPrint);

    // Wait a frame so the sheet is in the DOM before the dialog opens
    const timer = setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.warn('[PartsPrintSheet] window.print() failed:', err);
        onDone();
      }
      // Safari/iOS never fire afterprint reliably — clean up defensively
      setTimeout(() => {
        window.removeEventListener('afterprint', handleAfterPrint);
        onDone();
      }, 1500);
    }, 120);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [component]);

  if (!component) return null;

  const totalParts = parts.length;
  const overCount = parts.filter(p => {
    const limit = wearThresholds[p.id] || 0;
    return limit > 0 && p.passesOnPart >= limit;
  }).length;

  const printedOn = new Date().toLocaleString();

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div id="mc-print-root">
        <h1 className="mcp-title">{component.name}</h1>
        <p className="mcp-subtitle">
          {getTabLabel(component.tabId)} — Standalone Parts Sheet
        </p>

        <div className="mcp-meta">
          <div>
            <span className="k">Serial Number</span>
            <span className="v">{component.serialNumber || 'N/A'}</span>
          </div>
          <div>
            <span className="k">Install Date</span>
            <span className="v">{component.installDate || 'N/A'}</span>
          </div>
          <div>
            <span className="k">Refresh Date</span>
            <span className="v">{component.refreshDate || 'N/A'}</span>
          </div>
          <div>
            <span className="k">Removal Date</span>
            <span className="v">{component.removalDate || 'N/A'}</span>
          </div>
          <div>
            <span className="k">Total Passes</span>
            <span className="v">{component.totalPasses}</span>
          </div>
          <div>
            <span className="k">Since Rebuild / Refresh</span>
            <span className="v">{component.passesSinceRebuild}</span>
          </div>
          <div>
            <span className="k">Currently Installed</span>
            <span className="v">{component.currentlyInstalled ? 'Yes' : 'No'}</span>
          </div>
          <div>
            <span className="k">Parts Tracked</span>
            <span className="v">
              {totalParts}
              {overCount > 0 ? ` (${overCount} over limit)` : ''}
            </span>
          </div>
        </div>

        {totalParts === 0 ? (
          <div className="mcp-empty">No standalone parts are tracked on this component.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Part Name</th>
                <th className="num" style={{ width: '9%' }}>Passes</th>
                <th className="num" style={{ width: '9%' }}>Wear Limit</th>
                <th className="num" style={{ width: '11%' }}>% of Limit</th>
                <th className="num" style={{ width: '14%' }}>Date Replaced</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {parts.map(p => {
                const limit = wearThresholds[p.id] || 0;
                const pct = limit > 0 ? Math.round((p.passesOnPart / limit) * 100) : null;
                const over = limit > 0 && p.passesOnPart >= limit;
                const warn = !over && pct !== null && pct >= 80;
                return (
                  <tr key={p.id} className={over ? 'over' : warn ? 'warn' : ''}>
                    <td>
                      {p.partName}
                      {over && <span className="mcp-flag">REPLACE</span>}
                    </td>
                    <td className="num">{p.passesOnPart}</td>
                    <td className="num">{limit > 0 ? limit : '—'}</td>
                    <td className="num">{pct !== null ? `${pct}%` : '—'}</td>
                    <td className="num">{p.dateReplaced || '—'}</td>
                    <td>{p.notes || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="mcp-foot">
          Printed {printedOn} · Component ID: {component.id} · Rows highlighted red have
          reached or exceeded their wear limit.
        </div>
      </div>
    </>
  );
};

export default PartsPrintSheet;
