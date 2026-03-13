import React from 'react';
import { Play } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const BG_IMAGE = 'https://i.imgur.com/XgNCyJj.jpeg';


const LAPTOP_MOCKUP = 'https://d64gsuwffb70l.cloudfront.net/69a7e1e1149cf9fb162b9dae_1773390926454_9f32eac2.png';
const PHONE_MOCKUP = 'https://d64gsuwffb70l.cloudfront.net/69a7e1e1149cf9fb162b9dae_1773390957135_b554f3f0.jpg';

interface LoginScreenProps {
  onOpenAuth: (mode: 'login' | 'signup') => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onOpenAuth }) => {
  const { enableDemoMode } = useAuth();

  return (
    <div className="fixed inset-0 z-30 overflow-hidden">
      {/* ── Background layers ── */}
      <div className="absolute inset-0">
        {/* Base dark fill – ensures solid backdrop if image is slow to load */}
        <div className="absolute inset-0 bg-[#070b14]" />

        {/* User's car photo – high opacity so the car is dramatically visible */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-70"
          style={{ backgroundImage: `url(${BG_IMAGE})` }}
        />

        {/* Dark semi-transparent overlay – keeps text readable while car shows through */}
        <div className="absolute inset-0 bg-black/45" />

        {/* Directional gradient overlays – heavier on edges where text sits */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

        {/* Subtle warm accent glow to complement the car */}

        <div className="absolute bottom-0 left-0 w-[600px] h-[400px] bg-red-600/8 rounded-full blur-[120px]" />
        <div className="absolute -top-20 right-1/4 w-[500px] h-[300px] bg-red-700/5 rounded-full blur-[100px]" />

        {/* Cover patch – hides the Adobe Acrobat logo baked into the background image */}
        <div className="absolute bottom-0 right-0 w-[120px] h-[60px] bg-gradient-to-tl from-black via-black/95 to-transparent z-[1]" />
      </div>

      {/* ── Content ── */}


      <div className="relative z-10 flex flex-col min-h-screen">

        {/* ── Top Bar: Branding left, Buttons right ── */}
        <header className="flex items-start justify-between px-6 sm:px-10 lg:px-14 pt-8 sm:pt-10">
          {/* Left – PRTM Branding */}
          <div className="flex-shrink-0">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-white tracking-tight leading-none">
              PRTM
            </h1>
            <p className="text-sm sm:text-base lg:text-lg font-bold text-white/90 tracking-[0.15em] sm:tracking-[0.2em] mt-1 uppercase">
              Professional Race Team Management
            </p>
          </div>

          {/* Right – Auth Buttons */}
          <div className="flex items-center gap-3 flex-shrink-0 mt-2">
            <button
              onClick={() => onOpenAuth('login')}
              className="px-5 sm:px-7 py-2.5 rounded-md border border-white/40 text-white font-semibold text-sm sm:text-base tracking-wide hover:bg-white/10 hover:border-white/60 transition-all duration-200 uppercase"
            >
              Log In
            </button>
            <button
              onClick={() => onOpenAuth('signup')}
              className="px-5 sm:px-7 py-2.5 rounded-md bg-red-600 text-white font-semibold text-sm sm:text-base tracking-wide hover:bg-red-700 transition-all duration-200 shadow-lg shadow-red-600/30 hover:shadow-red-600/50 uppercase"
            >
              Sign Up
            </button>
          </div>
        </header>

        {/* ── Main Content Area ── */}
        <div className="flex-1 flex flex-col lg:flex-row items-end lg:items-end px-6 sm:px-10 lg:px-14 pb-6">

          {/* Left Column – Description pushed to lower-left */}
          <div className="flex-1 max-w-2xl lg:max-w-xl xl:max-w-2xl mb-8 lg:mb-12">
            {/* Subtle red accent line */}
            <div className="mb-5 w-16 h-1 bg-red-600 rounded-full" />

            <p className="text-white/90 text-base sm:text-lg lg:text-xl leading-relaxed font-normal">
              The only app built specifically for professional drag racing teams. No more notepads, spreadsheets, binders or folders scattered between the trailer, the shop, hotel rooms or your home. PRTM is fully customizable and puts your race cars, team members, parts, pass logs, performance analytics, crew checklists, finances, pass count driven maintenance schedules, and race day data all in one place — available instantly on any device, anywhere you are.
            </p>

            {/* Demo mode link */}
            <button
              onClick={() => enableDemoMode()}
              className="mt-6 inline-flex items-center gap-2 text-white/50 hover:text-red-400 transition-colors duration-200 text-sm font-medium group"
            >
              <Play className="w-3.5 h-3.5 group-hover:text-red-400 transition-colors" />
              Try Demo Mode
            </button>
          </div>

          {/* Right Column – Device Mockups */}
          <div className="flex-shrink-0 flex items-end justify-center lg:justify-end relative mb-4 lg:mb-0">
            {/* Laptop mockup */}
            <div className="relative w-[300px] sm:w-[380px] md:w-[460px] lg:w-[440px] xl:w-[520px] 2xl:w-[580px]">
              <img
                src={LAPTOP_MOCKUP}
                alt="PRTM Dashboard on laptop"
                className="w-full h-auto"
                style={{ filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.7))' }}
              />
            </div>

            {/* Phone mockup – overlapping the laptop on the right */}
            <div className="absolute -right-2 sm:right-2 lg:right-0 xl:right-4 bottom-0 w-[80px] sm:w-[100px] md:w-[120px] lg:w-[115px] xl:w-[135px] 2xl:w-[150px]">
              <img
                src={PHONE_MOCKUP}
                alt="PRTM App on smartphone"
                className="w-full h-auto"
                style={{ filter: 'drop-shadow(0 15px 35px rgba(0,0,0,0.8))' }}
              />
            </div>
          </div>
        </div>

        {/* ── Bottom subtle footer ── */}
        <div className="px-6 sm:px-10 lg:px-14 pb-4">
          <p className="text-white/20 text-xs tracking-wider">
            &copy; {new Date().getFullYear()} PRTM — Professional Race Team Management
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
