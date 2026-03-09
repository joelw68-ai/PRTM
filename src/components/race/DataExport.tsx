import React, { useState, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { 
  ClipboardList, 
  CheckCircle, 
  Circle,
  RefreshCw,
  Printer,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const DataExport: React.FC = () => {
  const { 
    preRunChecklist, 
    betweenRoundsChecklist, 
    postRunChecklist,
    toggleChecklistItem,
    resetChecklist
  } = useApp();
  
  const [activeChecklist, setActiveChecklist] = useState<'preRun' | 'betweenRounds' | 'postRun'>('preRun');
  const printRef = useRef<HTMLDivElement>(null);

  const checklists = {
    preRun: { name: 'Pre-Run Checklist', items: preRunChecklist, description: 'Complete before every pass' },
    betweenRounds: { name: 'Between Rounds Quick-Hit', items: betweenRoundsChecklist, description: '10 essential items between elimination rounds' },
    postRun: { name: 'Post-Run Teardown', items: postRunChecklist, description: 'End of day / event teardown checklist' }
  };

  const currentChecklist = checklists[activeChecklist];
  const completedCount = currentChecklist.items.filter(i => i.completed).length;
  const totalCount = currentChecklist.items.length;
  const criticalIncomplete = currentChecklist.items.filter(i => i.critical && !i.completed).length;

  const categories = [...new Set(currentChecklist.items.map(i => i.category))];

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${currentChecklist.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            h2 { font-size: 18px; color: #666; margin-bottom: 20px; }
            .category { margin-bottom: 20px; }
            .category-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            .item { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee; }
            .checkbox { width: 20px; height: 20px; border: 2px solid #333; margin-right: 12px; }
            .critical { color: red; font-weight: bold; }
            .task { flex: 1; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>${currentChecklist.name}</h1>
          <h2>${currentChecklist.description}</h2>
          <p>Date: _____________ Event: _____________</p>
          ${categories.map(cat => `
            <div class="category">
              <div class="category-title">${cat}</div>
              ${currentChecklist.items.filter(i => i.category === cat).map(item => `
                <div class="item">
                  <div class="checkbox"></div>
                  <span class="task ${item.critical ? 'critical' : ''}">${item.task}${item.critical ? ' *' : ''}</span>
                </div>
              `).join('')}
            </div>
          `).join('')}
          <p style="margin-top: 20px; font-size: 12px;">* Critical items must be completed before proceeding</p>
          <p style="margin-top: 10px;">Completed by: _____________ Time: _____________</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Checklists</h2>
            <p className="text-slate-400">Pre-run, between-rounds, and post-run checklists</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={() => resetChecklist(activeChecklist)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        {/* Checklist Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(Object.keys(checklists) as Array<keyof typeof checklists>).map((key) => {
            const list = checklists[key];
            const completed = list.items.filter(i => i.completed).length;
            const total = list.items.length;
            
            return (
              <button
                key={key}
                onClick={() => setActiveChecklist(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeChecklist === key 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                {list.name}
                <span className={`ml-1 px-2 py-0.5 rounded text-xs ${
                  completed === total 
                    ? 'bg-green-500/30 text-green-400' 
                    : 'bg-slate-600 text-slate-300'
                }`}>
                  {completed}/{total}
                </span>
              </button>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-white">{currentChecklist.name}</h3>
            <span className="text-slate-400">{completedCount} of {totalCount} complete</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all ${
                completedCount === totalCount ? 'bg-green-500' : 'bg-orange-500'
              }`}
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
          {criticalIncomplete > 0 && (
            <div className="flex items-center gap-2 mt-3 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{criticalIncomplete} critical item(s) remaining</span>
            </div>
          )}
        </div>

        {/* Checklist Items */}
        <div ref={printRef} className="space-y-6">
          {categories.map((category) => {
            const categoryItems = currentChecklist.items.filter(i => i.category === category);
            const categoryComplete = categoryItems.filter(i => i.completed).length;
            
            return (
              <div key={category} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="bg-slate-900/50 px-4 py-3 border-b border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-white">{category}</h4>
                    <span className={`text-sm ${
                      categoryComplete === categoryItems.length ? 'text-green-400' : 'text-slate-400'
                    }`}>
                      {categoryComplete}/{categoryItems.length}
                    </span>
                  </div>
                </div>
                
                <div className="divide-y divide-slate-700/30">
                  {categoryItems.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => toggleChecklistItem(activeChecklist, item.id)}
                      className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors ${
                        item.completed ? 'bg-green-500/5' : 'hover:bg-slate-700/20'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                        item.completed 
                          ? 'bg-green-500 border-green-500' 
                          : item.critical 
                            ? 'border-red-500' 
                            : 'border-slate-500'
                      }`}>
                        {item.completed && <CheckCircle className="w-4 h-4 text-white" />}
                      </div>
                      
                      <div className="flex-1">
                        <span className={`${
                          item.completed ? 'text-slate-400 line-through' : 'text-white'
                        }`}>
                          {item.task}
                        </span>
                        {item.critical && !item.completed && (
                          <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                            CRITICAL
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Completion Status */}
        {completedCount === totalCount && (
          <div className="mt-6 bg-green-500/20 border border-green-500/50 rounded-xl p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-green-400 mb-1">Checklist Complete!</h3>
            <p className="text-green-300">All {totalCount} items have been verified.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default DataExport;
