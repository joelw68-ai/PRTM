import React, { useState } from 'react';
import { Gauge, Mail, Bug } from 'lucide-react';
import DebugPanel from './DebugPanel';

const Footer: React.FC = () => {
  const [debugOpen, setDebugOpen] = useState(false);

  return (
    <>
      <footer className="bg-slate-900 border-t border-slate-800 py-8 px-4 mt-12">
        <div className="max-w-[1920px] mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                  <Gauge className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Professional Racing Management</h3>
                  <p className="text-xs text-slate-400">Race Team Management</p>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                Professional digital logbook for Pro Mod drag racing teams. Track passes, maintenance, safety certifications, and more.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold text-white mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#dashboard" className="text-slate-400 hover:text-orange-400 transition-colors">Dashboard</a></li>
                <li><a href="#passlog" className="text-slate-400 hover:text-orange-400 transition-colors">Pass Log</a></li>
                <li><a href="#maintenance" className="text-slate-400 hover:text-orange-400 transition-colors">Maintenance</a></li>
                <li><a href="#safety" className="text-slate-400 hover:text-orange-400 transition-colors">Safety/SFI</a></li>
                <li><a href="#checklists" className="text-slate-400 hover:text-orange-400 transition-colors">Checklists</a></li>
              </ul>
            </div>

            {/* Specifications */}
            <div>
              <h4 className="font-semibold text-white mb-4">Car Specifications</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>Noonan 4.9L Hemi (4 engines)</li>
                <li>Procharger F-3X-140 Supercharger</li>
                <li>3500+ Horsepower</li>
                <li>Methanol Fuel</li>
                <li>1/8 Mile Competition</li>
                <li>Liberty 5-Speed Transmission</li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-semibold text-white mb-4">Support</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#help" className="flex items-center gap-2 text-slate-400 hover:text-orange-400 transition-colors">
                    <Mail className="w-4 h-4" />
                    Help & Documentation
                  </a>
                </li>
                <li className="text-slate-500 text-xs mt-4">
                  Version 1.0.6

                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} Professional Racing Management. Built for professional drag racing teams.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setDebugOpen(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
                  debugOpen
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-sm shadow-orange-500/10'
                    : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                <Bug className="w-3.5 h-3.5" />
                DB Debug Log
              </button>
              <p className="text-xs text-slate-600">
                Data synced to cloud database.
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Debug Panel - renders as fixed overlay at bottom */}
      <DebugPanel isOpen={debugOpen} onClose={() => setDebugOpen(false)} />
    </>
  );
};

export default Footer;
