import { RaceEvent } from '@/components/race/RaceCalendar';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface TimelineReportEntry {
  id: string;
  type: 'pass' | 'weather' | 'maintenance' | 'checklist' | 'workorder' | 'activity';
  timestamp: Date;
  title: string;
  subtitle?: string;
  actor?: string;
  actorRole?: string;
  details: Record<string, string | number | undefined>;
}

interface ReportData {
  event: RaceEvent;
  entries: TimelineReportEntry[];
  teamName: string;
  generatedBy: string;
  stats: {
    totalPasses: number;
    bestET: number | null;
    bestMPH: number | null;
    checklistCompletion: number;
    maintenanceActions: number;
    workOrdersCompleted: number;
    weatherSnapshots: number;
  };
}

// ─── Color map for entry types ───────────────────────────────────────────────
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  pass:        { bg: '#064e3b', text: '#34d399', border: '#059669', label: 'Pass' },
  weather:     { bg: '#0c4a6e', text: '#38bdf8', border: '#0284c7', label: 'Weather' },
  maintenance: { bg: '#451a03', text: '#fbbf24', border: '#d97706', label: 'Maintenance' },
  checklist:   { bg: '#2e1065', text: '#a78bfa', border: '#7c3aed', label: 'Checklist' },
  workorder:   { bg: '#4c0519', text: '#fb7185', border: '#e11d48', label: 'Work Order' },
  activity:    { bg: '#1e293b', text: '#94a3b8', border: '#475569', label: 'Activity' },
};

// ─── Format time ─────────────────────────────────────────────────────────────
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

