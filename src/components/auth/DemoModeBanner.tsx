import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Play, X, UserPlus, Zap } from 'lucide-react';

interface DemoModeBannerProps {
  onOpenAuth: (mode: 'login' | 'signup') => void;
}

const DemoModeBanner: React.FC<DemoModeBannerProps> = ({ onOpenAuth }) => {
  const { isDemoMode, disableDemoMode } = useAuth();

  if (!isDemoMode) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-amber-600/95 via-orange-600/95 to-red-600/95 backdrop-blur-sm border-t border-amber-500/50 shadow-lg shadow-orange-500/20">
      <div className="max-w-[1920px] mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Demo info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-white leading-tight">Demo Mode Active</p>
                <p className="text-xs text-white/70 leading-tight">Exploring with sample data</p>
              </div>
              <span className="sm:hidden text-sm font-bold text-white">Demo Mode</span>
            </div>
            
            {/* Pulse indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 rounded-full flex-shrink-0">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-white/90 font-medium hidden md:inline">Sample data loaded</span>
            </div>
          </div>

          {/* Center - Feature callouts */}
          <div className="hidden lg:flex items-center gap-3 text-xs text-white/80">
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              <span>Changes won't be saved</span>
            </div>
            <span className="text-white/30">|</span>
            <span>Create an account to save your data</span>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onOpenAuth('signup')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-orange-700 font-semibold text-xs rounded-lg hover:bg-white/90 transition-colors shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create Account</span>
              <span className="sm:hidden">Sign Up</span>
            </button>
            <button
              onClick={disableDemoMode}
              className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Exit Demo Mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoModeBanner;
