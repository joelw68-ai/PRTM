import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  X, ChevronRight, ChevronLeft, Users, Zap, Wind, ClipboardList,
  CheckCircle2, Circle, Rocket, ArrowRight, Sparkles, Bell, 
  Shield, AlertTriangle, Info, Plus, Trash2, ToggleLeft, ToggleRight,
  Settings2
} from 'lucide-react';
import {
  loadAlertSettings,
  saveAlertSettings,
  getDefaultSettings,
  AlertThreshold,
  MaintenanceAlertSettings
} from '@/lib/maintenanceAlerts';

const ONBOARDING_STORAGE_KEY = 'promod_onboarding_dismissed';
const ONBOARDING_COMPLETED_KEY = 'promod_onboarding_completed_steps';
const ALERT_ONBOARDING_COMPLETED_KEY = 'promod_alert_onboarding_completed';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  section: string;
  checkCompleted: () => boolean;
  details: string[];
  isInteractive?: boolean;
}

interface OnboardingWizardProps {
  onNavigate: (section: string) => void;
}

// Severity config for display
const severityConfig: Record<string, { color: string; bgColor: string; borderColor: string; icon: React.ElementType }> = {
  info: { color: 'text-blue-400', bgColor: 'bg-blue-500/15', borderColor: 'border-blue-500/30', icon: Info },
  warning: { color: 'text-amber-400', bgColor: 'bg-amber-500/15', borderColor: 'border-amber-500/30', icon: AlertTriangle },
  critical: { color: 'text-red-400', bgColor: 'bg-red-500/15', borderColor: 'border-red-500/30', icon: Shield },
};

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onNavigate }) => {
  const { engines, superchargers, passLogs, teamMembers } = useApp();
  const { profile } = useAuth();
  
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Maintenance alert threshold state
  const [alertSettings, setAlertSettings] = useState<MaintenanceAlertSettings>(() => {
    const existing = loadAlertSettings();
    return existing;
  });
  const [alertSettingsSaved, setAlertSettingsSaved] = useState(false);

  // Check if alert onboarding was already completed
  const isAlertOnboardingCompleted = useCallback(() => {
    try {
      return localStorage.getItem(ALERT_ONBOARDING_COMPLETED_KEY) === 'true';
    } catch {
      return false;
    }
  }, []);

  const steps: OnboardingStep[] = [
    {
      id: 'profile',
      title: 'Set Up Your Team Profile',
      description: 'Add your team name, driver name, car number, and class to personalize the app.',
      icon: Users,
      iconColor: 'text-violet-400',
      bgColor: 'from-violet-500/20 to-purple-500/20',
      section: 'admin',
      checkCompleted: () => !!(profile?.teamName && profile?.driverName),
      details: [
        'Enter your team and driver name',
        'Set your car number and class',
        'Choose your engine type and fuel',
        'Add your home track'
      ]
    },
    {
      id: 'engine',
      title: 'Add Your First Engine',
      description: 'Register an engine to track passes, rebuilds, and component status.',
      icon: Zap,
      iconColor: 'text-yellow-400',
      bgColor: 'from-yellow-500/20 to-orange-500/20',
      section: 'engines',
      checkCompleted: () => engines.length > 0,
      details: [
        'Enter engine name and serial number',
        'Set builder and install date',
        'Track component status (pistons, rods, etc.)',
        'Monitor passes since last rebuild'
      ]
    },
    {
      id: 'supercharger',
      title: 'Add Your First Supercharger',
      description: 'Track your blower\'s service intervals, rotor clearances, and performance.',
      icon: Wind,
      iconColor: 'text-blue-400',
      bgColor: 'from-blue-500/20 to-cyan-500/20',
      section: 'engines',
      checkCompleted: () => superchargers.length > 0,
      details: [
        'Enter model and serial number',
        'Set service interval (typically 100 passes)',
        'Track rotor clearances and belt tension',
        'Monitor passes since last service'
      ]
    },
    {
      id: 'passlog',
      title: 'Log Your First Pass',
      description: 'Record your first run to start building performance history and analytics.',
      icon: ClipboardList,
      iconColor: 'text-green-400',
      bgColor: 'from-green-500/20 to-emerald-500/20',
      section: 'passlog',
      checkCompleted: () => passLogs.length > 0,
      details: [
        'Enter 60\', 330\', 1/8 mile ET and MPH',
        'Record weather and track conditions',
        'Note setup changes and observations',
        'Compare against previous passes'
      ]
    },
    {
      id: 'maintenance-alerts',
      title: 'Configure Maintenance Alerts',
      description: 'Set up automatic notifications when drivetrain and engine components approach their service intervals.',
      icon: Bell,
      iconColor: 'text-orange-400',
      bgColor: 'from-orange-500/20 to-red-500/20',
      section: 'admin',
      checkCompleted: isAlertOnboardingCompleted,
      isInteractive: true,
      details: [
        'Get notified as components approach service intervals',
        'Customize alert thresholds (80%, 90%, 100%)',
        'Choose notification types (toast & bell alerts)',
        'Never miss a critical maintenance deadline'
      ]
    }
  ];

  const completedSteps = steps.filter(s => s.checkCompleted()).length;
  const allCompleted = completedSteps === steps.length;

  // Check if wizard should be shown
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!dismissed && !allCompleted) {
        const timer = setTimeout(() => setIsVisible(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage not available
    }
  }, [allCompleted]);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {}
  };

  const handleDoItNow = (section: string) => {
    setIsVisible(false);
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {}
    onNavigate(section);
  };

  const handleSkip = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // ============ MAINTENANCE ALERT THRESHOLD HANDLERS ============

  const handleToggleAlertEnabled = () => {
    setAlertSettings(prev => ({ ...prev, enabled: !prev.enabled }));
    setAlertSettingsSaved(false);
  };

  const handleToggleToast = () => {
    setAlertSettings(prev => ({ ...prev, showToastNotifications: !prev.showToastNotifications }));
    setAlertSettingsSaved(false);
  };

  const handleToggleBell = () => {
    setAlertSettings(prev => ({ ...prev, showBellAlerts: !prev.showBellAlerts }));
    setAlertSettingsSaved(false);
  };

  const handleToggleThreshold = (index: number) => {
    setAlertSettings(prev => ({
      ...prev,
      thresholds: prev.thresholds.map((t, i) => 
        i === index ? { ...t, enabled: !t.enabled } : t
      )
    }));
    setAlertSettingsSaved(false);
  };

  const handleThresholdPercentChange = (index: number, value: number) => {
    const clamped = Math.max(10, Math.min(200, value));
    setAlertSettings(prev => ({
      ...prev,
      thresholds: prev.thresholds.map((t, i) => 
        i === index ? { ...t, percentage: clamped } : t
      )
    }));
    setAlertSettingsSaved(false);
  };

  const handleThresholdLabelChange = (index: number, label: string) => {
    setAlertSettings(prev => ({
      ...prev,
      thresholds: prev.thresholds.map((t, i) => 
        i === index ? { ...t, label } : t
      )
    }));
    setAlertSettingsSaved(false);
  };

  const handleThresholdSeverityChange = (index: number, severity: 'info' | 'warning' | 'critical') => {
    setAlertSettings(prev => ({
      ...prev,
      thresholds: prev.thresholds.map((t, i) => 
        i === index ? { ...t, severity } : t
      )
    }));
    setAlertSettingsSaved(false);
  };

  const handleAddThreshold = () => {
    const newThreshold: AlertThreshold = {
      percentage: 75,
      label: 'Custom Alert',
      severity: 'info',
      enabled: true,
    };
    setAlertSettings(prev => ({
      ...prev,
      thresholds: [...prev.thresholds, newThreshold].sort((a, b) => a.percentage - b.percentage)
    }));
    setAlertSettingsSaved(false);
  };

  const handleRemoveThreshold = (index: number) => {
    if (alertSettings.thresholds.length <= 1) return;
    setAlertSettings(prev => ({
      ...prev,
      thresholds: prev.thresholds.filter((_, i) => i !== index)
    }));
    setAlertSettingsSaved(false);
  };

  const handleResetDefaults = () => {
    setAlertSettings(getDefaultSettings());
    setAlertSettingsSaved(false);
  };

  const handleSaveAlertSettings = () => {
    saveAlertSettings(alertSettings);
    setAlertSettingsSaved(true);
    try {
      localStorage.setItem(ALERT_ONBOARDING_COMPLETED_KEY, 'true');
    } catch {}
  };

  const handleSaveAndContinue = () => {
    handleSaveAlertSettings();
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDismiss();
    }
  };

  if (!isVisible) return null;

  const step = steps[currentStep];
  const StepIcon = step.icon;
  const isStepCompleted = step.checkCompleted();
  const isAlertStep = step.id === 'maintenance-alerts';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl w-full overflow-hidden ${isAlertStep ? 'max-w-2xl' : 'max-w-xl'}`}>
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-r from-orange-500/20 via-red-500/20 to-purple-500/20 px-6 py-5 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-xl">
                <Rocket className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Quick Start Guide</h2>
                <p className="text-sm text-slate-400">Get your race team set up in {steps.length} easy steps</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-2 mt-4">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex-1 h-1.5 rounded-full transition-all ${
                    s.checkCompleted()
                      ? 'bg-green-500'
                      : i === currentStep
                      ? 'bg-orange-500'
                      : i < currentStep
                      ? 'bg-orange-500/50'
                      : 'bg-slate-700'
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-400">Step {currentStep + 1} of {steps.length}</span>
            <span className="text-xs text-slate-400">{completedSteps}/{steps.length} completed</span>
          </div>
        </div>

        {/* Step Content */}
        <div className={`p-6 ${isAlertStep ? 'max-h-[65vh] overflow-y-auto' : ''}`}>
          <div className={`rounded-xl bg-gradient-to-br ${step.bgColor} border border-slate-700/30 p-6 mb-6`}>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-slate-800/80 rounded-xl flex-shrink-0">
                <StepIcon className={`w-8 h-8 ${step.iconColor}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-white">{step.title}</h3>
                  {isStepCompleted && (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  )}
                </div>
                <p className="text-slate-300 text-sm">{step.description}</p>
              </div>
            </div>
          </div>

          {/* Standard Step Details */}
          {!isAlertStep && (
            <>
              <div className="space-y-2 mb-6">
                <h4 className="text-sm font-medium text-slate-400">What you'll do:</h4>
                {step.details.map((detail, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <Circle className="w-4 h-4 text-slate-600" />
                    </div>
                    <span className="text-sm text-slate-300">{detail}</span>
                  </div>
                ))}
              </div>

              {isStepCompleted && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg mb-6">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-green-300 font-medium">This step is already completed!</span>
                </div>
              )}
            </>
          )}

          {/* ============ INTERACTIVE MAINTENANCE ALERT STEP ============ */}
          {isAlertStep && (
            <div className="space-y-5">
              {/* Master Enable Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-900/60 rounded-xl border border-slate-700/40">
                <div className="flex items-center gap-3">
                  <Settings2 className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Maintenance Alerts</p>
                    <p className="text-xs text-slate-400">Automatic notifications when components approach service</p>
                  </div>
                </div>
                <button
                  onClick={handleToggleAlertEnabled}
                  className="flex-shrink-0"
                  title={alertSettings.enabled ? 'Disable alerts' : 'Enable alerts'}
                >
                  {alertSettings.enabled ? (
                    <ToggleRight className="w-10 h-10 text-green-400" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-500" />
                  )}
                </button>
              </div>

              {alertSettings.enabled && (
                <>
                  {/* Notification Channels */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleToggleToast}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        alertSettings.showToastNotifications
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                          : 'bg-slate-900/40 border-slate-700/40 text-slate-500'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${alertSettings.showToastNotifications ? 'bg-blue-500/20' : 'bg-slate-700/50'}`}>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold">Toast Alerts</p>
                        <p className="text-[10px] opacity-70">Pop-up on new pass</p>
                      </div>
                    </button>
                    <button
                      onClick={handleToggleBell}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        alertSettings.showBellAlerts
                          ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                          : 'bg-slate-900/40 border-slate-700/40 text-slate-500'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${alertSettings.showBellAlerts ? 'bg-purple-500/20' : 'bg-slate-700/50'}`}>
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-semibold">Bell Alerts</p>
                        <p className="text-[10px] opacity-70">Show in nav bell</p>
                      </div>
                    </button>
                  </div>

                  {/* Threshold Cards */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Shield className="w-4 h-4 text-orange-400" />
                        Alert Thresholds
                      </h4>
                      <button
                        onClick={handleAddThreshold}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    </div>

                    <div className="space-y-3">
                      {alertSettings.thresholds
                        .sort((a, b) => a.percentage - b.percentage)
                        .map((threshold, index) => {
                          const config = severityConfig[threshold.severity];
                          const SeverityIcon = config.icon;
                          return (
                            <div
                              key={index}
                              className={`relative p-4 rounded-xl border transition-all ${
                                threshold.enabled
                                  ? `${config.bgColor} ${config.borderColor}`
                                  : 'bg-slate-900/30 border-slate-700/30 opacity-60'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Severity Icon */}
                                <div className={`p-2 rounded-lg ${threshold.enabled ? config.bgColor : 'bg-slate-700/30'} flex-shrink-0 mt-0.5`}>
                                  <SeverityIcon className={`w-4 h-4 ${threshold.enabled ? config.color : 'text-slate-500'}`} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 space-y-3">
                                  {/* Top row: label + percentage */}
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <input
                                      type="text"
                                      value={threshold.label}
                                      onChange={(e) => handleThresholdLabelChange(index, e.target.value)}
                                      className="flex-1 min-w-[120px] bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                                      placeholder="Alert label..."
                                    />
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs text-slate-400">at</span>
                                      <input
                                        type="number"
                                        value={threshold.percentage}
                                        onChange={(e) => handleThresholdPercentChange(index, parseInt(e.target.value) || 0)}
                                        className="w-16 bg-slate-800/60 border border-slate-600/50 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                                        min={10}
                                        max={200}
                                      />
                                      <span className="text-xs text-slate-400">%</span>
                                    </div>
                                  </div>

                                  {/* Progress bar visualization */}
                                  <div className="relative">
                                    <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          threshold.severity === 'critical' ? 'bg-red-500' :
                                          threshold.severity === 'warning' ? 'bg-amber-500' :
                                          'bg-blue-500'
                                        }`}
                                        style={{ width: `${Math.min(100, threshold.percentage)}%` }}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                      <span className="text-[10px] text-slate-500">0 passes</span>
                                      <span className={`text-[10px] font-medium ${config.color}`}>
                                        {threshold.percentage}% of interval
                                      </span>
                                      <span className="text-[10px] text-slate-500">Service due</span>
                                    </div>
                                  </div>

                                  {/* Severity selector */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">Severity:</span>
                                    {(['info', 'warning', 'critical'] as const).map((sev) => {
                                      const sevCfg = severityConfig[sev];
                                      return (
                                        <button
                                          key={sev}
                                          onClick={() => handleThresholdSeverityChange(index, sev)}
                                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-all border ${
                                            threshold.severity === sev
                                              ? `${sevCfg.bgColor} ${sevCfg.borderColor} ${sevCfg.color}`
                                              : 'bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-slate-300'
                                          }`}
                                        >
                                          {sev}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Right actions */}
                                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => handleToggleThreshold(index)}
                                    title={threshold.enabled ? 'Disable' : 'Enable'}
                                  >
                                    {threshold.enabled ? (
                                      <ToggleRight className="w-7 h-7 text-green-400" />
                                    ) : (
                                      <ToggleLeft className="w-7 h-7 text-slate-500" />
                                    )}
                                  </button>
                                  {alertSettings.thresholds.length > 1 && (
                                    <button
                                      onClick={() => handleRemoveThreshold(index)}
                                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                      title="Remove threshold"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* How it works explanation */}
                  <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/30">
                    <h5 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-400" />
                      How It Works
                    </h5>
                    <ul className="space-y-1.5">
                      <li className="text-[11px] text-slate-400 flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5">1.</span>
                        Each component has a service interval (e.g., rebuild every 100 passes)
                      </li>
                      <li className="text-[11px] text-slate-400 flex items-start gap-2">
                        <span className="text-amber-400 mt-0.5">2.</span>
                        When you log a pass, the system checks all components against your thresholds
                      </li>
                      <li className="text-[11px] text-slate-400 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">3.</span>
                        If a component crosses a threshold, you get an instant notification
                      </li>
                    </ul>
                  </div>

                  {/* Reset to defaults */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleResetDefaults}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline"
                    >
                      Reset to defaults
                    </button>
                    {alertSettingsSaved && (
                      <div className="flex items-center gap-1.5 text-xs text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Settings saved
                      </div>
                    )}
                  </div>
                </>
              )}

              {!alertSettings.enabled && (
                <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-700/30 text-center">
                  <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Alerts are disabled. Enable them above to configure thresholds.</p>
                  <p className="text-xs text-slate-500 mt-1">You can always enable them later in Admin Settings.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              {currentStep < steps.length - 1 ? 'Skip' : 'Close'}
            </button>
            
            {isAlertStep ? (
              <button
                onClick={handleSaveAndContinue}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 transition-all text-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                {currentStep < steps.length - 1 ? 'Save & Continue' : 'Save & Finish'}
              </button>
            ) : (
              <button
                onClick={() => handleDoItNow(step.section)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 transition-all text-sm"
              >
                {isStepCompleted ? (
                  <>
                    View Section
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Do It Now
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
