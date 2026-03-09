import React from 'react';
import { 
  Zap, Wind, ClipboardList, Package, Wrench, FileText, CheckSquare, 
  Calendar, Camera, Users, Settings2, Shield, ListTodo, DollarSign,
  Database, BarChart3, History, Plus
} from 'lucide-react';

interface EmptyStateProps {
  section: string;
  onAction?: () => void;
  compact?: boolean;
}

interface EmptyStateConfig {
  icon: React.ElementType;
  iconColor: string;
  bgGradient: string;
  title: string;
  description: string;
  actionLabel: string;
  tips?: string[];
}

const emptyStateConfigs: Record<string, EmptyStateConfig> = {
  engines: {
    icon: Zap,
    iconColor: 'text-yellow-400',
    bgGradient: 'from-yellow-500/10 to-orange-500/10',
    title: 'No engines added yet',
    description: 'Add your first engine to start tracking passes, rebuilds, and component status.',
    actionLabel: 'Add Your First Engine',
    tips: ['Track total passes and passes since rebuild', 'Monitor component status (pistons, rods, bearings)', 'Log engine swaps between events']
  },
  superchargers: {
    icon: Wind,
    iconColor: 'text-blue-400',
    bgGradient: 'from-blue-500/10 to-cyan-500/10',
    title: 'No superchargers added yet',
    description: 'Add your supercharger to track service intervals and performance data.',
    actionLabel: 'Add Your First Supercharger',
    tips: ['Track passes since last service', 'Monitor rotor clearances and belt tension', 'Set service interval reminders']
  },
  passlog: {
    icon: ClipboardList,
    iconColor: 'text-green-400',
    bgGradient: 'from-green-500/10 to-emerald-500/10',
    title: 'No passes logged yet',
    description: 'Log your first pass to start building your performance history and analytics.',
    actionLabel: 'Log Your First Pass',
    tips: ['Record 60\', 330\', 1/8 mile ET and MPH', 'Track weather conditions for each run', 'Compare passes side-by-side']
  },
  parts: {
    icon: Package,
    iconColor: 'text-purple-400',
    bgGradient: 'from-purple-500/10 to-pink-500/10',
    title: 'No parts in inventory',
    description: 'Add parts to track stock levels, costs, and get low-stock alerts.',
    actionLabel: 'Add Your First Part',
    tips: ['Set minimum quantities for automatic alerts', 'Track costs and vendor information', 'Generate reorder lists automatically']
  },
  maintenance: {
    icon: Wrench,
    iconColor: 'text-orange-400',
    bgGradient: 'from-orange-500/10 to-red-500/10',
    title: 'No maintenance items tracked',
    description: 'Set up your maintenance schedule to never miss a service interval.',
    actionLabel: 'Add Maintenance Item',
    tips: ['Set pass-based service intervals', 'Get alerts when service is due', 'Track maintenance history']
  },
  workorders: {
    icon: FileText,
    iconColor: 'text-cyan-400',
    bgGradient: 'from-cyan-500/10 to-blue-500/10',
    title: 'No work orders created',
    description: 'Create work orders to track repairs, upgrades, and tasks for your team.',
    actionLabel: 'Create First Work Order',
    tips: ['Assign tasks to team members', 'Set priority levels (Critical, High, Normal)', 'Track completion status']
  },
  checklists: {
    icon: CheckSquare,
    iconColor: 'text-teal-400',
    bgGradient: 'from-teal-500/10 to-green-500/10',
    title: 'No checklist items yet',
    description: 'Build your pre-run, between-rounds, and post-run checklists.',
    actionLabel: 'Add Checklist Item',
    tips: ['Create separate checklists for each phase', 'Track who checked each item', 'Reset checklists between rounds']
  },
  calendar: {
    icon: Calendar,
    iconColor: 'text-indigo-400',
    bgGradient: 'from-indigo-500/10 to-violet-500/10',
    title: 'No events scheduled',
    description: 'Add race events, test sessions, and maintenance days to your calendar.',
    actionLabel: 'Add First Event',
    tips: ['Schedule races and test sessions', 'Set reminders for upcoming events', 'Track event results']
  },
  gallery: {
    icon: Camera,
    iconColor: 'text-pink-400',
    bgGradient: 'from-pink-500/10 to-rose-500/10',
    title: 'No media uploaded',
    description: 'Upload photos and videos from races, test sessions, and shop work.',
    actionLabel: 'Upload First Photo',
    tips: ['Organize by event or date', 'Tag photos with pass numbers', 'Share with sponsors and fans']
  },
  team: {
    icon: Users,
    iconColor: 'text-violet-400',
    bgGradient: 'from-violet-500/10 to-purple-500/10',
    title: 'No team members added',
    description: 'Add your crew members and assign roles to manage access.',
    actionLabel: 'Add Team Member',
    tips: ['Assign roles (Owner, Crew Chief, Mechanic, etc.)', 'Control who can view and edit data', 'Track who performed each action']
  },
  heads: {
    icon: Settings2,
    iconColor: 'text-amber-400',
    bgGradient: 'from-amber-500/10 to-yellow-500/10',
    title: 'No cylinder heads tracked',
    description: 'Add cylinder heads to monitor passes, flow numbers, and service history.',
    actionLabel: 'Add Cylinder Head',
    tips: ['Track left and right heads separately', 'Monitor flow numbers and valve specs', 'Log service and rebuild history']
  },
  sfi: {
    icon: Shield,
    iconColor: 'text-red-400',
    bgGradient: 'from-red-500/10 to-orange-500/10',
    title: 'No SFI certifications tracked',
    description: 'Track your safety equipment certifications and get expiration alerts.',
    actionLabel: 'Add SFI Certification',
    tips: ['Get alerts before certifications expire', 'Track SFI spec numbers', 'Never miss a tech inspection']
  },
  todo: {
    icon: ListTodo,
    iconColor: 'text-lime-400',
    bgGradient: 'from-lime-500/10 to-green-500/10',
    title: 'No to-do items',
    description: 'Create tasks and to-do items for your race team.',
    actionLabel: 'Add First Task',
    tips: ['Assign tasks to crew members', 'Set due dates and priorities', 'Track completion progress']
  },
  vendors: {
    icon: Database,
    iconColor: 'text-slate-400',
    bgGradient: 'from-slate-500/10 to-gray-500/10',
    title: 'No vendors added',
    description: 'Add your parts vendors and suppliers to track orders and pricing.',
    actionLabel: 'Add First Vendor',
    tips: ['Track vendor contact information', 'Compare pricing across vendors', 'Monitor order history']
  },
  costs: {
    icon: DollarSign,
    iconColor: 'text-emerald-400',
    bgGradient: 'from-emerald-500/10 to-green-500/10',
    title: 'No cost data available',
    description: 'Cost analytics will populate as you add parts, work orders, and invoices.',
    actionLabel: 'Go to Parts Inventory',
    tips: ['Track spending by category', 'Monitor cost per pass', 'Generate expense reports']
  },
  analytics: {
    icon: BarChart3,
    iconColor: 'text-sky-400',
    bgGradient: 'from-sky-500/10 to-blue-500/10',
    title: 'No data for analytics',
    description: 'Analytics will populate once you start logging passes and tracking data.',
    actionLabel: 'Log Your First Pass',
    tips: ['View ET and MPH trends over time', 'Compare performance across conditions', 'Identify setup patterns']
  },
  partsusage: {
    icon: History,
    iconColor: 'text-rose-400',
    bgGradient: 'from-rose-500/10 to-pink-500/10',
    title: 'No parts usage history',
    description: 'Usage history will build as you consume parts from inventory.',
    actionLabel: 'Go to Parts Inventory',
    tips: ['Track which parts are used most', 'Monitor consumption rates', 'Plan reorders based on usage']
  }
};

