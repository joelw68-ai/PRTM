import React, { useState } from 'react';
import { Plus, Trash2, Package, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { PartInventoryItem } from '@/data/partsInventory';

export interface InvoiceLineItem {
  id: string;
  partNumber: string;
  description: string;
  category: string;
  quantity: number;
  unitCost: number;
  total: number;
  vendorPartNumber: string;
  notes: string;
  matchedInventoryId?: string; // If matched to existing inventory
}

interface InvoiceLineItemsEditorProps {
  lineItems: InvoiceLineItem[];
  onChange: (items: InvoiceLineItem[]) => void;
  partsInventory: PartInventoryItem[];
  vendorName: string;
}

const PART_CATEGORIES = [
  'Engine', 'Drivetrain', 'Supercharger', 'Cylinder Heads', 'Electronics',
  'Tires', 'Hardware', 'Safety', 'Ty-Drive', 'Quick Drive', 'Transmission',
  'Fuel System', 'Ignition', 'Exhaust', 'Suspension', 'Body', 'Services', 'Other'
];

const InvoiceLineItemsEditor: React.FC<InvoiceLineItemsEditorProps> = ({
  lineItems, onChange, partsInventory, vendorName
}) => {
  const [expanded, setExpanded] = useState(true);
  const [searchingItemIdx, setSearchingItemIdx] = useState<number | null>(null);
  const [partSearch, setPartSearch] = useState('');

  const addLineItem = () => {
    const newItem: InvoiceLineItem = {
      id: `LI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      partNumber: '',
      description: '',
      category: '',
      quantity: 1,
      unitCost: 0,
      total: 0,
      vendorPartNumber: '',
      notes: '',
    };
    onChange([...lineItems, newItem]);
  };

  const updateLineItem = <K extends keyof InvoiceLineItem>(index: number, field: K, value: InvoiceLineItem[K]) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    // Auto-calculate total
    if (field === 'quantity' || field === 'unitCost') {
      updated[index] = {
        ...updated[index],
        total: updated[index].quantity * updated[index].unitCost,
      };
    }
    onChange(updated);
  };


  const removeLineItem = (index: number) => {
    onChange(lineItems.filter((_, i) => i !== index));
  };

  const matchToInventory = (index: number, part: PartInventoryItem) => {
    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      partNumber: part.partNumber,
      description: part.description,
      category: part.category,
      unitCost: part.unitCost,
      vendorPartNumber: part.vendorPartNumber,
      matchedInventoryId: part.id,
      total: updated[index].quantity * part.unitCost,
    };
    onChange(updated);
    setSearchingItemIdx(null);
    setPartSearch('');
  };

  const filteredParts = partsInventory.filter(p =>
    p.partNumber.toLowerCase().includes(partSearch.toLowerCase()) ||
    p.description.toLowerCase().includes(partSearch.toLowerCase()) ||
    p.vendor.toLowerCase().includes(partSearch.toLowerCase())
  ).slice(0, 8);

  const lineItemsTotal = lineItems.reduce((sum, li) => sum + li.total, 0);

  return (
    <div className="border border-slate-600 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/50 hover:bg-slate-700/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-orange-400" />
          <span className="text-white font-medium text-sm">
            Line Items ({lineItems.length})
          </span>
          {lineItems.length > 0 && (
            <span className="text-green-400 text-sm font-semibold ml-2">
              ${lineItemsTotal.toFixed(2)}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-400">
            Add parts from this invoice. Matching items will auto-update inventory when saved.
          </p>

          {lineItems.map((item, idx) => (
            <div key={item.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Item #{idx + 1}</span>
                <div className="flex items-center gap-2">
                  {item.matchedInventoryId && (
                    <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">
                      Matched
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setSearchingItemIdx(searchingItemIdx === idx ? null : idx)}
                    className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 flex items-center gap-1"
                    title="Search existing inventory"
                  >
                    <Search className="w-3 h-3" />
                    Match
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLineItem(idx)}
                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inventory Search Dropdown */}
              {searchingItemIdx === idx && (
                <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 space-y-2">
                  <input
                    type="text"
                    value={partSearch}
                    onChange={(e) => setPartSearch(e.target.value)}
                    placeholder="Search by part #, description, or vendor..."
                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500"
                    autoFocus
                  />
                  {filteredParts.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {filteredParts.map(part => (
                        <button
                          key={part.id}
                          type="button"
                          onClick={() => matchToInventory(idx, part)}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="text-white text-xs font-medium block truncate">{part.partNumber}</span>
                            <span className="text-slate-400 text-xs block truncate">{part.description}</span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-green-400 text-xs">${part.unitCost.toFixed(2)}</span>
                            <span className="text-slate-500 text-xs block">{part.onHand} on hand</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-2">
                      {partSearch ? 'No matching parts found — will create new inventory entry' : 'Type to search existing parts'}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => { setSearchingItemIdx(null); setPartSearch(''); }}
                    className="w-full text-xs text-slate-400 hover:text-white py-1"
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Fields */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-3">
                  <input
                    type="text"
                    value={item.partNumber}
                    onChange={(e) => updateLineItem(idx, 'partNumber', e.target.value)}
                    placeholder="Part #"
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500"
                  />
                </div>
                <div className="col-span-5">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                    placeholder="Description"
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500"
                  />
                </div>
                <div className="col-span-4">
                  <select
                    value={item.category}
                    onChange={(e) => updateLineItem(idx, 'category', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                  >
                    <option value="">Category</option>
                    {PART_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-500 block mb-0.5">Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] text-slate-500 block mb-0.5">Unit Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unitCost || ''}
                    onChange={(e) => updateLineItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] text-slate-500 block mb-0.5">Line Total</label>
                  <div className="w-full bg-slate-800/50 border border-slate-600 rounded px-2 py-1.5 text-sm text-green-400 font-medium">
                    ${item.total.toFixed(2)}
                  </div>
                </div>
                <div className="col-span-4">
                  <label className="text-[10px] text-slate-500 block mb-0.5">Vendor Part #</label>
                  <input
                    type="text"
                    value={item.vendorPartNumber}
                    onChange={(e) => updateLineItem(idx, 'vendorPartNumber', e.target.value)}
                    placeholder="Vendor PN"
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white placeholder-slate-500"
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addLineItem}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 hover:text-white hover:border-orange-500/50 hover:bg-orange-500/5 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Line Item
          </button>

          {lineItems.length > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
              <span className="text-xs text-slate-400">{lineItems.length} item{lineItems.length !== 1 ? 's' : ''}</span>
              <span className="text-sm font-bold text-green-400">
                Subtotal: ${lineItemsTotal.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InvoiceLineItemsEditor;
