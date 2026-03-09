// ===== EXPENSE EXPORT UTILITIES =====
// Handles CSV export, printable PDF reports, per-event reports, and monthly statements

export interface ExportableExpense {
  id: string;
  category: string;
  custom_description: string | null;
  amount: number;
  expense_date: string;
  paid_by: string | null;
  payment_method: string | null;
  receipt_url: string | null;
  receipt_file_type: string | null;
  notes: string | null;
  race_event_id: string | null;
  add_to_cost_report: boolean;
  created_at: string;
}


export interface ExportOptions {
  teamName?: string;
  teamLogo?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  title?: string;
}

// ===== HELPERS =====
const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const formatDateLong = (dateStr: string): string => {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const getDisplayCategory = (exp: ExportableExpense): string => {
  if (exp.category === 'Other' && exp.custom_description) return exp.custom_description;
  return exp.category;
};


const filterByDateRange = (
  expenses: ExportableExpense[],
  start?: string,
  end?: string
): ExportableExpense[] => {
  let filtered = [...expenses];
  if (start) filtered = filtered.filter(e => e.expense_date >= start);
  if (end) filtered = filtered.filter(e => e.expense_date <= end);
  return filtered.sort((a, b) => a.expense_date.localeCompare(b.expense_date));
};

const escapeCSV = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const CATEGORY_COLORS: Record<string, string> = {
  'Fuel for Generators': '#f97316',
  'Fuel for Support Vehicles': '#ea580c',
  'Rental Car': '#3b82f6',
  'Air Travel': '#8b5cf6',
  'Hotel and Lodging': '#06b6d4',
  'Food and Beverages': '#22c55e',
  'Apparel and Uniforms': '#ec4899',
  'Tools and Equipment': '#eab308',
  'Entry Fees': '#ef4444',
  'Towing and Transport': '#14b8a6',
  'Parking and Tolls': '#6366f1',
  'Other': '#64748b',
};

// ===== 1. CSV EXPORT =====
export const exportToCSV = (
  expenses: ExportableExpense[],
  options?: ExportOptions
): void => {
  const filtered = filterByDateRange(expenses, options?.dateRangeStart, options?.dateRangeEnd);

  const headers = [
    'Date', 'Category', 'Description', 'Amount', 'Paid By',
    'Payment Method', 'Linked Event', 'Notes', 'In Cost Report',
    'Receipt', 'Created'
  ];

  const rows = filtered.map(exp => [
    exp.expense_date,
    exp.category,
    getDisplayCategory(exp),
    exp.amount.toFixed(2),
    exp.paid_by || '',
    exp.payment_method || '',
    exp.race_event_id || '',
    exp.notes || '',
    exp.add_to_cost_report ? 'Yes' : 'No',
    exp.receipt_url ? 'Yes' : '',
    exp.created_at ? new Date(exp.created_at).toLocaleString() : ''
  ]);


  // Add total row
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);
  rows.push(['', '', 'TOTAL', total.toFixed(2), '', '', '', '', '', '', '']);

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `misc_expenses_${dateStr}.csv`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
};

