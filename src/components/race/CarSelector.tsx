import React, { useState, useRef, useEffect } from 'react';
import { useCar } from '@/contexts/CarContext';
import { useThemeColor } from '@/contexts/ThemeColorContext';
import { Car, ChevronDown, Check, Layers } from 'lucide-react';

interface CarSelectorProps {
  compact?: boolean;
}

const CarSelector: React.FC<CarSelectorProps> = ({ compact = false }) => {
  const { cars, selectedCarId, setSelectedCarId, getCarLabel } = useCar();
  const { colors, getTeamColor } = useThemeColor();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (cars.length === 0) return null;

  const selectedLabel = getCarLabel(selectedCarId);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-lg transition-all border ${
          compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-1.5 text-xs'
        } ${!selectedCarId ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white' : ''}`}
        style={selectedCarId ? {
          backgroundColor: `rgba(${colors.rgb}, 0.15)`,
          borderColor: `rgba(${colors.rgb}, 0.3)`,
          color: colors.light,
        } : undefined}
      >
        {selectedCarId ? (
          <Car className="w-3.5 h-3.5 flex-shrink-0" />
        ) : (
          <Layers className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        <span className="max-w-[120px] truncate font-medium">{selectedLabel}</span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700/80 bg-slate-800/80">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Select Car View</p>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {/* All Cars */}
            <button
              onClick={() => { setSelectedCarId(null); setIsOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                !selectedCarId ? 'text-white' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
              style={!selectedCarId ? { backgroundColor: `rgba(${colors.rgb}, 0.1)`, color: colors.light } : undefined}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={!selectedCarId ? { backgroundColor: `rgba(${colors.rgb}, 0.2)` } : { backgroundColor: 'rgb(51 65 85)' }}
              >
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">All Cars</p>
                <p className="text-[11px] text-slate-500">Combined team view</p>
              </div>
              {!selectedCarId && <Check className="w-4 h-4 flex-shrink-0" style={{ color: colors.base }} />}
            </button>

            <div className="mx-3 my-1 border-t border-slate-700/50" />

            {/* Individual Cars */}
            {cars.map(car => {
              const isSelected = selectedCarId === car.id;
              const subtitle = [car.year, car.make, car.model].filter(Boolean).join(' ');
              const carColor = getTeamColor(car.id);

              return (
                <button
                  key={car.id}
                  onClick={() => { setSelectedCarId(car.id); setIsOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isSelected ? '' : car.isActive ? 'text-slate-300 hover:bg-slate-700/50 hover:text-white' : 'text-slate-500 hover:bg-slate-700/50'
                  }`}
                  style={isSelected ? { backgroundColor: `${carColor}1A`, color: carColor } : undefined}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border"
                    style={{ backgroundColor: `${carColor}33`, borderColor: `${carColor}66` }}
                  >
                    <Car className="w-4 h-4 drop-shadow" style={isSelected ? { color: carColor } : undefined} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {car.carNumber ? `#${car.carNumber}` : ''} {car.nickname || ''}
                      </p>
                      {!car.isActive && (
                        <span className="px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded text-[10px] flex-shrink-0">Inactive</span>
                      )}
                    </div>
                    {subtitle && <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>}
                    {car.class && <p className="text-[10px] text-slate-600">{car.class}</p>}
                  </div>
                  {isSelected && <Check className="w-4 h-4 flex-shrink-0" style={{ color: carColor }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CarSelector;
