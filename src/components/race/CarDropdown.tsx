import React from 'react';
import { useCar } from '@/contexts/CarContext';
import { Car } from 'lucide-react';

interface CarDropdownProps {
  value: string;
  onChange: (carId: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
  showAllOption?: boolean;
  compact?: boolean;
}

const CarDropdown: React.FC<CarDropdownProps> = ({
  value,
  onChange,
  label = 'Car',
  required = false,
  className = '',
  showAllOption = false,
  compact = false,
}) => {
  const { cars, activeCars } = useCar();
  
  // Only show dropdown if there are cars
  if (cars.length === 0) return null;

  const carsToShow = activeCars.length > 0 ? activeCars : cars;

  return (
    <div className={className}>
      {!compact && (
        <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1.5">
          <Car className="w-3 h-3" />
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
      >
        {showAllOption && <option value="">All Cars</option>}
        {!showAllOption && !required && <option value="">-- No car assigned --</option>}
        {carsToShow.map((car) => {
          const parts = [
            car.carNumber ? `#${car.carNumber}` : '',
            car.nickname || '',
            car.year || '',
            car.make,
            car.model,
          ].filter(Boolean);
          const label = parts.join(' ') || 'Unnamed Car';
          return (
            <option key={car.id} value={car.id}>
              {label}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export default CarDropdown;