// ===== SHARED PDF STYLES =====
const getPDFStyles = (): string => `
  @page { margin: 0.6in; size: letter; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1e293b;
    line-height: 1.5;
    font-size: 11px;
    background: #fff;
  }
  .report-container { max-width: 8in; margin: 0 auto; padding: 0.25in 0; }
  .header { border-bottom: 3px solid #f97316; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header-left h1 { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
  .header-left .subtitle { font-size: 13px; color: #64748b; margin-top: 2px; }
  .header-right { text-align: right; }
  .header-right .team-name { font-size: 16px; font-weight: 700; color: #0f172a; }
  .header-right .date-range { font-size: 11px; color: #64748b; margin-top: 2px; }
  .header-right .generated { font-size: 9px; color: #94a3b8; margin-top: 4px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 14px; font-weight: 700; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .section-title .icon { width: 18px; height: 18px; background: #f97316; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #f1f5f9; color: #475569; font-weight: 600; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  tr:hover td { background: #f8fafc; }
  .amount { font-weight: 600; color: #059669; text-align: right; font-variant-numeric: tabular-nums; }
  .total-row td { font-weight: 700; border-top: 2px solid #0f172a; border-bottom: none; background: #f8fafc !important; font-size: 11px; }
  .total-row .amount { color: #0f172a; font-size: 12px; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
  .summary-card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; }
  .summary-card .value { font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 2px; }
  .summary-card .sub { font-size: 9px; color: #94a3b8; margin-top: 2px; }
  .category-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .category-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .category-name { flex: 1; font-size: 10px; color: #334155; }
  .category-amount { font-size: 10px; font-weight: 600; color: #059669; min-width: 70px; text-align: right; }
  .category-pct { font-size: 9px; color: #94a3b8; min-width: 40px; text-align: right; }
  .bar-bg { flex: 0 0 100px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; }
  .event-header { background: #0f172a; color: white; padding: 10px 14px; border-radius: 6px 6px 0 0; margin-top: 16px; }
  .event-header h3 { font-size: 13px; font-weight: 700; }
  .event-header .event-total { font-size: 11px; color: #94a3b8; }
  .event-table { border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 6px 6px; overflow: hidden; margin-bottom: 4px; }
  .month-header { background: linear-gradient(135deg, #1e293b, #334155); color: white; padding: 12px 16px; border-radius: 8px; margin-top: 20px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
  .month-header h3 { font-size: 15px; font-weight: 700; }
  .month-header .month-total { font-size: 13px; font-weight: 600; color: #4ade80; }
  .statement-meta { display: flex; justify-content: space-between; font-size: 9px; color: #64748b; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; margin-bottom: 8px; }
  .running-total { text-align: right; font-size: 9px; color: #64748b; font-style: italic; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; color: #94a3b8; }
  .footer .confidential { font-weight: 600; color: #64748b; margin-bottom: 2px; }
  .page-break { page-break-before: always; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
`;

const getHeaderHTML = (title: string, subtitle: string, options?: ExportOptions): string => {
  const dateRange = (options?.dateRangeStart || options?.dateRangeEnd)
    ? `${options?.dateRangeStart ? formatDateLong(options.dateRangeStart) : 'Start'} — ${options?.dateRangeEnd ? formatDateLong(options.dateRangeEnd) : 'Present'}`
    : 'All Time';

  return `
    <div class="header">
      <div class="header-left">
        <h1>${title}</h1>
        <div class="subtitle">${subtitle}</div>
      </div>
      <div class="header-right">
        <div class="team-name">${options?.teamName || 'Race Team'}</div>
        <div class="date-range">${dateRange}</div>
        <div class="generated">Generated: ${new Date().toLocaleString()}</div>
      </div>
    </div>
  `;
};

const getFooterHTML = (teamName?: string): string => `
  <div class="footer">
    <div class="confidential">CONFIDENTIAL — ${teamName || 'Race Team'}</div>
    <div>This report was generated by RaceTrack Pro. All amounts in USD.</div>
  </div>
`;

