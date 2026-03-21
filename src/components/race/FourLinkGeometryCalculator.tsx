import React, { useState, useMemo, useCallback } from 'react';
import {
  getHousingBrackets,
  getChassisBrackets,
  PRO_MOD_SPEC,
} from '@/data/quartermaxBrackets';
import {
  strangeBrackets,
} from '@/data/strangeBrackets';

// ===== BRACKET IMAGE URLS — visual reference only =====
const REAR_BRACKET_IMG = 'https://d64gsuwffb70l.cloudfront.net/697973c820585a112a8b8184_1773632158390_9c59a9b8.png';
const FRONT_BRACKET_IMG = 'https://d64gsuwffb70l.cloudfront.net/697973c820585a112a8b8184_1773632172744_3ed1be16.png';

// ===== TYPES =====
interface SelectedHoles {
  rearUpper: { heightFromAxle: number; forwardOfAxle: number; label: string } | null;
  rearLower: { heightFromAxle: number; forwardOfAxle: number; label: string } | null;
  frontUpper: { heightFromAxle: number; forwardOfAxle: number; label: string } | null;
  frontLower: { heightFromAxle: number; forwardOfAxle: number; label: string } | null;
}


// ===== MAIN COMPONENT =====
const FourLinkGeometryCalculator: React.FC = () => {
  // Vehicle inputs
  const [wheelbase, setWheelbase] = useState('');
  const [crankshaftHeight, setCrankshaftHeight] = useState('');
  const [axleCLHeight, setAxleCLHeight] = useState('');
  const [chassisForwardDist, setChassisForwardDist] = useState(PRO_MOD_SPEC.chassisForwardOfAxleDefault.toString());

  // Bracket selections
  const [housingBracketType, setHousingBracketType] = useState<'quartermax' | 'strange'>('quartermax');
  const [selectedQMHousing, setSelectedQMHousing] = useState<string>('');
  const [selectedStrangeHousing, setSelectedStrangeHousing] = useState<string>('');
  const [selectedQMChassisSeries, setSelectedQMChassisSeries] = useState<string>('Extreme 1/8" Billet');
  const [selectedQMChassisUpper, setSelectedQMChassisUpper] = useState<string>('');
  const [selectedQMChassisLower, setSelectedQMChassisLower] = useState<string>('');

  // Hole selections
  const [selected, setSelected] = useState<SelectedHoles>({
    rearUpper: null,
    rearLower: null,
    frontUpper: null,
    frontLower: null,
  });

  // UI state
  const [showRefImages, setShowRefImages] = useState(false);

  // ===== DERIVED DATA =====
  const qmHousingBrackets = useMemo(() => getHousingBrackets(), []);
  const qmChassisBrackets = useMemo(() => getChassisBrackets(), []);

  const filteredChassisBrackets = useMemo(() => {
    return qmChassisBrackets.filter(b => b.series === selectedQMChassisSeries);
  }, [qmChassisBrackets, selectedQMChassisSeries]);

  // Auto-select first brackets
  React.useEffect(() => {
    if (qmHousingBrackets.length > 0 && !selectedQMHousing) {
      setSelectedQMHousing(qmHousingBrackets[0].id);
    }
  }, [qmHousingBrackets, selectedQMHousing]);

  React.useEffect(() => {
    if (strangeBrackets.length > 0 && !selectedStrangeHousing) {
      setSelectedStrangeHousing(strangeBrackets[0].id);
    }
  }, [selectedStrangeHousing]);

  React.useEffect(() => {
    const upper = filteredChassisBrackets.find(b => b.name.toLowerCase().includes('upper'));
    const lower = filteredChassisBrackets.find(b => b.name.toLowerCase().includes('lower'));
    if (upper) setSelectedQMChassisUpper(upper.id);
    if (lower) setSelectedQMChassisLower(lower.id);
  }, [filteredChassisBrackets]);

  // Get current housing bracket holes
  const housingHoles = useMemo(() => {
    if (housingBracketType === 'quartermax') {
      const bracket = qmHousingBrackets.find(b => b.id === selectedQMHousing);
      return bracket ? bracket.holes.map(h => ({
        id: h.id,
        label: h.label,
        heightFromAxle: h.heightFromAxle,
        forwardOfAxle: h.forwardOfAxle,
      })) : [];
    } else {
      const bracket = strangeBrackets.find(b => b.id === selectedStrangeHousing);
      if (!bracket) return [];
      const upper = bracket.upperMountHoles.map(h => ({ ...h, group: 'upper' as const }));
      const lower = bracket.lowerMountHoles.map(h => ({ ...h, group: 'lower' as const }));
      return [...upper, ...lower].sort((a, b) => b.heightFromAxle - a.heightFromAxle);
    }
  }, [housingBracketType, selectedQMHousing, selectedStrangeHousing, qmHousingBrackets]);

  // Get current chassis bracket holes
  const chassisUpperHoles = useMemo(() => {
    const bracket = qmChassisBrackets.find(b => b.id === selectedQMChassisUpper);
    return bracket ? bracket.holes : [];
  }, [qmChassisBrackets, selectedQMChassisUpper]);

  const chassisLowerHoles = useMemo(() => {
    const bracket = qmChassisBrackets.find(b => b.id === selectedQMChassisLower);
    return bracket ? bracket.holes : [];
  }, [qmChassisBrackets, selectedQMChassisLower]);

  const chassisFwd = parseFloat(chassisForwardDist) || PRO_MOD_SPEC.chassisForwardOfAxleDefault;

  // ===== GEOMETRY CALCULATIONS =====
  const calc = useMemo(() => {
    const wb = parseFloat(wheelbase) || 0;
    const ch = parseFloat(crankshaftHeight) || 0;
    const axleCL = parseFloat(axleCLHeight) || 0;

    if (!selected.rearUpper || !selected.rearLower || !selected.frontUpper || !selected.frontLower) {
      return null;
    }

    // Absolute positions from ground
    const rearUpperH = axleCL + selected.rearUpper.heightFromAxle;
    const rearUpperX = selected.rearUpper.forwardOfAxle;
    const rearLowerH = axleCL + selected.rearLower.heightFromAxle;
    const rearLowerX = selected.rearLower.forwardOfAxle;
    const frontUpperH = axleCL + selected.frontUpper.heightFromAxle;
    const frontUpperX = chassisFwd;
    const frontLowerH = axleCL + selected.frontLower.heightFromAxle;
    const frontLowerX = chassisFwd;

    // Bar lengths (derived)
    const upperDx = frontUpperX - rearUpperX;
    const upperDy = frontUpperH - rearUpperH;
    const upperBarLength = Math.sqrt(upperDx * upperDx + upperDy * upperDy);

    const lowerDx = frontLowerX - rearLowerX;
    const lowerDy = frontLowerH - rearLowerH;
    const lowerBarLength = Math.sqrt(lowerDx * lowerDx + lowerDy * lowerDy);

    // Bar angles
    const upperBarAngle = Math.atan2(upperDy, upperDx) * (180 / Math.PI);
    const lowerBarAngle = Math.atan2(lowerDy, lowerDx) * (180 / Math.PI);

    // Spreads
    const rearSpread = rearUpperH - rearLowerH;
    const frontSpread = frontUpperH - frontLowerH;

    // Instant center (line intersection)
    const x1 = rearUpperX, y1 = rearUpperH;
    const x2 = frontUpperX, y2 = frontUpperH;
    const x3 = rearLowerX, y3 = rearLowerH;
    const x4 = frontLowerX, y4 = frontLowerH;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    let icX = 0, icY = 0;
    if (Math.abs(denom) > 0.0001) {
      icX = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom;
      icY = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom;
    }

    // Anti-squat
    let antiSquat = 0;
    if (wb > 0 && ch > 0) {
      antiSquat = (icY / ch) * (icX / wb) * 100;
    }

    return {
      rearUpperH, rearUpperX, rearLowerH, rearLowerX,
      frontUpperH, frontUpperX, frontLowerH, frontLowerX,
      upperBarLength, lowerBarLength,
      upperBarAngle, lowerBarAngle,
      rearSpread, frontSpread,
      icX, icY, antiSquat,
      axleCL, wb, ch,
    };
  }, [selected, wheelbase, crankshaftHeight, axleCLHeight, chassisFwd]);

  // ===== HOLE SELECTION HANDLERS =====
  const selectRearUpper = useCallback((hole: { label: string; heightFromAxle: number; forwardOfAxle: number }) => {
    setSelected(prev => ({ ...prev, rearUpper: hole }));
  }, []);
  const selectRearLower = useCallback((hole: { label: string; heightFromAxle: number; forwardOfAxle: number }) => {
    setSelected(prev => ({ ...prev, rearLower: hole }));
  }, []);
  const selectFrontUpper = useCallback((hole: { label: string; heightFromAxle: number; forwardOfAxle: number }) => {
    setSelected(prev => ({ ...prev, frontUpper: { ...hole, forwardOfAxle: chassisFwd } }));
  }, [chassisFwd]);
  const selectFrontLower = useCallback((hole: { label: string; heightFromAxle: number; forwardOfAxle: number }) => {
    setSelected(prev => ({ ...prev, frontLower: { ...hole, forwardOfAxle: chassisFwd } }));
  }, [chassisFwd]);

  // ===== SCHEMATIC SVG =====
  const svgW = 900;
  const svgH = 420;
  const margin = { left: 80, right: 40, top: 30, bottom: 50 };
  const plotW = svgW - margin.left - margin.right;
  const plotH = svgH - margin.top - margin.bottom;

  // Scale: map real inches to SVG pixels
  const maxX = Math.max(chassisFwd + 5, 30);
  const maxY = 25; // max height in inches
  const scaleX = (x: number) => margin.left + (x / maxX) * plotW;
  const scaleY = (y: number) => margin.top + plotH - (y / maxY) * plotH;

  const accentColor = '#d4880a';
  const textDark = '#1a1a2e';

  // ===== RENDER =====
  return (
    <div style={{ background: '#ffffff', fontFamily: "'Arial', sans-serif", color: textDark, minHeight: '100vh' }}>
      {/* HEADER */}
      <div style={{
        background: '#1a1a2e',
        borderTop: `2px solid ${accentColor}`,
        borderBottom: `2px solid ${accentColor}`,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 15,
        fontWeight: 'bold',
        letterSpacing: 1,
      }}>
        <span style={{ color: accentColor }}>PRTM PRO</span>
        <span style={{ color: accentColor, margin: '0 4px' }}>|</span>
        <span style={{ color: accentColor, fontWeight: 'normal' }}>Chassis Setup</span>
        <span style={{ color: accentColor }}>&gt;</span>
        <span style={{ color: accentColor, fontWeight: 'normal' }}>4-Link Geometry Calculator</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowRefImages(prev => !prev)}
          style={{
            background: showRefImages ? accentColor : 'transparent',
            color: showRefImages ? '#fff' : accentColor,
            border: `1.5px solid ${accentColor}`,
            padding: '5px 14px',
            fontSize: 11,
            fontWeight: 'bold',
            cursor: 'pointer',
            fontFamily: "'Arial', sans-serif",
          }}
        >
          {showRefImages ? 'Hide Bracket Photos' : 'Show Bracket Photos'}
        </button>
      </div>

      <div style={{ maxWidth: 1500, margin: '0 auto', padding: '20px 16px' }}>
        {/* VEHICLE INPUTS */}
        <div style={{
          display: 'flex',
          gap: 20,
          marginBottom: 20,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}>
          <VehicleInput label="Wheelbase" value={wheelbase} onChange={setWheelbase} unit='"' num={1} />
          <VehicleInput label="Crankshaft Height" value={crankshaftHeight} onChange={setCrankshaftHeight} unit='"' num={2} />
          <VehicleInput label="Axle CL Height from Ground" value={axleCLHeight} onChange={setAxleCLHeight} unit='"' num={3} hint="With driver, race weight" />
          <VehicleInput label="Chassis Brackets Fwd of Axle" value={chassisForwardDist} onChange={setChassisForwardDist} unit='"' num={4} hint={`Pro Mod: ${PRO_MOD_SPEC.chassisForwardOfAxleMin}-${PRO_MOD_SPEC.chassisForwardOfAxleMax}"`} />
        </div>

        {/* BRACKET SELECTION + HOLE TABLES */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
          {/* HOUSING BRACKET (REAR / AXLE) */}
          <div style={{ flex: '1 1 420px', minWidth: 380 }}>
            <SectionHeader title="HOUSING BRACKET" subtitle="Rear / Axle Mount" color="#0891b2" />
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#fafbfc' }}>
              {/* Bracket type toggle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <ToggleBtn active={housingBracketType === 'quartermax'} onClick={() => setHousingBracketType('quartermax')} label="Quartermax" />
                <ToggleBtn active={housingBracketType === 'strange'} onClick={() => setHousingBracketType('strange')} label="Strange" />
              </div>

              {/* Bracket model selector */}
              {housingBracketType === 'quartermax' ? (
                <select
                  value={selectedQMHousing}
                  onChange={e => { setSelectedQMHousing(e.target.value); setSelected(prev => ({ ...prev, rearUpper: null, rearLower: null })); }}
                  style={selectStyle}
                >
                  {qmHousingBrackets.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.totalHoles} holes, {b.holeSpacing}" spacing)</option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedStrangeHousing}
                  onChange={e => { setSelectedStrangeHousing(e.target.value); setSelected(prev => ({ ...prev, rearUpper: null, rearLower: null })); }}
                  style={selectStyle}
                >
                  {strangeBrackets.map(b => (
                    <option key={b.id} value={b.id}>{b.name} - {b.series} ({b.type})</option>
                  ))}
                </select>
              )}

              {/* Reference image */}
              {showRefImages && (
                <div style={{ margin: '12px 0', textAlign: 'center' }}>
                  <img src={REAR_BRACKET_IMG} alt="Housing bracket reference" style={{ maxHeight: 180, borderRadius: 6, border: '1px solid #e2e8f0' }} />
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Reference photo — hole positions from manufacturer data</div>
                </div>
              )}

              {/* Hole selection tables */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 'bold', fontSize: 12, color: '#0891b2', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                  SELECT UPPER BAR HOLE
                </div>
                <HoleTable
                  holes={housingHoles}
                  selectedId={selected.rearUpper?.label || null}
                  onSelect={selectRearUpper}
                  color="#3b82f6"
                  axleCL={parseFloat(axleCLHeight) || 0}
                />

                <div style={{ fontWeight: 'bold', fontSize: 12, color: '#0891b2', marginBottom: 6, marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  SELECT LOWER BAR HOLE
                </div>
                <HoleTable
                  holes={housingHoles}
                  selectedId={selected.rearLower?.label || null}
                  onSelect={selectRearLower}
                  color="#22c55e"
                  axleCL={parseFloat(axleCLHeight) || 0}
                />
              </div>
            </div>
          </div>

          {/* CHASSIS BRACKET (FRONT / FRAME) */}
          <div style={{ flex: '1 1 420px', minWidth: 380 }}>
            <SectionHeader title="CHASSIS BRACKET" subtitle="Front / Frame Mount" color="#a855f7" />
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#fafbfc' }}>
              {/* Series selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {['Extreme 1/8" Billet', 'Extreme Pro Series', 'Pro Series', 'Standard'].map(s => (
                  <ToggleBtn key={s} active={selectedQMChassisSeries === s} onClick={() => {
                    setSelectedQMChassisSeries(s);
                    setSelected(prev => ({ ...prev, frontUpper: null, frontLower: null }));
                  }} label={s} />
                ))}
              </div>

              {/* Bracket model selectors */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>Upper Bracket</div>
                  <select
                    value={selectedQMChassisUpper}
                    onChange={e => { setSelectedQMChassisUpper(e.target.value); setSelected(prev => ({ ...prev, frontUpper: null })); }}
                    style={{ ...selectStyle, fontSize: 11 }}
                  >
                    {filteredChassisBrackets.filter(b => b.name.toLowerCase().includes('upper')).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                    {filteredChassisBrackets.filter(b => !b.name.toLowerCase().includes('upper') && !b.name.toLowerCase().includes('lower')).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>Lower Bracket</div>
                  <select
                    value={selectedQMChassisLower}
                    onChange={e => { setSelectedQMChassisLower(e.target.value); setSelected(prev => ({ ...prev, frontLower: null })); }}
                    style={{ ...selectStyle, fontSize: 11 }}
                  >
                    {filteredChassisBrackets.filter(b => b.name.toLowerCase().includes('lower')).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                    {filteredChassisBrackets.filter(b => !b.name.toLowerCase().includes('upper') && !b.name.toLowerCase().includes('lower')).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference image */}
              {showRefImages && (
                <div style={{ margin: '12px 0', textAlign: 'center' }}>
                  <img src={FRONT_BRACKET_IMG} alt="Chassis bracket reference" style={{ maxHeight: 180, borderRadius: 6, border: '1px solid #e2e8f0' }} />
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Reference photo — hole positions from manufacturer data</div>
                </div>
              )}

              {/* Hole selection tables */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 'bold', fontSize: 12, color: '#a855f7', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
                  SELECT UPPER BAR HOLE
                </div>
                <HoleTable
                  holes={chassisUpperHoles.map(h => ({
                    id: h.id,
                    label: h.label,
                    heightFromAxle: h.heightFromAxle,
                    forwardOfAxle: h.forwardOfAxle,
                  }))}
                  selectedId={selected.frontUpper?.label || null}
                  onSelect={selectFrontUpper}
                  color="#f97316"
                  axleCL={parseFloat(axleCLHeight) || 0}
                />

                <div style={{ fontWeight: 'bold', fontSize: 12, color: '#a855f7', marginBottom: 6, marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308', display: 'inline-block' }} />
                  SELECT LOWER BAR HOLE
                </div>
                <HoleTable
                  holes={chassisLowerHoles.map(h => ({
                    id: h.id,
                    label: h.label,
                    heightFromAxle: h.heightFromAxle,
                    forwardOfAxle: h.forwardOfAxle,
                  }))}
                  selectedId={selected.frontLower?.label || null}
                  onSelect={selectFrontLower}
                  color="#eab308"
                  axleCL={parseFloat(axleCLHeight) || 0}
                />
              </div>
            </div>
          </div>
        </div>

        {/* GEOMETRY SCHEMATIC */}
        <div style={{ marginBottom: 24 }}>
          <SectionHeader title="GEOMETRY SCHEMATIC" subtitle="Side view — dotted lines show selected bar paths" color={accentColor} />
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: '#fafbfc',
            overflow: 'hidden',
          }}>
            <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', maxHeight: 440 }}>
              {/* Background */}
              <rect x={0} y={0} width={svgW} height={svgH} fill="#fafbfc" />

              {/* Grid */}
              {Array.from({ length: Math.ceil(maxX / 5) + 1 }, (_, i) => i * 5).map(x => (
                <line key={`gx-${x}`} x1={scaleX(x)} y1={margin.top} x2={scaleX(x)} y2={margin.top + plotH}
                  stroke="#e2e8f0" strokeWidth={x === 0 ? 1.5 : 0.5} />
              ))}
              {Array.from({ length: Math.ceil(maxY / 2) + 1 }, (_, i) => i * 2).map(y => (
                <line key={`gy-${y}`} x1={margin.left} y1={scaleY(y)} x2={margin.left + plotW} y2={scaleY(y)}
                  stroke="#e2e8f0" strokeWidth={y === 0 ? 1.5 : 0.5} />
              ))}

              {/* Axis labels */}
              {Array.from({ length: Math.ceil(maxX / 5) + 1 }, (_, i) => i * 5).map(x => (
                <text key={`lx-${x}`} x={scaleX(x)} y={svgH - 10} fill="#94a3b8" fontSize="9" textAnchor="middle">{x}"</text>
              ))}
              {Array.from({ length: Math.ceil(maxY / 2) + 1 }, (_, i) => i * 2).map(y => (
                <text key={`ly-${y}`} x={margin.left - 8} y={scaleY(y) + 3} fill="#94a3b8" fontSize="9" textAnchor="end">{y}"</text>
              ))}
              <text x={svgW / 2} y={svgH - 2} fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="bold">
                FORWARD OF AXLE CL (inches)
              </text>
              <text x={12} y={svgH / 2} fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="bold"
                transform={`rotate(-90, 12, ${svgH / 2})`}>
                HEIGHT FROM GROUND (inches)
              </text>

              {/* Ground line */}
              <line x1={margin.left} y1={scaleY(0)} x2={margin.left + plotW} y2={scaleY(0)}
                stroke={accentColor} strokeWidth={2} />
              <text x={margin.left + plotW + 4} y={scaleY(0) + 4} fill={accentColor} fontSize="9" fontWeight="bold">GROUND</text>

              {/* Axle CL vertical line */}
              <line x1={scaleX(0)} y1={margin.top} x2={scaleX(0)} y2={scaleY(0)}
                stroke="#ef4444" strokeWidth={1} strokeDasharray="6,4" opacity={0.5} />
              <text x={scaleX(0)} y={margin.top - 6} fill="#ef4444" fontSize="8" textAnchor="middle" opacity={0.7}>AXLE CL</text>

              {/* Axle CL horizontal line */}
              {parseFloat(axleCLHeight) > 0 && (
                <>
                  <line x1={margin.left} y1={scaleY(parseFloat(axleCLHeight))} x2={scaleX(chassisFwd + 2)} y2={scaleY(parseFloat(axleCLHeight))}
                    stroke="#ef4444" strokeWidth={0.8} strokeDasharray="4,3" opacity={0.4} />
                  <text x={margin.left - 4} y={scaleY(parseFloat(axleCLHeight)) + 3} fill="#ef4444" fontSize="7" textAnchor="end" opacity={0.6}>
                    Axle CL {parseFloat(axleCLHeight).toFixed(1)}"
                  </text>
                </>
              )}

              {/* Chassis bracket forward line */}
              <line x1={scaleX(chassisFwd)} y1={margin.top} x2={scaleX(chassisFwd)} y2={scaleY(0)}
                stroke="#a855f7" strokeWidth={1} strokeDasharray="6,4" opacity={0.4} />
              <text x={scaleX(chassisFwd)} y={margin.top - 6} fill="#a855f7" fontSize="8" textAnchor="middle" opacity={0.7}>
                CHASSIS ({chassisFwd}")
              </text>

              {/* All housing holes (dimmed) */}
              {housingHoles.map((hole, i) => {
                const hFromGround = (parseFloat(axleCLHeight) || 0) + hole.heightFromAxle;
                if (hFromGround < 0 || hFromGround > maxY) return null;
                const isUpperSel = selected.rearUpper?.label === hole.label;
                const isLowerSel = selected.rearLower?.label === hole.label;
                return (
                  <g key={`rh-${i}`}>
                    <circle
                      cx={scaleX(hole.forwardOfAxle)}
                      cy={scaleY(hFromGround)}
                      r={isUpperSel || isLowerSel ? 6 : 3.5}
                      fill={isUpperSel ? '#3b82f6' : isLowerSel ? '#22c55e' : '#cbd5e1'}
                      stroke={isUpperSel ? '#1d4ed8' : isLowerSel ? '#15803d' : '#94a3b8'}
                      strokeWidth={isUpperSel || isLowerSel ? 2 : 0.8}
                    />
                    {(isUpperSel || isLowerSel) && (
                      <text x={scaleX(hole.forwardOfAxle) - 10} y={scaleY(hFromGround) - 9}
                        fill={isUpperSel ? '#3b82f6' : '#22c55e'} fontSize="8" fontWeight="bold" textAnchor="end">
                        {isUpperSel ? 'REAR UPPER' : 'REAR LOWER'}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* All chassis upper holes (dimmed) */}
              {chassisUpperHoles.map((hole, i) => {
                const hFromGround = (parseFloat(axleCLHeight) || 0) + hole.heightFromAxle;
                if (hFromGround < 0 || hFromGround > maxY) return null;
                const isSel = selected.frontUpper?.label === hole.label;
                return (
                  <g key={`fu-${i}`}>
                    <circle
                      cx={scaleX(chassisFwd)}
                      cy={scaleY(hFromGround)}
                      r={isSel ? 6 : 3.5}
                      fill={isSel ? '#f97316' : '#e2e8f0'}
                      stroke={isSel ? '#c2410c' : '#94a3b8'}
                      strokeWidth={isSel ? 2 : 0.8}
                    />
                    {isSel && (
                      <text x={scaleX(chassisFwd) + 10} y={scaleY(hFromGround) - 9}
                        fill="#f97316" fontSize="8" fontWeight="bold">
                        FRONT UPPER
                      </text>
                    )}
                  </g>
                );
              })}

              {/* All chassis lower holes (dimmed) */}
              {chassisLowerHoles.map((hole, i) => {
                const hFromGround = (parseFloat(axleCLHeight) || 0) + hole.heightFromAxle;
                if (hFromGround < 0 || hFromGround > maxY) return null;
                const isSel = selected.frontLower?.label === hole.label;
                return (
                  <g key={`fl-${i}`}>
                    <circle
                      cx={scaleX(chassisFwd) + 8}
                      cy={scaleY(hFromGround)}
                      r={isSel ? 6 : 3.5}
                      fill={isSel ? '#eab308' : '#e2e8f0'}
                      stroke={isSel ? '#a16207' : '#94a3b8'}
                      strokeWidth={isSel ? 2 : 0.8}
                    />
                    {isSel && (
                      <text x={scaleX(chassisFwd) + 20} y={scaleY(hFromGround) - 9}
                        fill="#eab308" fontSize="8" fontWeight="bold">
                        FRONT LOWER
                      </text>
                    )}
                  </g>
                );
              })}

              {/* DOTTED LINES connecting selected holes */}
              {calc && (
                <>
                  {/* Upper bar dotted line */}
                  <line
                    x1={scaleX(calc.rearUpperX)} y1={scaleY(calc.rearUpperH)}
                    x2={scaleX(calc.frontUpperX)} y2={scaleY(calc.frontUpperH)}
                    stroke="#3b82f6" strokeWidth={2.5} strokeDasharray="8,5"
                    strokeLinecap="round"
                  />
                  {/* Upper bar length label */}
                  <rect
                    x={(scaleX(calc.rearUpperX) + scaleX(calc.frontUpperX)) / 2 - 40}
                    y={(scaleY(calc.rearUpperH) + scaleY(calc.frontUpperH)) / 2 - 18}
                    width={80} height={16} fill="white" stroke="#3b82f6" strokeWidth={1} rx={3}
                  />
                  <text
                    x={(scaleX(calc.rearUpperX) + scaleX(calc.frontUpperX)) / 2}
                    y={(scaleY(calc.rearUpperH) + scaleY(calc.frontUpperH)) / 2 - 7}
                    fill="#3b82f6" fontSize="10" fontWeight="bold" textAnchor="middle">
                    Upper: {calc.upperBarLength.toFixed(2)}"
                  </text>

                  {/* Lower bar dotted line */}
                  <line
                    x1={scaleX(calc.rearLowerX)} y1={scaleY(calc.rearLowerH)}
                    x2={scaleX(calc.frontLowerX + 0.3)} y2={scaleY(calc.frontLowerH)}
                    stroke="#22c55e" strokeWidth={2.5} strokeDasharray="8,5"
                    strokeLinecap="round"
                  />
                  {/* Lower bar length label */}
                  <rect
                    x={(scaleX(calc.rearLowerX) + scaleX(calc.frontLowerX)) / 2 - 40}
                    y={(scaleY(calc.rearLowerH) + scaleY(calc.frontLowerH)) / 2 + 4}
                    width={80} height={16} fill="white" stroke="#22c55e" strokeWidth={1} rx={3}
                  />
                  <text
                    x={(scaleX(calc.rearLowerX) + scaleX(calc.frontLowerX)) / 2}
                    y={(scaleY(calc.rearLowerH) + scaleY(calc.frontLowerH)) / 2 + 15}
                    fill="#22c55e" fontSize="10" fontWeight="bold" textAnchor="middle">
                    Lower: {calc.lowerBarLength.toFixed(2)}"
                  </text>

                  {/* IC projection lines (extended dotted) */}
                  {calc.icX > 0 && calc.icY > 0 && calc.icX < 200 && calc.icY < 100 && (
                    <>
                      <line
                        x1={scaleX(calc.frontUpperX)} y1={scaleY(calc.frontUpperH)}
                        x2={scaleX(Math.min(calc.icX, maxX - 2))} y2={scaleY(Math.min(calc.icY, maxY - 1))}
                        stroke="#a855f7" strokeWidth={1} strokeDasharray="4,4" opacity={0.5}
                      />
                      <line
                        x1={scaleX(calc.frontLowerX)} y1={scaleY(calc.frontLowerH)}
                        x2={scaleX(Math.min(calc.icX, maxX - 2))} y2={scaleY(Math.min(calc.icY, maxY - 1))}
                        stroke="#a855f7" strokeWidth={1} strokeDasharray="4,4" opacity={0.5}
                      />
                      {/* IC point */}
                      {calc.icX <= maxX && calc.icY <= maxY && (
                        <g>
                          <circle cx={scaleX(calc.icX)} cy={scaleY(calc.icY)} r={8}
                            fill="none" stroke="#a855f7" strokeWidth={2} strokeDasharray="3,2" />
                          <circle cx={scaleX(calc.icX)} cy={scaleY(calc.icY)} r={3} fill="#a855f7" />
                          <text x={scaleX(calc.icX)} y={scaleY(calc.icY) - 14}
                            fill="#a855f7" fontSize="9" fontWeight="bold" textAnchor="middle">
                            IC ({calc.icX.toFixed(1)}", {calc.icY.toFixed(1)}")
                          </text>
                        </g>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Legend */}
              <g transform={`translate(${svgW - 200}, ${margin.top + 5})`}>
                <rect x={0} y={0} width={190} height={90} fill="white" stroke="#e2e8f0" rx={4} />
                <circle cx={14} cy={16} r={4} fill="#3b82f6" />
                <text x={24} y={19} fill="#333" fontSize="9">Upper bar (rear housing)</text>
                <circle cx={14} cy={34} r={4} fill="#22c55e" />
                <text x={24} y={37} fill="#333" fontSize="9">Lower bar (rear housing)</text>
                <circle cx={14} cy={52} r={4} fill="#f97316" />
                <text x={24} y={55} fill="#333" fontSize="9">Upper bar (chassis frame)</text>
                <circle cx={14} cy={70} r={4} fill="#eab308" />
                <text x={24} y={73} fill="#333" fontSize="9">Lower bar (chassis frame)</text>
                <circle cx={14} cy={86} r={4} fill="none" stroke="#a855f7" strokeWidth={1.5} strokeDasharray="2,1" />
                <text x={24} y={89} fill="#a855f7" fontSize="9">Instant Center</text>
              </g>

              {/* No selection message */}
              {!calc && (
                <text x={svgW / 2} y={svgH / 2} fill="#94a3b8" fontSize="14" textAnchor="middle">
                  Select all 4 holes to see geometry
                </text>
              )}
            </svg>
          </div>
        </div>

        {/* RESULTS */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {/* Instant Center Results */}
          <div style={{ flex: '1 1 280px', minWidth: 260 }}>
            <SectionHeader title="INSTANT CENTER RESULTS" subtitle="" color={accentColor} />
            <div style={{
              border: `2px solid ${accentColor}`,
              background: '#1a1a2e',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px' }}>
                <ResultRow label="IC Length (X):" value={calc?.icX} unit='"' />
                <ResultRow label="IC Height (Y):" value={calc?.icY} unit='"' />
                <ResultRow label="Anti-Squat:" value={calc?.antiSquat} unit="%" isPercent />
              </div>
            </div>
          </div>

          {/* Bar Geometry */}
          <div style={{ flex: '1 1 280px', minWidth: 260 }}>
            <SectionHeader title="BAR GEOMETRY" subtitle="Derived from selected holes" color="#3b82f6" />
            <div style={{
              border: '2px solid #3b82f6',
              background: '#1a1a2e',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px' }}>
                <ResultRow label="Upper Bar Length:" value={calc?.upperBarLength} unit='"' color="#3b82f6" />
                <ResultRow label="Upper Bar Angle:" value={calc?.upperBarAngle} unit="°" color="#3b82f6" />
                <ResultRow label="Lower Bar Length:" value={calc?.lowerBarLength} unit='"' color="#22c55e" />
                <ResultRow label="Lower Bar Angle:" value={calc?.lowerBarAngle} unit="°" color="#22c55e" />
              </div>
            </div>
          </div>

          {/* Spreads & Positions */}
          <div style={{ flex: '1 1 280px', minWidth: 260 }}>
            <SectionHeader title="SPREADS & POSITIONS" subtitle="Vertical distances" color="#0891b2" />
            <div style={{
              border: '2px solid #0891b2',
              background: '#1a1a2e',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px' }}>
                <ResultRow label="Rear Spread:" value={calc?.rearSpread} unit='"' color="#0891b2" />
                <ResultRow label="Front Spread:" value={calc?.frontSpread} unit='"' color="#a855f7" />
                <ResultRow label="Rear Upper Height:" value={calc?.rearUpperH} unit='"' color="#94a3b8" />
                <ResultRow label="Rear Lower Height:" value={calc?.rearLowerH} unit='"' color="#94a3b8" />
                <ResultRow label="Front Upper Height:" value={calc?.frontUpperH} unit='"' color="#94a3b8" />
                <ResultRow label="Front Lower Height:" value={calc?.frontLowerH} unit='"' color="#94a3b8" />
              </div>
            </div>
          </div>
        </div>

        {/* Selection Summary */}
        {(selected.rearUpper || selected.rearLower || selected.frontUpper || selected.frontLower) && (
          <div style={{ marginTop: 20, padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <div style={{ fontWeight: 'bold', fontSize: 13, color: '#334155', marginBottom: 8 }}>CURRENT SELECTION</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12 }}>
              <SelectionBadge label="Rear Upper" hole={selected.rearUpper} color="#3b82f6" axleCL={parseFloat(axleCLHeight) || 0} />
              <SelectionBadge label="Rear Lower" hole={selected.rearLower} color="#22c55e" axleCL={parseFloat(axleCLHeight) || 0} />
              <SelectionBadge label="Front Upper" hole={selected.frontUpper} color="#f97316" axleCL={parseFloat(axleCLHeight) || 0} />
              <SelectionBadge label="Front Lower" hole={selected.frontLower} color="#eab308" axleCL={parseFloat(axleCLHeight) || 0} />
            </div>
            <button
              onClick={() => setSelected({ rearUpper: null, rearLower: null, frontUpper: null, frontLower: null })}
              style={{
                marginTop: 10,
                padding: '4px 12px',
                fontSize: 11,
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Clear All Selections
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ===== SUB-COMPONENTS =====

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontSize: 12,
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  background: 'white',
  color: '#1a1a2e',
  outline: 'none',
  marginBottom: 4,
};

const SectionHeader: React.FC<{ title: string; subtitle: string; color: string }> = ({ title, subtitle, color }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
    <div style={{
      fontSize: 13,
      fontWeight: 'bold',
      letterSpacing: 1.5,
      color,
    }}>
      {title}
    </div>
    {subtitle && <div style={{ fontSize: 11, color: '#94a3b8' }}>{subtitle}</div>}
  </div>
);

const VehicleInput: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  unit: string; num: number; hint?: string;
}> = ({ label, value, onChange, unit, num, hint }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 160 }}>
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: '#d4880a', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 'bold', fontSize: 13,
    }}>
      {num}
    </div>
    <div style={{ color: '#1a1a2e', fontSize: 11, textAlign: 'center', fontWeight: 'bold' }}>{label}</div>
    {hint && <div style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center' }}>{hint}</div>}
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <input
        type="text"
        inputMode="decimal"
        placeholder="--.-"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: '#ffffff',
          border: '1.5px solid #d4880a',
          color: '#1a1a2e',
          padding: '5px 10px',
          fontSize: 13,
          width: 120,
          textAlign: 'center',
          outline: 'none',
          borderRadius: 4,
        }}
      />
      <span style={{ color: '#d4880a', fontSize: 12, marginLeft: 3, fontWeight: 'bold' }}>{unit}</span>
    </div>
  </div>
);

const ToggleBtn: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    style={{
      padding: '4px 10px',
      fontSize: 10,
      fontWeight: 'bold',
      border: `1.5px solid ${active ? '#d4880a' : '#cbd5e1'}`,
      background: active ? '#d4880a' : 'white',
      color: active ? 'white' : '#64748b',
      borderRadius: 4,
      cursor: 'pointer',
      transition: 'all 0.15s',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </button>
);

const HoleTable: React.FC<{
  holes: { id: string; label: string; heightFromAxle: number; forwardOfAxle: number }[];
  selectedId: string | null;
  onSelect: (hole: { label: string; heightFromAxle: number; forwardOfAxle: number }) => void;
  color: string;
  axleCL: number;
}> = ({ holes, selectedId, onSelect, color, axleCL }) => {
  if (holes.length === 0) {
    return <div style={{ fontSize: 11, color: '#94a3b8', padding: '8px 0' }}>No bracket selected</div>;
  }

  // Sort by heightFromAxle descending (top holes first)
  const sorted = [...holes].sort((a, b) => b.heightFromAxle - a.heightFromAxle);

  return (
    <div style={{
      maxHeight: 200,
      overflowY: 'auto',
      border: '1px solid #e2e8f0',
      borderRadius: 6,
      background: 'white',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
            <th style={thStyle}></th>
            <th style={thStyle}>Hole</th>
            <th style={thStyle}>From Axle CL</th>
            <th style={thStyle}>Fwd of Axle</th>
            <th style={thStyle}>From Ground</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((hole, i) => {
            const isSelected = selectedId === hole.label;
            const fromGround = axleCL > 0 ? (axleCL + hole.heightFromAxle).toFixed(2) + '"' : '—';
            return (
              <tr
                key={hole.id || i}
                onClick={() => onSelect(hole)}
                style={{
                  cursor: 'pointer',
                  background: isSelected ? `${color}15` : i % 2 === 0 ? 'white' : '#f8fafc',
                  borderLeft: isSelected ? `3px solid ${color}` : '3px solid transparent',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget.style.background = '#f1f5f9'); }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#f8fafc'); }}
              >
                <td style={{ ...tdStyle, width: 28, textAlign: 'center' }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: `2px solid ${isSelected ? color : '#cbd5e1'}`,
                    background: isSelected ? color : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto',
                  }}>
                    {isSelected && (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />
                    )}
                  </div>
                </td>
                <td style={{ ...tdStyle, fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? color : '#334155' }}>
                  {hole.label}
                </td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#64748b' }}>
                  {hole.heightFromAxle > 0 ? '+' : ''}{hole.heightFromAxle.toFixed(3)}"
                </td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#64748b' }}>
                  {hole.forwardOfAxle.toFixed(1)}"
                </td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? color : '#64748b' }}>
                  {fromGround}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '4px 6px',
  textAlign: 'left',
  fontWeight: 'bold',
  color: '#64748b',
  fontSize: 10,
  borderBottom: '1px solid #e2e8f0',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 6px',
  borderBottom: '1px solid #f1f5f9',
  whiteSpace: 'nowrap',
};

const ResultRow: React.FC<{
  label: string; value: number | undefined | null; unit: string;
  isPercent?: boolean; color?: string;
}> = ({ label, value, unit, isPercent, color }) => {
  const displayVal = value != null && isFinite(value) && value !== 0
    ? (isPercent ? value.toFixed(1) : value.toFixed(2))
    : '--.-';

  return (
    <div style={{
      display: 'flex', alignItems: 'baseline',
      justifyContent: 'space-between', padding: '4px 0',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      <span style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>{label}</span>
      <span style={{
        color: color || (isPercent ? '#d4880a' : '#ffffff'),
        fontSize: 16, fontWeight: 'bold',
        fontFamily: 'monospace',
      }}>
        {displayVal}{unit}
      </span>
    </div>
  );
};

const SelectionBadge: React.FC<{
  label: string;
  hole: { label: string; heightFromAxle: number; forwardOfAxle: number } | null;
  color: string;
  axleCL: number;
}> = ({ label, hole, color, axleCL }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 10px',
    border: `1.5px solid ${hole ? color : '#e2e8f0'}`,
    borderRadius: 6,
    background: hole ? `${color}10` : 'white',
  }}>
    <div style={{
      width: 10, height: 10, borderRadius: '50%',
      background: hole ? color : '#e2e8f0',
    }} />
    <div>
      <div style={{ fontSize: 10, fontWeight: 'bold', color: hole ? color : '#94a3b8' }}>{label}</div>
      {hole ? (
        <div style={{ fontSize: 10, color: '#64748b' }}>
          {hole.label} — {(axleCL + hole.heightFromAxle).toFixed(2)}" from ground
        </div>
      ) : (
        <div style={{ fontSize: 10, color: '#cbd5e1' }}>Not selected</div>
      )}
    </div>
  </div>
);

export default FourLinkGeometryCalculator;
