import React, { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useCar } from '@/contexts/CarContext';
import { BarChart3, Zap, Gauge, Wrench, Shield, DollarSign, TrendingUp } from 'lucide-react';

const CarStatsDashboard: React.FC = () => {
  const { passLogs, maintenanceItems, sfiCertifications, workOrders, partsInventory } = useApp();
  const { cars } = useCar();

  const activeCars = useMemo(() => cars.filter(c => c.status === 'Active'), [cars]);

  const carStats = useMemo(() => {
    return activeCars.map(car => {
      const carPasses = passLogs.filter((p) => p.car_id === car.id);
      const validPasses = carPasses.filter(p => p.eighth > 0 && !p.aborted);
      const bestET = validPasses.length > 0 ? Math.min(...validPasses.map(p => p.eighth)) : null;
      const bestMPH = validPasses.length > 0 ? Math.max(...validPasses.map(p => p.mph)) : null;
      const avgET = validPasses.length > 0 ? validPasses.reduce((s, p) => s + p.eighth, 0) / validPasses.length : null;

      const carMaintenance = maintenanceItems.filter((m) => m.car_id === car.id);
      const maintenanceDue = carMaintenance.filter(m => m.status === 'Due' || m.status === 'Overdue').length;

      const carSfi = sfiCertifications.filter((c) => c.car_id === car.id);
      const now = new Date();
      const sfiExpiring = carSfi.filter(c => {
        if (!c.expirationDate) return false;
        const exp = new Date(c.expirationDate);
        const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 90 && diffDays > 0;
      }).length;
      const sfiExpired = carSfi.filter(c => c.status === 'Expired').length;

      const carWorkOrders = workOrders.filter((w) => w.car_id === car.id);

      const openWO = carWorkOrders.filter(w => w.status === 'Open' || w.status === 'In Progress').length;

      const totalCost = carMaintenance.reduce((s, m) => s + (m.estimatedCost || 0), 0);

      // ET trend (last 10 valid passes, chronological)
      const etTrend = [...validPasses]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-10)
        .map(p => p.eighth);

      return {
        car,
        totalPasses: carPasses.length,
        bestET,
        bestMPH,
        avgET,
        maintenanceDue,
        sfiExpiring,
        sfiExpired,
        openWO,
        totalCost,
        etTrend
      };
    });
  }, [activeCars, passLogs, maintenanceItems, sfiCertifications, workOrders]);

  if (activeCars.length === 0) return null;

  // Mini SVG sparkline for ET trend
  const ETSparkline: React.FC<{ data: number[] }> = ({ data }) => {
    if (data.length < 2) return <span className="text-xs text-slate-500 italic">Not enough data</span>;
    const w = 120, h = 32, pad = 2;
    const min = Math.min(...data) - 0.05;
    const max = Math.max(...data) + 0.05;
    const range = max - min || 1;
    const points = data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    }).join(' ');
    const improving = data[data.length - 1] < data[0];
    return (
      <svg width={w} height={h} className="block">
        <polyline points={points} fill="none" stroke={improving ? '#22d3ee' : '#f59e0b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((v, i) => {
          const x = pad + (i / (data.length - 1)) * (w - pad * 2);
          const y = pad + (1 - (v - min) / range) * (h - pad * 2);
          return <circle key={i} cx={x} cy={y} r="2" fill={i === data.length - 1 ? (improving ? '#22d3ee' : '#f59e0b') : '#64748b'} />;
        })}
      </svg>
    );
  };

  return (
    <div className="mt-6 px-4 pb-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-bold text-white">Per-Car Statistics</h3>
        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{activeCars.length} car{activeCars.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {carStats.map(({ car, totalPasses, bestET, bestMPH, avgET, maintenanceDue, sfiExpiring, sfiExpired, openWO, totalCost, etTrend }) => (
          <div key={car.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
            {/* Car header */}
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-700/50">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold" style={{ backgroundColor: (car.color || '#06b6d4') + '22', color: car.color || '#06b6d4' }}>
                {(car.nickname || car.year || '?').toString().charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{car.nickname || `${car.year} ${car.make} ${car.model}`}</p>
                <p className="text-slate-400 text-xs truncate">{car.year} {car.make} {car.model}</p>
              </div>
              {(maintenanceDue > 0 || sfiExpired > 0) && (
                <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">ALERTS</span>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                <Zap className="w-3.5 h-3.5 text-cyan-400 mx-auto mb-1" />
                <p className="text-white font-bold text-sm">{totalPasses}</p>
                <p className="text-slate-500 text-[10px]">Passes</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                <TrendingUp className="w-3.5 h-3.5 text-green-400 mx-auto mb-1" />
                <p className="text-white font-bold text-sm">{bestET ? bestET.toFixed(3) : '—'}</p>
                <p className="text-slate-500 text-[10px]">Best ET</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                <Gauge className="w-3.5 h-3.5 text-orange-400 mx-auto mb-1" />
                <p className="text-white font-bold text-sm">{bestMPH ? bestMPH.toFixed(1) : '—'}</p>
                <p className="text-slate-500 text-[10px]">Best MPH</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                <Wrench className="w-3.5 h-3.5 text-yellow-400 mx-auto mb-1" />
                <p className={`font-bold text-sm ${maintenanceDue > 0 ? 'text-yellow-400' : 'text-white'}`}>{maintenanceDue}</p>
                <p className="text-slate-500 text-[10px]">Maint Due</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                <Shield className="w-3.5 h-3.5 text-purple-400 mx-auto mb-1" />
                <p className={`font-bold text-sm ${sfiExpired > 0 ? 'text-red-400' : sfiExpiring > 0 ? 'text-yellow-400' : 'text-white'}`}>{sfiExpired + sfiExpiring}</p>
                <p className="text-slate-500 text-[10px]">SFI Alerts</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
                <p className="text-white font-bold text-sm">${totalCost > 999 ? (totalCost / 1000).toFixed(1) + 'k' : totalCost.toFixed(0)}</p>
                <p className="text-slate-500 text-[10px]">Est. Costs</p>
              </div>
            </div>

            {/* ET Trend sparkline */}
            <div className="flex items-center justify-between bg-slate-900/40 rounded-lg px-3 py-2">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">ET Trend</p>
                {avgET && <p className="text-xs text-slate-300">Avg: {avgET.toFixed(3)}s</p>}
              </div>
              <ETSparkline data={etTrend} />
            </div>

            {/* Open work orders badge */}
            {openWO > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
                <Wrench className="w-3 h-3" />
                <span>{openWO} open work order{openWO !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CarStatsDashboard;
