import React, { useState } from 'react';
import { Gauge, Calculator, Link2 } from 'lucide-react';
import SpringsShocksTab from './SpringsShocksTab';
import FourLinkGeometryCalculator from './FourLinkGeometryCalculator';

type ChassisTab = 'springs_shocks' | '4link_calc';

interface ChassisSetupProps {
  currentRole?: string;
}

const ChassisSetup: React.FC<ChassisSetupProps> = ({ currentRole = 'Crew' }) => {
  const [activeTab, setActiveTab] = useState<ChassisTab>('springs_shocks');

  const tabs = [
    { id: 'springs_shocks' as ChassisTab, label: 'Springs & Shocks', icon: Gauge },
    { id: '4link_calc' as ChassisTab, label: '4-Link Geometry Calculator', icon: Calculator },
  ];

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            Chassis Setup
          </h2>
          <p className="text-slate-400 mt-1 ml-[52px]">Springs, shocks, ride height, corner weights, and 4-link geometry</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-semibold transition-all whitespace-nowrap text-sm ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 scale-[1.02]'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700/50'
              }`}
            >
              <tab.icon className="w-4.5 h-4.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'springs_shocks' && (
          <SpringsShocksTab />
        )}

        {activeTab === '4link_calc' && (
          <FourLinkGeometryCalculator />
        )}
      </div>
    </section>
  );
};

export default ChassisSetup;
