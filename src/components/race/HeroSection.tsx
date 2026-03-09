import React, { useState } from 'react';
import { 
  HelpCircle, 
  Book, 
  Video, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  Search,
  Gauge,
  ClipboardList,
  Wrench,
  Shield,
  Settings,
  RefreshCw,
  Printer,
  Download
} from 'lucide-react';

const HeroSection: React.FC = () => {
  const [expandedSection, setExpandedSection] = useState<string | null>('getting-started');
  const [searchTerm, setSearchTerm] = useState('');

  const helpSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: Book,
      content: [
        {
          title: 'Welcome to Professional Racing Management',
          text: 'This digital logbook is designed specifically for professional Pro Mod drag racing teams running 3500+ HP methanol-fueled Hemi engines on the 1/8 mile. Track every aspect of your racing operation from pass data to maintenance schedules.'
        },
        {
          title: 'Navigation',
          text: 'Use the navigation bar at the top to switch between sections: Dashboard (overview), Pass Log (run data), Main Components (engine/drivetrain management), Maintenance (service schedules), Safety (SFI certifications), Work Orders (task management), Checklists (pre/post run), and Help (this section).'

        },
        {
          title: 'First Steps',
          text: '1. Review your current engine configuration on the Dashboard\n2. Check for any SFI certification alerts\n3. Review maintenance items that are due\n4. Log your first pass with weather data'
        }
      ]
    },
    {
      id: 'pass-log',
      title: 'Pass Log Guide',
      icon: ClipboardList,
      content: [
        {
          title: 'Logging a Pass',
          text: 'Click "Log Pass" to record a new run. Enter the date, time, track name, and location. Click the cloud icon to automatically fetch current weather data and calculate SAE correction factor.'
        },
        {
          title: 'Weather & SAE Correction',
          text: 'The SAE J607 correction factor adjusts your horsepower reading based on atmospheric conditions. Standard conditions are 60°F, 29.92" Hg, and 0% humidity. The system calculates density altitude and corrected HP automatically.'
        },
        {
          title: 'Performance Data',
          text: 'Enter your timeslip data: Reaction Time, 60\' time, 330\' time, 1/8 mile ET, and MPH. Also record your car setup including launch RPM, boost setting, tire pressures, and wheelie bar position.'
        },
        {
          title: 'Exporting Data',
          text: 'Click "Export CSV" to download your pass log data for analysis in Excel or other spreadsheet software. The export includes all performance data, weather conditions, and setup information.'
        }
      ]
    },
    {
      id: 'engine-management',
      title: 'Main Components',

      icon: Settings,
      content: [
        {
          title: 'Engine Rotation',
          text: 'The system tracks 4 Noonan 4.9L Hemi engines. Each engine has its own pass count, rebuild history, and component tracking. Use the "Quick Swap" button on the Dashboard for one-click engine changes.'
        },
        {
          title: 'Engine Components',
          text: 'Track individual components: crankshaft, connecting rods, main/rod bearings, pistons, wrist pins, piston rings, cylinder sleeves, camshaft, cam bearings, and lifters. Each component has service, inspection, and replacement intervals.'
        },
        {
          title: 'Cylinder Heads',
          text: 'Manage 9 cylinder heads with full valve train tracking: intake/exhaust valves, valve seats, guides, springs, locators, shims, retainers, lash caps, rocker arms, and oiling jets.'
        },
        {
          title: 'Component Status',
          text: 'Status indicators: GREEN (Good) - within service interval, BLUE (Inspect) - inspection due, YELLOW (Service) - service required, RED (Replace) - replacement needed.'
        }
      ]
    },
    {
      id: 'maintenance',
      title: 'Maintenance Tracking',
      icon: Wrench,
      content: [
        {
          title: 'Pass-Count Based Scheduling',
          text: 'All maintenance is tracked by pass count, not mileage. Each component has a defined service interval (e.g., oil change every 10 passes, u-joints every 50 passes).'
        },
        {
          title: 'Maintenance Categories',
          text: 'Components are organized by category: Drivetrain (converter, trans, driveshaft), Wheels (tires, studs), Brakes, Fluids (oil, filters), Fuel System, Electronics, and Suspension.'
        },
        {
          title: 'Status Indicators',
          text: 'OVERDUE (red) - past service interval, DUE (orange) - at service interval, DUE SOON (yellow) - within 25% of interval, GOOD (green) - within normal range.'
        },
        {
          title: 'Creating Work Orders',
          text: 'Click the document icon next to any maintenance item to automatically create a work order with the component details pre-filled.'
        }
      ]
    },
    {
      id: 'safety-sfi',
      title: 'Safety & SFI Certifications',
      icon: Shield,
      content: [
        {
          title: 'SFI Tracking',
          text: 'Track all SFI-certified safety equipment: seat belts (SFI 16.1), fire system (SFI 17.1), window net (SFI 27.1), bell housing (SFI 6.1), fire suit (SFI 3.2A), gloves, helmet, shoes, and HANS device.'
        },
        {
          title: 'Expiration Alerts',
          text: 'The system provides early warnings: EXPIRED (red) - past expiration date, EXPIRING SOON (yellow) - within 60 days of expiration, VALID (green) - current certification.'
        },
        {
          title: 'Chassis & License',
          text: 'Also tracks chassis certification (SFI 25.5) and NHRA competition license renewal dates.'
        },
        {
          title: 'Critical Alerts',
          text: 'Expired certifications appear as critical alerts on the Dashboard. These must be addressed before the car can compete.'
        }
      ]
    },
    {
      id: 'work-orders',
      title: 'Work Orders',
      icon: FileText,
      content: [
        {
          title: 'Creating Work Orders',
          text: 'Click "New Work Order" to create a task. Assign a title, description, category, priority level, due date, and crew member.'
        },
        {
          title: 'Priority Levels',
          text: 'CRITICAL - Safety or race-critical items requiring immediate attention. HIGH - Important items to complete before next event. MEDIUM - Standard maintenance tasks. LOW - Items that can wait.'
        },
        {
          title: 'Status Workflow',
          text: 'Work orders progress through: Open → In Progress → Completed. Use "Pending Parts" status when waiting for parts to arrive.'
        },
        {
          title: 'Parts Tracking',
          text: 'Add parts to work orders with part numbers, quantities, and costs for inventory and expense tracking.'
        }
      ]
    },
    {
      id: 'checklists',
      title: 'Checklists',
      icon: ClipboardList,
      content: [
        {
          title: 'Pre-Run Checklist',
          text: '25 items to verify before every pass. Includes fluid levels, tire pressures, safety equipment, electronics, and mechanical checks. Critical items are highlighted in red.'
        },
        {
          title: 'Between Rounds Quick-Hit',
          text: '10 essential items to check between elimination rounds: oil level, fuel, parachute, tire pressures, lug nuts, fluid leaks, data review, tune adjustments, supercharger belt, and fire system.'
        },
        {
          title: 'Post-Run Teardown',
          text: '18 items for end-of-day teardown: drain methanol, fog engine, download data, inspect components, log pass counts, and secure equipment.'
        },
        {
          title: 'Printing Checklists',
          text: 'Click "Print" to generate a printable version of any checklist with checkboxes for manual completion at the track.'
        }
      ]
    },
    {
      id: 'engine-swap',
      title: 'Quick Engine Swap',
      icon: RefreshCw,
      content: [
        {
          title: 'One-Click Engine Swap',
          text: 'From the Dashboard, click "Quick Swap" to log an engine change. Select the new engine, enter the reason for the swap, and the crew member performing the work.'
        },
        {
          title: 'Automatic Updates',
          text: 'The swap automatically: marks the old engine as "Ready", marks the new engine as "Active" and "Installed", updates the install date, and creates a swap log entry.'
        },
        {
          title: 'Swap History',
          text: 'All engine swaps are logged with date, time, reason, and notes for complete traceability.'
        },
        {
          title: 'Future Pass Logging',
          text: 'After a swap, all new passes are automatically associated with the newly installed engine for accurate pass counting.'
        }
      ]
    }
  ];

  const filteredSections = helpSections.filter(section =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.content.some(c => 
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.text.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-orange-400" />
              Help & Documentation
            </h2>
            <p className="text-slate-400">Instructions, user guides, and tutorials for Professional Racing Management</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search help topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400"
          />
        </div>

        {/* Quick Reference Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl p-4 border border-orange-500/30">
            <Gauge className="w-8 h-8 text-orange-400 mb-2" />
            <h3 className="font-semibold text-white mb-1">Dashboard</h3>
            <p className="text-sm text-slate-300">Overview, alerts, quick engine swap</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-4 border border-blue-500/30">
            <ClipboardList className="w-8 h-8 text-blue-400 mb-2" />
            <h3 className="font-semibold text-white mb-1">Pass Log</h3>
            <p className="text-sm text-slate-300">Record runs with weather & SAE</p>
          </div>
          <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
            <Wrench className="w-8 h-8 text-green-400 mb-2" />
            <h3 className="font-semibold text-white mb-1">Maintenance</h3>
            <p className="text-sm text-slate-300">Pass-count based scheduling</p>
          </div>
          <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-xl p-4 border border-red-500/30">
            <Shield className="w-8 h-8 text-red-400 mb-2" />
            <h3 className="font-semibold text-white mb-1">Safety/SFI</h3>
            <p className="text-sm text-slate-300">Certification tracking & alerts</p>
          </div>
        </div>

        {/* Help Sections */}
        <div className="space-y-4">
          {filteredSections.map((section) => {
            const Icon = section.icon;
            const isExpanded = expandedSection === section.id;
            
            return (
              <div 
                key={section.id}
                className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-700/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-orange-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>
                
                {isExpanded && (
                  <div className="border-t border-slate-700/50 p-4 space-y-4">
                    {section.content.map((item, idx) => (
                      <div key={idx} className="bg-slate-900/50 rounded-lg p-4">
                        <h4 className="font-medium text-orange-400 mb-2">{item.title}</h4>
                        <p className="text-slate-300 text-sm whitespace-pre-line">{item.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pro Tips */}
        <div className="mt-8 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-xl border border-orange-500/30 p-6">
          <h3 className="text-lg font-semibold text-orange-400 mb-4">Pro Tips</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-orange-400 font-bold">1</span>
              </div>
              <p className="text-slate-300">Always fetch weather data before logging a pass for accurate SAE correction calculations.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-orange-400 font-bold">2</span>
              </div>
              <p className="text-slate-300">Check the Dashboard daily for SFI expiration alerts - expired certifications can prevent you from competing.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-orange-400 font-bold">3</span>
              </div>
              <p className="text-slate-300">Print checklists before each event and use the physical copies at the track for reliable verification.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-orange-400 font-bold">4</span>
              </div>
              <p className="text-slate-300">Create work orders immediately when issues are found - don't rely on memory between events.</p>
            </div>
          </div>
        </div>

        {/* Contact Support */}
        <div className="mt-6 text-center">
          <p className="text-slate-400 text-sm">
            Need additional help? Contact your software administrator or refer to the full documentation.
          </p>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