const openPrintWindow = (html: string, title: string): void => {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('Please allow popups to generate the PDF report.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  // Give time for styles to load
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
};

// ===== 2. PRINTABLE PDF — EXPENSE SUMMARY REPORT =====
export const exportSummaryPDF = (
  expenses: ExportableExpense[],
  options?: ExportOptions
): void => {
  const filtered = filterByDateRange(expenses, options?.dateRangeStart, options?.dateRangeEnd);
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

  // Category breakdown
  const byCategory: Record<string, { total: number; count: number }> = {};
  filtered.forEach(e => {
    const key = getDisplayCategory(e);
    if (!byCategory[key]) byCategory[key] = { total: 0, count: 0 };
    byCategory[key].total += Number(e.amount);
    byCategory[key].count += 1;
  });
  const categoryBreakdown = Object.entries(byCategory)
    .map(([name, data]) => ({ name, ...data, pct: total > 0 ? (data.total / total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);

  // Payment method breakdown
  const byPayment: Record<string, number> = {};
  filtered.forEach(e => {
    const key = e.payment_method || 'Unspecified';
    byPayment[key] = (byPayment[key] || 0) + Number(e.amount);
  });

  // Paid by breakdown
  const byPaidBy: Record<string, number> = {};
  filtered.forEach(e => {
    const key = e.paid_by || 'Unspecified';
    byPaidBy[key] = (byPaidBy[key] || 0) + Number(e.amount);
  });

  const avgPerExpense = filtered.length > 0 ? total / filtered.length : 0;

  const categoryRowsHTML = categoryBreakdown.map(cat => {
    const color = CATEGORY_COLORS[cat.name] || '#64748b';
    return `
      <div class="category-bar">
        <div class="category-dot" style="background:${color}"></div>
        <div class="category-name">${cat.name} <span style="color:#94a3b8">(${cat.count})</span></div>
        <div class="bar-bg"><div class="bar-fill" style="width:${cat.pct}%;background:${color}"></div></div>
        <div class="category-pct">${cat.pct.toFixed(1)}%</div>
        <div class="category-amount">${formatCurrency(cat.total)}</div>
      </div>
    `;
  }).join('');

  const paymentRowsHTML = Object.entries(byPayment)
    .sort(([,a], [,b]) => b - a)
    .map(([method, amt]) => `
      <tr><td>${method}</td><td class="amount">${formatCurrency(amt)}</td></tr>
    `).join('');

  const paidByRowsHTML = Object.entries(byPaidBy)
    .sort(([,a], [,b]) => b - a)
    .map(([person, amt]) => `
      <tr><td>${person}</td><td class="amount">${formatCurrency(amt)}</td></tr>
    `).join('');

  const detailRowsHTML = filtered.map(exp => `
    <tr>
      <td>${formatDate(exp.expense_date)}</td>
      <td>${getDisplayCategory(exp)}</td>
      <td>${exp.paid_by || '—'}</td>
      <td>${exp.payment_method || '—'}</td>
      <td>${exp.race_event_id || '—'}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${exp.notes || '—'}</td>
      <td class="amount">${formatCurrency(exp.amount)}</td>
    </tr>
  `).join('');


  const html = `<!DOCTYPE html><html><head><title>Expense Summary Report</title><style>${getPDFStyles()}</style></head><body>
    <div class="report-container">
      ${getHeaderHTML('Expense Summary Report', 'Miscellaneous Expenses Overview', options)}

      <div class="summary-grid">
        <div class="summary-card">
          <div class="label">Total Expenses</div>
          <div class="value">${formatCurrency(total)}</div>
          <div class="sub">${filtered.length} expense entries</div>
        </div>
        <div class="summary-card">
          <div class="label">Average per Expense</div>
          <div class="value">${formatCurrency(avgPerExpense)}</div>
          <div class="sub">${categoryBreakdown.length} categories used</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title"><div class="icon">C</div> Breakdown by Category</div>
        ${categoryRowsHTML}
      </div>

      <div class="summary-grid">
        <div class="section">
          <div class="section-title"><div class="icon">P</div> By Payment Method</div>
          <table>${paymentRowsHTML}</table>
        </div>
        <div class="section">
          <div class="section-title"><div class="icon">T</div> By Team Member</div>
          <table>${paidByRowsHTML}</table>
        </div>
      </div>

      <div class="section">
        <div class="section-title"><div class="icon">D</div> Detailed Expense List</div>
        <table>
          <thead>
            <tr><th>Date</th><th>Category</th><th>Paid By</th><th>Payment</th><th>Event</th><th>Notes</th><th style="text-align:right">Amount</th></tr>
          </thead>
          <tbody>
            ${detailRowsHTML}
            <tr class="total-row">
              <td colspan="6" style="text-align:right">TOTAL</td>
              <td class="amount">${formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${getFooterHTML(options?.teamName)}
    </div>
  </body></html>`;

  openPrintWindow(html, 'Expense Summary Report');
};

// ===== 3. PER-EVENT EXPENSE REPORT =====
export const exportPerEventPDF = (
  expenses: ExportableExpense[],
  options?: ExportOptions
): void => {
  const filtered = filterByDateRange(expenses, options?.dateRangeStart, options?.dateRangeEnd);
  const grandTotal = filtered.reduce((s, e) => s + Number(e.amount), 0);

  // Group by event
  const byEvent: Record<string, { name: string; expenses: ExportableExpense[]; total: number }> = {};
  filtered.forEach(e => {
    const eventKey = e.race_event_id || '__unlinked__';
    const eventName = e.race_event_id || 'Unlinked Expenses';
    if (!byEvent[eventKey]) byEvent[eventKey] = { name: eventName, expenses: [], total: 0 };
    byEvent[eventKey].expenses.push(e);
    byEvent[eventKey].total += Number(e.amount);
  });


  const eventEntries = Object.entries(byEvent).sort(([,a], [,b]) => b.total - a.total);

  // Event summary table
  const eventSummaryHTML = eventEntries.map(([, ev]) => `
    <tr>
      <td><strong>${ev.name}</strong></td>
      <td style="text-align:center">${ev.expenses.length}</td>
      <td class="amount">${formatCurrency(ev.total)}</td>
      <td class="amount" style="color:#64748b">${grandTotal > 0 ? ((ev.total / grandTotal) * 100).toFixed(1) : 0}%</td>
    </tr>
  `).join('');

  // Per-event detail sections
  const eventSectionsHTML = eventEntries.map(([eventKey, ev]) => {
    // Category breakdown within event
    const catBreakdown: Record<string, number> = {};
    ev.expenses.forEach(e => {
      const cat = getDisplayCategory(e);
      catBreakdown[cat] = (catBreakdown[cat] || 0) + Number(e.amount);
    });

    const catSummaryHTML = Object.entries(catBreakdown)
      .sort(([,a], [,b]) => b - a)
      .map(([cat, amt]) => {
        const color = CATEGORY_COLORS[cat] || '#64748b';
        return `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:9px;color:#475569">
          <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
          ${cat}: <strong>${formatCurrency(amt)}</strong>
        </span>`;
      }).join('');

    const rowsHTML = ev.expenses
      .sort((a, b) => a.expense_date.localeCompare(b.expense_date))
      .map(exp => `
        <tr>
          <td>${formatDate(exp.expense_date)}</td>
          <td>${getDisplayCategory(exp)}</td>
          <td>${exp.paid_by || '—'}</td>
          <td>${exp.payment_method || '—'}</td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${exp.notes || '—'}</td>
          <td class="amount">${formatCurrency(exp.amount)}</td>
        </tr>
      `).join('');

    return `
      <div class="event-header">
        <h3>${ev.name}</h3>
        <div class="event-total">${ev.expenses.length} expenses — ${formatCurrency(ev.total)}</div>
      </div>
      <div style="padding:8px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;font-size:9px">
        ${catSummaryHTML}
      </div>
      <div class="event-table">
        <table>
          <thead>
            <tr><th>Date</th><th>Category</th><th>Paid By</th><th>Payment</th><th>Notes</th><th style="text-align:right">Amount</th></tr>
          </thead>
          <tbody>
            ${rowsHTML}
            <tr class="total-row">
              <td colspan="5" style="text-align:right">Event Total</td>
              <td class="amount">${formatCurrency(ev.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html><html><head><title>Per-Event Expense Report</title><style>${getPDFStyles()}</style></head><body>
    <div class="report-container">
      ${getHeaderHTML('Per-Event Expense Report', 'Expenses Grouped by Race Event — Sponsor Reporting', options)}

      <div class="summary-grid">
        <div class="summary-card">
          <div class="label">Grand Total</div>
          <div class="value">${formatCurrency(grandTotal)}</div>
          <div class="sub">${filtered.length} total expenses</div>
        </div>
        <div class="summary-card">
          <div class="label">Events</div>
          <div class="value">${eventEntries.length}</div>
          <div class="sub">race events with expenses</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title"><div class="icon">E</div> Event Summary</div>
        <table>
          <thead>
            <tr><th>Event</th><th style="text-align:center">Entries</th><th style="text-align:right">Total</th><th style="text-align:right">% of Total</th></tr>
          </thead>
          <tbody>
            ${eventSummaryHTML}
            <tr class="total-row">
              <td>GRAND TOTAL</td>
              <td style="text-align:center">${filtered.length}</td>
              <td class="amount">${formatCurrency(grandTotal)}</td>
              <td class="amount" style="color:#64748b">100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="section">
        <div class="section-title"><div class="icon">D</div> Detailed Breakdown by Event</div>
        ${eventSectionsHTML}
      </div>

      ${getFooterHTML(options?.teamName)}
    </div>
  </body></html>`;

  openPrintWindow(html, 'Per-Event Expense Report');
};

// ===== 4. MONTHLY EXPENSE STATEMENT =====
export const exportMonthlyStatementPDF = (
  expenses: ExportableExpense[],
  options?: ExportOptions
): void => {
  const filtered = filterByDateRange(expenses, options?.dateRangeStart, options?.dateRangeEnd);
  const grandTotal = filtered.reduce((s, e) => s + Number(e.amount), 0);

  // Group by month
  const byMonth: Record<string, ExportableExpense[]> = {};
  filtered.forEach(e => {
    const d = new Date(e.expense_date + 'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(e);
  });

  const monthKeys = Object.keys(byMonth).sort();

  let runningTotal = 0;

  const monthSectionsHTML = monthKeys.map(monthKey => {
    const [year, month] = monthKey.split('-');
    const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const monthExpenses = byMonth[monthKey].sort((a, b) => a.expense_date.localeCompare(b.expense_date));
    const monthTotal = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const openingBalance = runningTotal;
    runningTotal += monthTotal;

    const rowsHTML = monthExpenses.map((exp, idx) => {
      const lineRunning = openingBalance + monthExpenses.slice(0, idx + 1).reduce((s, e) => s + Number(e.amount), 0);
      return `
        <tr>
          <td>${formatDate(exp.expense_date)}</td>
          <td>${getDisplayCategory(exp)}</td>
          <td>${exp.paid_by || '—'}</td>
          <td>${exp.payment_method || '—'}</td>
          <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${exp.notes || '—'}</td>
          <td class="amount">${formatCurrency(exp.amount)}</td>
          <td class="running-total">${formatCurrency(lineRunning)}</td>
        </tr>
      `;
    }).join('');

    // Category mini-breakdown
    const catBreakdown: Record<string, number> = {};
    monthExpenses.forEach(e => {
      const cat = getDisplayCategory(e);
      catBreakdown[cat] = (catBreakdown[cat] || 0) + Number(e.amount);
    });
    const topCategories = Object.entries(catBreakdown)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([cat, amt]) => `<span style="margin-right:10px;font-size:9px;color:#cbd5e1">${cat}: <strong style="color:#4ade80">${formatCurrency(amt)}</strong></span>`)
      .join('');

    return `
      <div class="month-header">
        <div>
          <h3>${monthName}</h3>
          <div style="font-size:9px;color:#94a3b8;margin-top:2px">${monthExpenses.length} transactions</div>
        </div>
        <div class="month-total">${formatCurrency(monthTotal)}</div>
      </div>
      <div class="statement-meta">
        <span>Opening Balance: ${formatCurrency(openingBalance)}</span>
        <span>Closing Balance: ${formatCurrency(runningTotal)}</span>
      </div>
      <div style="padding:4px 0 8px;font-size:9px">${topCategories}</div>
      <table>
        <thead>
          <tr><th>Date</th><th>Description</th><th>Paid By</th><th>Payment</th><th>Notes</th><th style="text-align:right">Amount</th><th style="text-align:right">Running Total</th></tr>
        </thead>
        <tbody>
          ${rowsHTML}
          <tr class="total-row">
            <td colspan="5" style="text-align:right">Month Total</td>
            <td class="amount">${formatCurrency(monthTotal)}</td>
            <td class="amount" style="color:#64748b">${formatCurrency(runningTotal)}</td>
          </tr>
        </tbody>
      </table>
    `;
  }).join('');

  // Monthly summary table
  const monthlySummaryHTML = monthKeys.map(monthKey => {
    const [year, month] = monthKey.split('-');
    const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    const monthTotal = byMonth[monthKey].reduce((s, e) => s + Number(e.amount), 0);
    const pct = grandTotal > 0 ? (monthTotal / grandTotal) * 100 : 0;
    return `
      <tr>
        <td><strong>${monthName}</strong></td>
        <td style="text-align:center">${byMonth[monthKey].length}</td>
        <td class="amount">${formatCurrency(monthTotal)}</td>
        <td class="amount" style="color:#64748b">${pct.toFixed(1)}%</td>
      </tr>
    `;
  }).join('');

  const html = `<!DOCTYPE html><html><head><title>Monthly Expense Statement</title><style>${getPDFStyles()}</style></head><body>
    <div class="report-container">
      ${getHeaderHTML('Monthly Expense Statement', 'Itemized Monthly Breakdown — Credit Card Statement Style', options)}

      <div class="summary-grid">
        <div class="summary-card">
          <div class="label">Grand Total</div>
          <div class="value">${formatCurrency(grandTotal)}</div>
          <div class="sub">${filtered.length} transactions across ${monthKeys.length} month(s)</div>
        </div>
        <div class="summary-card">
          <div class="label">Monthly Average</div>
          <div class="value">${formatCurrency(monthKeys.length > 0 ? grandTotal / monthKeys.length : 0)}</div>
          <div class="sub">${(filtered.length / Math.max(monthKeys.length, 1)).toFixed(1)} avg transactions/month</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title"><div class="icon">M</div> Monthly Overview</div>
        <table>
          <thead>
            <tr><th>Month</th><th style="text-align:center">Transactions</th><th style="text-align:right">Total</th><th style="text-align:right">% of Total</th></tr>
          </thead>
          <tbody>
            ${monthlySummaryHTML}
            <tr class="total-row">
              <td>GRAND TOTAL</td>
              <td style="text-align:center">${filtered.length}</td>
              <td class="amount">${formatCurrency(grandTotal)}</td>
              <td class="amount" style="color:#64748b">100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="section">
        <div class="section-title"><div class="icon">S</div> Detailed Monthly Statements</div>
        ${monthSectionsHTML}
      </div>

      ${getFooterHTML(options?.teamName)}
    </div>
  </body></html>`;

  openPrintWindow(html, 'Monthly Expense Statement');
};

// ===== PER-EVENT CSV EXPORT =====
export const exportPerEventCSV = (
  expenses: ExportableExpense[],
  options?: ExportOptions
): void => {
  const filtered = filterByDateRange(expenses, options?.dateRangeStart, options?.dateRangeEnd);


  // Group by event
  const byEvent: Record<string, { name: string; expenses: ExportableExpense[] }> = {};
  filtered.forEach(e => {
    const key = e.race_event_id || '__unlinked__';
    const name = e.race_event_id || 'Unlinked';
    if (!byEvent[key]) byEvent[key] = { name, expenses: [] };
    byEvent[key].expenses.push(e);
  });


  const headers = ['Event', 'Date', 'Category', 'Description', 'Amount', 'Paid By', 'Payment Method', 'Notes'];
  const rows: string[][] = [];

  Object.values(byEvent).forEach(ev => {
    ev.expenses
      .sort((a, b) => a.expense_date.localeCompare(b.expense_date))
      .forEach(exp => {
        rows.push([
          ev.name,
          exp.expense_date,
          exp.category,
          getDisplayCategory(exp),
          exp.amount.toFixed(2),
          exp.paid_by || '',
          exp.payment_method || '',
          exp.notes || ''
        ]);
      });
    // Subtotal row
    const eventTotal = ev.expenses.reduce((s, e) => s + Number(e.amount), 0);
    rows.push([ev.name, '', '', `SUBTOTAL — ${ev.name}`, eventTotal.toFixed(2), '', '', '']);
    rows.push([]); // blank separator
  });

  // Grand total
  const grandTotal = filtered.reduce((s, e) => s + Number(e.amount), 0);
  rows.push(['', '', '', 'GRAND TOTAL', grandTotal.toFixed(2), '', '', '']);

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  const dateStr = new Date().toISOString().split('T')[0];
  downloadFile(csvContent, `expense_by_event_${dateStr}.csv`, 'text/csv;charset=utf-8;');
};
