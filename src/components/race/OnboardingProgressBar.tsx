import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  X, CheckCircle2, Circle, Users, Zap, Wind, ClipboardList,
  Rocket, ArrowRight, ChevronDown, ChevronUp, Bell
} from 'lucide-react';

const PROGRESS_BAR_DISMISSED_KEY = 'promod_progress_bar_dismissed';
const ALERT_ONBOARDING_COMPLETED_KEY = 'promod_alert_onboarding_completed';

interface OnboardingProgressBarProps {
  onNavigate: (section: string) => void;
}

interface ProgressStep {
  id: string;
  label: string;
  icon: React.ElementType;
  iconColor: string;
  section: string;
  completed: boolean;
}

const OnboardingProgressBar: React.FC<OnboardingProgressBarProps> = ({ onNavigate }) => {
  const { engines, superchargers, passLogs } = useApp();
  const { profile } = useAuth();
  
  const [isDismissed, setIsDismissed] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const isAlertOnboardingCompleted = (): boolean => {
    try {
      return localStorage.getItem(ALERT_ONBOARDING_COMPLETED_KEY) === 'true';
    } catch {
      return false;
    }
  };

  const steps: ProgressStep[] = [
    {
      id: 'profile',
      label: 'Team Profile',
      icon: Users,
      iconColor: 'text-violet-400',
      section: 'admin',
      completed: !!(profile?.teamName && profile?.driverName)
    },
    {
      id: 'engine',
      label: 'Add Engine',
      icon: Zap,
      iconColor: 'text-yellow-400',
      section: 'engines',
      completed: engines.length > 0
    },
    {
      id: 'supercharger',
      label: 'Add Supercharger',
      icon: Wind,
      iconColor: 'text-blue-400',
      section: 'engines',
      completed: superchargers.length > 0
    },
    {
      id: 'passlog',
      label: 'Log First Pass',
      icon: ClipboardList,
      iconColor: 'text-green-400',
      section: 'passlog',
      completed: passLogs.length > 0
    },
    {
      id: 'maintenance-alerts',
      label: 'Alert Thresholds',
      icon: Bell,
      iconColor: 'text-orange-400',
      section: 'admin',
      completed: isAlertOnboardingCompleted()
    }
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const allCompleted = completedCount === steps.length;
  const progressPercent = (completedCount / steps.length) * 100;

  // Check if dismissed
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(PROGRESS_BAR_DISMISSED_KEY);
      setIsDismissed(!!dismissed || allCompleted);
    } catch {
      setIsDismissed(false);
    }
  }, [allCompleted]);

  // Auto-dismiss when all completed
  useEffect(() => {
    if (allCompleted) {
      const timer = setTimeout(() => {
        setIsDismissed(true);
        try {
          localStorage.setItem(PROGRESS_BAR_DISMISSED_KEY, 'true');
        } catch {}
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [allCompleted]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(PROGRESS_BAR_DISMISSED_KEY, 'true');
    } catch {}
  };

  if (isDismissed) return null;

  const nextIncompleteStep = steps.find(s => !s.completed);

  return (
    <div className="mb-6 rounded-xl overflow-hidden border border-slate-700/50 bg-slate-800/50">
      {/* Main bar */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 bg-orange-500/20 rounded-lg flex-shrink-0">
              <Rocket className="w-4 h-4 text-orange-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-white">
                  {allCompleted ? 'Setup Complete!' : 'Getting Started'}
                </h4>
                <span className="text-xs text-slate-400">{completedCount}/{steps.length}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Step indicators - desktop */}
            <div className="hidden md:flex items-center gap-1.5">
              {steps.map(step => {
                const Icon = step.icon;
                return (
                  <button
                    key={step.id}
                    onClick={() => onNavigate(step.section)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      step.completed
                        ? 'bg-green-500/15 text-green-400'
                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                    title={step.label}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Icon className={`w-3.5 h-3.5 ${step.iconColor}`} />
                    )}
                    <span className="hidden lg:inline">{step.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Next step CTA */}
            {nextIncompleteStep && (
              <button
                onClick={() => onNavigate(nextIncompleteStep.section)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition-colors"
              >
                Next: {nextIncompleteStep.label}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Expand/Collapse on mobile */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="md:hidden p-1.5 text-slate-400 hover:text-white transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="p-1.5 text-slate-500 hover:text-white transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              allCompleted
                ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                : 'bg-gradient-to-r from-orange-500 to-red-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Mobile expanded view */}
      {isExpanded && (
        <div className="md:hidden px-4 pb-3 border-t border-slate-700/50 pt-3">
          <div className="space-y-2">
            {steps.map(step => {
              const Icon = step.icon;
              return (
                <button
                  key={step.id}
                  onClick={() => {
                    onNavigate(step.section);
                    setIsExpanded(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                    step.completed
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-slate-700/30 text-slate-300 hover:bg-slate-700/50'
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-500" />
                  )}
                  <span className="text-sm font-medium">{step.label}</span>
                  {!step.completed && (
                    <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingProgressBar;