const EmptyState: React.FC<EmptyStateProps> = ({ section, onAction, compact = false }) => {
  const config = emptyStateConfigs[section];
  
  if (!config) return null;
  
  const Icon = config.icon;
  
  if (compact) {
    return (
      <div className={`text-center py-8 px-4 rounded-xl bg-gradient-to-br ${config.bgGradient} border border-slate-700/30`}>
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800/80 mb-3`}>
          <Icon className={`w-6 h-6 ${config.iconColor}`} />
        </div>
        <h4 className="text-white font-medium mb-1">{config.title}</h4>
        <p className="text-slate-400 text-sm mb-3 max-w-sm mx-auto">{config.description}</p>
        {onAction && (
          <button
            onClick={onAction}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {config.actionLabel}
          </button>
        )}
      </div>
    );
  }
  
  return (
    <div className={`text-center py-16 px-6 rounded-2xl bg-gradient-to-br ${config.bgGradient} border border-slate-700/30`}>
      {/* Decorative background circles */}
      <div className="relative inline-block mb-6">
        <div className={`absolute inset-0 w-20 h-20 rounded-full ${config.bgGradient} blur-xl opacity-50`} />
        <div className="relative w-20 h-20 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mx-auto">
          <Icon className={`w-10 h-10 ${config.iconColor}`} />
        </div>
      </div>
      
      <h3 className="text-xl font-bold text-white mb-2">{config.title}</h3>
      <p className="text-slate-400 mb-6 max-w-md mx-auto">{config.description}</p>
      
      {/* Tips */}
      {config.tips && config.tips.length > 0 && (
        <div className="max-w-sm mx-auto mb-6">
          <div className="space-y-2">
            {config.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-left">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-2 flex-shrink-0" />
                <span className="text-sm text-slate-400">{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 transition-all shadow-lg shadow-orange-500/25"
        >
          <Plus className="w-5 h-5" />
          {config.actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