// ─── Generate the report HTML ────────────────────────────────────────────────
const generateReportHTML = (data: ReportData): string => {
  const { event, entries, teamName, generatedBy, stats } = data;

  // Group entries by date
  const groupedByDate = new Map<string, TimelineReportEntry[]>();
  entries.forEach(entry => {
    const dateKey = entry.timestamp.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    if (!groupedByDate.has(dateKey)) groupedByDate.set(dateKey, []);
    groupedByDate.get(dateKey)!.push(entry);
  });

  // Build date sections
  let timelineSections = '';
  groupedByDate.forEach((dateEntries, dateKey) => {
    const dateLabel = new Date(dateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    let entriesHTML = '';
    dateEntries.forEach(entry => {
      const tc = TYPE_COLORS[entry.type] || TYPE_COLORS.activity;
      const detailsHTML = Object.entries(entry.details)
        .filter(([_, v]) => v !== undefined && v !== '' && v !== '—')
        .map(([k, v]) => `
          <div style="margin-right: 16px; margin-bottom: 4px;">
            <span style="color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">${k}</span>
            <div style="color: #e2e8f0; font-size: 11px; font-family: 'Courier New', monospace;">${String(v)}</div>
          </div>
        `).join('');

      entriesHTML += `
        <div style="display: flex; gap: 12px; margin-bottom: 12px; page-break-inside: avoid;">
          <div style="flex-shrink: 0; width: 60px; text-align: right; padding-top: 4px;">
            <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">${formatTime(entry.timestamp)}</div>
          </div>
          <div style="flex-shrink: 0; width: 12px; display: flex; flex-direction: column; align-items: center;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${tc.border}; border: 2px solid ${tc.text}; flex-shrink: 0;"></div>
            <div style="width: 1px; flex: 1; background: #334155; margin-top: 4px;"></div>
          </div>
          <div style="flex: 1; background: ${tc.bg}; border: 1px solid ${tc.border}40; border-radius: 8px; padding: 10px 14px; margin-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: ${tc.text}; background: ${tc.border}30; padding: 2px 6px; border-radius: 4px;">${tc.label}</span>
              ${entry.actor ? `<span style="font-size: 10px; color: #94a3b8;">${entry.actor}${entry.actorRole ? ` (${entry.actorRole})` : ''}</span>` : ''}
            </div>
            <div style="font-size: 12px; font-weight: 600; color: #f1f5f9; margin-bottom: 2px;">${entry.title}</div>
            ${entry.subtitle ? `<div style="font-size: 10px; color: #94a3b8; margin-bottom: 6px;">${entry.subtitle}</div>` : ''}
            ${detailsHTML ? `<div style="display: flex; flex-wrap: wrap; margin-top: 6px; padding-top: 6px; border-top: 1px solid ${tc.border}30;">${detailsHTML}</div>` : ''}
          </div>
        </div>
      `;
    });

    timelineSections += `
      <div style="margin-bottom: 24px; page-break-inside: avoid;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 6px 14px;">
            <span style="font-size: 13px; font-weight: 700; color: #f1f5f9;">${dateLabel}</span>
            <span style="font-size: 10px; color: #64748b; margin-left: 8px;">${dateEntries.length} entries</span>
          </div>
          <div style="flex: 1; height: 1px; background: #334155;"></div>
        </div>
        ${entriesHTML}
      </div>
    `;
  });

  // Type counts for summary
  const typeCounts = entries.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeCountsHTML = Object.entries(typeCounts).map(([type, count]) => {
    const tc = TYPE_COLORS[type] || TYPE_COLORS.activity;
    return `
      <div style="text-align: center; padding: 12px; background: ${tc.bg}; border: 1px solid ${tc.border}40; border-radius: 8px;">
        <div style="font-size: 22px; font-weight: 800; color: ${tc.text};">${count}</div>
        <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">${tc.label}s</div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Race Day Report — ${event.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      padding: 32px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @media print {
      body { padding: 16px; }
      .no-print { display: none !important; }
      @page { margin: 0.5in; size: letter; }
    }
  </style>
</head>
<body>
  <!-- Print Button -->
  <div class="no-print" style="position: fixed; top: 16px; right: 16px; z-index: 100; display: flex; gap: 8px;">
    <button onclick="window.print()" style="padding: 10px 24px; background: linear-gradient(135deg, #f97316, #dc2626); color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer;">
      Print / Save as PDF
    </button>
    <button onclick="window.close()" style="padding: 10px 16px; background: #334155; color: #94a3b8; border: 1px solid #475569; border-radius: 8px; font-size: 14px; cursor: pointer;">
      Close
    </button>
  </div>

  <!-- Header -->
  <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #334155;">
    <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #f97316; font-weight: 700; margin-bottom: 8px;">Race Day Report</div>
    <h1 style="font-size: 28px; font-weight: 800; color: #f1f5f9; margin-bottom: 4px;">${event.title}</h1>
    <div style="font-size: 14px; color: #94a3b8;">
      ${event.trackName}${event.trackLocation ? ` — ${event.trackLocation}` : ''}
    </div>
    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
      ${event.startDate}${event.endDate && event.endDate !== event.startDate ? ` to ${event.endDate}` : ''}
      ${event.sanctioningBody ? ` | ${event.sanctioningBody}` : ''}
    </div>
    <div style="font-size: 11px; color: #475569; margin-top: 12px;">
      ${teamName} | Generated by ${generatedBy} | ${new Date().toLocaleString()}
    </div>
  </div>

  <!-- Summary Stats -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; margin-bottom: 32px;">
    <div style="text-align: center; padding: 14px; background: #1e293b; border: 1px solid #334155; border-radius: 8px;">
      <div style="font-size: 26px; font-weight: 800; color: #f1f5f9;">${entries.length}</div>
      <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Total Events</div>
    </div>
    ${typeCountsHTML}
    ${stats.bestET ? `
    <div style="text-align: center; padding: 14px; background: #064e3b; border: 1px solid #05966840; border-radius: 8px;">
      <div style="font-size: 22px; font-weight: 800; color: #34d399; font-family: 'Courier New', monospace;">${stats.bestET.toFixed(3)}</div>
      <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Best ET</div>
    </div>` : ''}
    ${stats.bestMPH ? `
    <div style="text-align: center; padding: 14px; background: #0c4a6e; border: 1px solid #0284c740; border-radius: 8px;">
      <div style="font-size: 22px; font-weight: 800; color: #38bdf8; font-family: 'Courier New', monospace;">${stats.bestMPH.toFixed(1)}</div>
      <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Best MPH</div>
    </div>` : ''}
  </div>

  <!-- Timeline -->
  <div style="margin-bottom: 32px;">
    <h2 style="font-size: 18px; font-weight: 700; color: #f1f5f9; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
      <span style="display: inline-block; width: 4px; height: 20px; background: linear-gradient(180deg, #f97316, #dc2626); border-radius: 2px;"></span>
      Race Day Timeline
      <span style="font-size: 11px; color: #64748b; font-weight: 400;">${entries.length} entries</span>
    </h2>
    ${timelineSections || '<div style="text-align: center; padding: 40px; color: #64748b;">No timeline entries for this event.</div>'}
  </div>

  <!-- Footer -->
  <div style="text-align: center; padding-top: 24px; border-top: 1px solid #334155; color: #475569; font-size: 10px;">
    Pro Mod Logbook — Race Day Report — ${new Date().toLocaleDateString()} — Page 1
  </div>
</body>
</html>`;
};

// ─── Export function ─────────────────────────────────────────────────────────
export const exportTimelineReport = (data: ReportData): void => {
  const html = generateReportHTML(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => {
      URL.revokeObjectURL(url);
    });
  } else {
    // Fallback: download as HTML file
    const link = document.createElement('a');
    link.href = url;
    link.download = `race-day-report-${data.event.startDate}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

export default exportTimelineReport;
