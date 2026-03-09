import React, { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CrewRole } from '@/lib/permissions';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Gauge,
  Timer,
  Zap,
  Calendar,
  Trophy,
  Activity,
  PieChart,
  ArrowUp,
  ArrowDown,
  Minus,
  Filter,
  Download,
  Clock,
  AlertTriangle,
  CheckCircle,
  LineChart as LineChartIcon,
  Info
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Bar
} from 'recharts';

interface AnalyticsDashboardProps {
  currentRole?: CrewRole;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ currentRole = 'Crew' }) => {

  const { passLogs, raceEvents, engines, workOrders, maintenanceItems } = useApp();
  const [timeRange, setTimeRange] = useState<'all' | 'year' | 'month' | 'week'>('year');
  const [selectedEngine, setSelectedEngine] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'reaction' | 'et' | 'tracks' | 'trends' | 'bestReaction' | 'best60' | 'best330' | 'avgET' | 'avgMPH'>('overview');


  // Filter passes by time range
  const filteredPasses = useMemo(() => {
    let passes = [...passLogs];
    
    if (selectedEngine !== 'all') {
      passes = passes.filter(p => p.engineId === selectedEngine);
    }

    const now = new Date();
    switch (timeRange) {
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        passes = passes.filter(p => new Date(p.date) >= weekAgo);
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        passes = passes.filter(p => new Date(p.date) >= monthAgo);
        break;
      case 'year':
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        passes = passes.filter(p => new Date(p.date) >= yearAgo);
        break;
    }

    return passes.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [passLogs, timeRange, selectedEngine]);

  // Passes for analytics (excluding aborted)
  const analyticsPasses = useMemo(() => {
    return filteredPasses.filter(p => !p.aborted);
  }, [filteredPasses]);

  // Performance statistics (excluding aborted passes)
  const performanceStats = useMemo(() => {
    const abortedCount = filteredPasses.filter(p => p.aborted).length;
    
    if (analyticsPasses.length === 0) {
      return {
        totalPasses: filteredPasses.length,
        analyticsPassCount: 0,
        abortedCount,
        bestET: null,
        bestMPH: null,
        avgET: null,
        avgMPH: null,
        avg60ft: null,
        best60ft: null,
        avg330ft: null,
        best330ft: null,
        avgReaction: null,
        bestReaction: null,
        worstReaction: null,
        medianReaction: null,
        reactionStdDev: null,
        consistency: null,
        winRate: null,
        redLightCount: 0,
        perfectLightCount: 0
      };
    }

    const ets = analyticsPasses.map(p => p.eighth).filter(et => et > 0);
    const mphs = analyticsPasses.map(p => p.mph).filter(mph => mph > 0);
    const sixtyFoots = analyticsPasses.map(p => p.sixtyFoot).filter(sf => sf > 0);
    const threeThirtyFoots = analyticsPasses.map(p => p.threeThirty).filter(tt => tt > 0);
    const reactions = analyticsPasses.map(p => p.reactionTime).filter(rt => rt !== undefined && rt !== null);
    const wins = analyticsPasses.filter(p => p.result === 'Win').length;
    const eliminations = analyticsPasses.filter(p => ['Win', 'Loss'].includes(p.result || '')).length;

    // Calculate averages
    const avgET = ets.length > 0 ? ets.reduce((a, b) => a + b, 0) / ets.length : null;
    const avgMPH = mphs.length > 0 ? mphs.reduce((a, b) => a + b, 0) / mphs.length : null;
    const avg60ft = sixtyFoots.length > 0 ? sixtyFoots.reduce((a, b) => a + b, 0) / sixtyFoots.length : null;
    const avg330ft = threeThirtyFoots.length > 0 ? threeThirtyFoots.reduce((a, b) => a + b, 0) / threeThirtyFoots.length : null;
    const avgReaction = reactions.length > 0 ? reactions.reduce((a, b) => a + b, 0) / reactions.length : null;

    // Calculate ET standard deviation for consistency
    const etVariance = avgET !== null && ets.length > 0
      ? ets.reduce((sum, et) => sum + Math.pow(et - avgET, 2), 0) / ets.length
      : 0;
    const stdDev = Math.sqrt(etVariance);

    const sortedReactions = [...reactions].sort((a, b) => a - b);
    const medianReaction = sortedReactions.length > 0 
      ? sortedReactions.length % 2 === 0
        ? (sortedReactions[sortedReactions.length / 2 - 1] + sortedReactions[sortedReactions.length / 2]) / 2
        : sortedReactions[Math.floor(sortedReactions.length / 2)]
      : null;
    
    const reactionVariance = avgReaction !== null && reactions.length > 0
      ? reactions.reduce((sum, rt) => sum + Math.pow(rt - avgReaction, 2), 0) / reactions.length
      : 0;
    const reactionStdDev = Math.sqrt(reactionVariance);

    // Count red lights (negative reaction) and perfect lights (0.000-0.020)
    const redLightCount = reactions.filter(rt => rt < 0).length;
    const perfectLightCount = reactions.filter(rt => rt >= 0 && rt <= 0.020).length;

    return {
      totalPasses: filteredPasses.length,
      analyticsPassCount: analyticsPasses.length,
      abortedCount,
      bestET: ets.length > 0 ? Math.min(...ets) : null,
      bestMPH: mphs.length > 0 ? Math.max(...mphs) : null,
      avgET,
      avgMPH,
      avg60ft,
      best60ft: sixtyFoots.length > 0 ? Math.min(...sixtyFoots) : null,
      avg330ft,
      best330ft: threeThirtyFoots.length > 0 ? Math.min(...threeThirtyFoots) : null,
      avgReaction,
      bestReaction: reactions.length > 0 ? Math.min(...reactions.filter(r => r >= 0)) : null,
      worstReaction: reactions.length > 0 ? Math.max(...reactions) : null,
      medianReaction,
      reactionStdDev: reactionStdDev || null,
      consistency: stdDev || null,
      winRate: eliminations > 0 ? (wins / eliminations) * 100 : null,
      redLightCount,
      perfectLightCount
    };
  }, [filteredPasses, analyticsPasses]);

  // Performance trends data for charts (excluding aborted passes)
  const performanceTrendData = useMemo(() => {
    return analyticsPasses.map((pass, idx) => ({
      passNumber: idx + 1,
      date: pass.date,
      reactionTime: pass.reactionTime || null,
      sixtyFoot: pass.sixtyFoot || null,
      threeThirty: pass.threeThirty || null,
      eighth: pass.eighth || null,
      mph: pass.mph || null,
      sessionType: pass.sessionType,
      track: pass.track
    }));
  }, [analyticsPasses]);

  // Monthly trend data (excluding aborted passes)
  const monthlyTrendData = useMemo(() => {
    const months: Record<string, { 
      passes: number; 
      avgET: number; 
      avgMPH: number; 
      avgReaction: number; 
      reactionCount: number;
      avg60ft: number;
      sixtyCount: number;
      avg330ft: number;
      threeThirtyCount: number;
    }> = {};
    
    analyticsPasses.forEach(pass => {
      const month = pass.date.substring(0, 7);
      if (!months[month]) {
        months[month] = { 
          passes: 0, avgET: 0, avgMPH: 0, avgReaction: 0, reactionCount: 0,
          avg60ft: 0, sixtyCount: 0, avg330ft: 0, threeThirtyCount: 0
        };
      }
      months[month].passes++;
      months[month].avgET += pass.eighth;
      months[month].avgMPH += pass.mph;
      if (pass.reactionTime !== undefined && pass.reactionTime !== null) {
        months[month].avgReaction += pass.reactionTime;
        months[month].reactionCount++;
      }
      if (pass.sixtyFoot > 0) {
        months[month].avg60ft += pass.sixtyFoot;
        months[month].sixtyCount++;
      }
      if (pass.threeThirty > 0) {
        months[month].avg330ft += pass.threeThirty;
        months[month].threeThirtyCount++;
      }
    });

    return Object.entries(months)
      .map(([month, data]) => ({
        month,
        passes: data.passes,
        avgET: data.avgET / data.passes,
        avgMPH: data.avgMPH / data.passes,
        avgReaction: data.reactionCount > 0 ? data.avgReaction / data.reactionCount : null,
        avg60ft: data.sixtyCount > 0 ? data.avg60ft / data.sixtyCount : null,
        avg330ft: data.threeThirtyCount > 0 ? data.avg330ft / data.threeThirtyCount : null
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [analyticsPasses]);

  // Trend analysis (compare recent vs previous period)
  const trendAnalysis = useMemo(() => {
    if (analyticsPasses.length < 4) return null;

    const midpoint = Math.floor(analyticsPasses.length / 2);
    const recentPasses = analyticsPasses.slice(midpoint);
    const previousPasses = analyticsPasses.slice(0, midpoint);

    const recentAvgET = recentPasses.reduce((sum, p) => sum + p.eighth, 0) / recentPasses.length;
    const previousAvgET = previousPasses.reduce((sum, p) => sum + p.eighth, 0) / previousPasses.length;
    const recentAvgMPH = recentPasses.reduce((sum, p) => sum + p.mph, 0) / recentPasses.length;
    const previousAvgMPH = previousPasses.reduce((sum, p) => sum + p.mph, 0) / previousPasses.length;

    // 60' trend
    const recent60fts = recentPasses.filter(p => p.sixtyFoot > 0);
    const previous60fts = previousPasses.filter(p => p.sixtyFoot > 0);
    const recentAvg60ft = recent60fts.length > 0 ? recent60fts.reduce((sum, p) => sum + p.sixtyFoot, 0) / recent60fts.length : null;
    const previousAvg60ft = previous60fts.length > 0 ? previous60fts.reduce((sum, p) => sum + p.sixtyFoot, 0) / previous60fts.length : null;

    // 330' trend
    const recent330fts = recentPasses.filter(p => p.threeThirty > 0);
    const previous330fts = previousPasses.filter(p => p.threeThirty > 0);
    const recentAvg330ft = recent330fts.length > 0 ? recent330fts.reduce((sum, p) => sum + p.threeThirty, 0) / recent330fts.length : null;
    const previousAvg330ft = previous330fts.length > 0 ? previous330fts.reduce((sum, p) => sum + p.threeThirty, 0) / previous330fts.length : null;

    // Reaction trend
    const recentReactions = recentPasses.filter(p => p.reactionTime !== undefined && p.reactionTime !== null);
    const previousReactions = previousPasses.filter(p => p.reactionTime !== undefined && p.reactionTime !== null);
    const recentAvgReaction = recentReactions.length > 0 ? recentReactions.reduce((sum, p) => sum + (p.reactionTime || 0), 0) / recentReactions.length : null;
    const previousAvgReaction = previousReactions.length > 0 ? previousReactions.reduce((sum, p) => sum + (p.reactionTime || 0), 0) / previousReactions.length : null;

    return {
      etTrend: previousAvgET - recentAvgET,
      mphTrend: recentAvgMPH - previousAvgMPH,
      recentAvgET,
      previousAvgET,
      recentAvgMPH,
      previousAvgMPH,
      sixtyTrend: recentAvg60ft && previousAvg60ft ? previousAvg60ft - recentAvg60ft : null,
      recentAvg60ft,
      previousAvg60ft,
      threeThirtyTrend: recentAvg330ft && previousAvg330ft ? previousAvg330ft - recentAvg330ft : null,
      recentAvg330ft,
      previousAvg330ft,
      reactionTrend: recentAvgReaction !== null && previousAvgReaction !== null ? previousAvgReaction - recentAvgReaction : null,
      recentAvgReaction,
      previousAvgReaction
    };
  }, [analyticsPasses]);

  // Track performance
  const trackPerformance = useMemo(() => {
    const tracks: Record<string, { passes: number; bestET: number; bestMPH: number; avgET: number; avgReaction: number; reactionCount: number; avg60ft: number; sixtyCount: number; avg330ft: number; threeThirtyCount: number }> = {};
    
    analyticsPasses.forEach(pass => {
      const track = pass.track || 'Unknown';
      if (!tracks[track]) {
        tracks[track] = { passes: 0, bestET: Infinity, bestMPH: 0, avgET: 0, avgReaction: 0, reactionCount: 0, avg60ft: 0, sixtyCount: 0, avg330ft: 0, threeThirtyCount: 0 };
      }
      tracks[track].passes++;
      tracks[track].bestET = Math.min(tracks[track].bestET, pass.eighth);
      tracks[track].bestMPH = Math.max(tracks[track].bestMPH, pass.mph);
      tracks[track].avgET += pass.eighth;
      if (pass.reactionTime !== undefined && pass.reactionTime !== null) {
        tracks[track].avgReaction += pass.reactionTime;
        tracks[track].reactionCount++;
      }
      if (pass.sixtyFoot > 0) {
        tracks[track].avg60ft += pass.sixtyFoot;
        tracks[track].sixtyCount++;
      }
      if (pass.threeThirty > 0) {
        tracks[track].avg330ft += pass.threeThirty;
        tracks[track].threeThirtyCount++;
      }
    });

    return Object.entries(tracks)
      .map(([track, data]) => ({
        track,
        passes: data.passes,
        bestET: data.bestET === Infinity ? 0 : data.bestET,
        bestMPH: data.bestMPH,
        avgET: data.avgET / data.passes,
        avgReaction: data.reactionCount > 0 ? data.avgReaction / data.reactionCount : null,
        avg60ft: data.sixtyCount > 0 ? data.avg60ft / data.sixtyCount : null,
        avg330ft: data.threeThirtyCount > 0 ? data.avg330ft / data.threeThirtyCount : null
      }))
      .sort((a, b) => b.passes - a.passes)
      .slice(0, 5);
  }, [analyticsPasses]);

  // Session breakdown
  const sessionBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    analyticsPasses.forEach(pass => {
      const type = pass.sessionType || 'Unknown';
      breakdown[type] = (breakdown[type] || 0) + 1;
    });
    return Object.entries(breakdown).map(([type, count]) => ({
      type,
      count,
      percentage: (count / analyticsPasses.length) * 100
    }));
  }, [analyticsPasses]);

  const getTrendIcon = (value: number | null, inverse: boolean = false) => {
    if (value === null || Math.abs(value) < 0.001) return <Minus className="w-4 h-4 text-slate-400" />;
    const isPositive = inverse ? value < 0 : value > 0;
    return isPositive 
      ? <ArrowUp className="w-4 h-4 text-green-400" />
      : <ArrowDown className="w-4 h-4 text-red-400" />;
  };

  const getReactionColor = (reaction: number | null) => {
    if (reaction === null) return 'text-slate-400';
    if (reaction < 0) return 'text-red-500';
    if (reaction <= 0.020) return 'text-green-400';
    if (reaction <= 0.050) return 'text-emerald-400';
    if (reaction <= 0.100) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const exportAnalytics = () => {
    const data = {
      summary: performanceStats,
      trend: trendAnalysis,
      sessionBreakdown,
      trackPerformance,
      monthlyTrend: monthlyTrendData
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(3) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-purple-400" />
              Performance Analytics
            </h2>
            <p className="text-slate-400">Analyze your racing performance data (excludes aborted passes)</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedEngine}
              onChange={(e) => setSelectedEngine(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              <option value="all">All Engines</option>
              {engines.map(engine => (
                <option key={engine.id} value={engine.id}>{engine.name}</option>
              ))}
            </select>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="year">Last Year</option>
              <option value="all">All Time</option>
            </select>
            <button
              onClick={exportAnalytics}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Aborted Pass Notice */}
        {performanceStats.abortedCount > 0 && (
          <div className="mb-6 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-center gap-3">
            <Info className="w-5 h-5 text-orange-400 flex-shrink-0" />
            <p className="text-orange-300 text-sm">
              <strong>{performanceStats.abortedCount} aborted pass{performanceStats.abortedCount > 1 ? 'es' : ''}</strong> excluded from analytics. 
              Total passes: {performanceStats.totalPasses}, Analyzed: {performanceStats.analyticsPassCount}
            </p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'trends', label: 'Performance Trends', icon: LineChartIcon },
            { id: 'bestReaction', label: 'Best Reaction', icon: Zap },
            { id: 'best60', label: "Best 60'", icon: Gauge },
            { id: 'best330', label: "Best 330'", icon: Timer },
            { id: 'avgET', label: 'Average ET', icon: Target },
            { id: 'avgMPH', label: 'Average MPH', icon: TrendingUp },
            { id: 'reaction', label: 'Reaction Time', icon: Clock },
            { id: 'et', label: 'ET Analysis', icon: Timer },
            { id: 'tracks', label: 'Track Stats', icon: Trophy }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>


        {/* Key Metrics - Always Visible */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Activity className="w-4 h-4" />
              Passes Analyzed
            </div>
            <p className="text-2xl font-bold text-white">{performanceStats.analyticsPassCount}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/30">
            <div className="flex items-center gap-2 text-purple-400 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Avg Reaction
            </div>
            <p className={`text-2xl font-bold font-mono ${getReactionColor(performanceStats.avgReaction)}`}>
              {performanceStats.avgReaction?.toFixed(3) || '-'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl p-4 border border-cyan-500/30">
            <div className="flex items-center gap-2 text-cyan-400 text-sm mb-1">
              <Gauge className="w-4 h-4" />
              Avg 60'
            </div>
            <p className="text-2xl font-bold text-cyan-400 font-mono">
              {performanceStats.avg60ft?.toFixed(3) || '-'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-teal-500/20 to-emerald-500/20 rounded-xl p-4 border border-teal-500/30">
            <div className="flex items-center gap-2 text-teal-400 text-sm mb-1">
              <Timer className="w-4 h-4" />
              Avg 330'
            </div>
            <p className="text-2xl font-bold text-teal-400 font-mono">
              {performanceStats.avg330ft?.toFixed(3) || '-'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
            <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
              <Timer className="w-4 h-4" />
              Best ET
            </div>
            <p className="text-2xl font-bold text-green-400 font-mono">
              {performanceStats.bestET?.toFixed(3) || '-'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-4 border border-blue-500/30">
            <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
              <Zap className="w-4 h-4" />
              Best MPH
            </div>
            <p className="text-2xl font-bold text-blue-400 font-mono">
              {performanceStats.bestMPH?.toFixed(1) || '-'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl p-4 border border-yellow-500/30">
            <div className="flex items-center gap-2 text-yellow-400 text-sm mb-1">
              <Trophy className="w-4 h-4" />
              Win Rate
            </div>
            <p className="text-2xl font-bold text-yellow-400">
              {performanceStats.winRate?.toFixed(0) || '-'}%
            </p>
          </div>

          <div className="bg-gradient-to-br from-red-500/20 to-rose-500/20 rounded-xl p-4 border border-red-500/30">
            <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
              <AlertTriangle className="w-4 h-4" />
              Red Lights
            </div>
            <p className="text-2xl font-bold text-red-400">
              {performanceStats.redLightCount}
            </p>
          </div>
        </div>

        {/* Performance Trends Tab */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            {/* Trend Summary Cards */}
            {trendAnalysis && (
              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-purple-400 text-sm">Reaction Time Trend</span>
                    {getTrendIcon(trendAnalysis.reactionTrend, false)}
                  </div>
                  <p className={`text-xl font-bold font-mono ${trendAnalysis.reactionTrend && trendAnalysis.reactionTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trendAnalysis.reactionTrend ? `${trendAnalysis.reactionTrend > 0 ? '-' : '+'}${Math.abs(trendAnalysis.reactionTrend * 1000).toFixed(1)}ms` : '-'}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    {trendAnalysis.previousAvgReaction?.toFixed(3)} → {trendAnalysis.recentAvgReaction?.toFixed(3)}
                  </p>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-cyan-400 text-sm">60' Time Trend</span>
                    {getTrendIcon(trendAnalysis.sixtyTrend, false)}
                  </div>
                  <p className={`text-xl font-bold font-mono ${trendAnalysis.sixtyTrend && trendAnalysis.sixtyTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trendAnalysis.sixtyTrend ? `${trendAnalysis.sixtyTrend > 0 ? '-' : '+'}${Math.abs(trendAnalysis.sixtyTrend * 1000).toFixed(1)}ms` : '-'}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    {trendAnalysis.previousAvg60ft?.toFixed(3)} → {trendAnalysis.recentAvg60ft?.toFixed(3)}
                  </p>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-teal-400 text-sm">330' Time Trend</span>
                    {getTrendIcon(trendAnalysis.threeThirtyTrend, false)}
                  </div>
                  <p className={`text-xl font-bold font-mono ${trendAnalysis.threeThirtyTrend && trendAnalysis.threeThirtyTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trendAnalysis.threeThirtyTrend ? `${trendAnalysis.threeThirtyTrend > 0 ? '-' : '+'}${Math.abs(trendAnalysis.threeThirtyTrend * 1000).toFixed(1)}ms` : '-'}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    {trendAnalysis.previousAvg330ft?.toFixed(3)} → {trendAnalysis.recentAvg330ft?.toFixed(3)}
                  </p>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-400 text-sm">ET Trend</span>
                    {getTrendIcon(trendAnalysis.etTrend, false)}
                  </div>
                  <p className={`text-xl font-bold font-mono ${trendAnalysis.etTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trendAnalysis.etTrend > 0 ? '-' : '+'}{Math.abs(trendAnalysis.etTrend * 1000).toFixed(1)}ms
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    {trendAnalysis.previousAvgET.toFixed(3)} → {trendAnalysis.recentAvgET.toFixed(3)}
                  </p>
                </div>
              </div>
            )}

            {/* Reaction Time Trend Chart */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                Reaction Time Trend
              </h3>
              {performanceTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="passNumber" stroke="#94a3b8" label={{ value: 'Pass #', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#94a3b8" domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(3)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="reactionTime" 
                      stroke="#a855f7" 
                      strokeWidth={2}
                      dot={{ fill: '#a855f7', r: 3 }}
                      name="Reaction Time"
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 text-center py-12">No data available</p>
              )}
            </div>

            {/* 60' and 330' Time Trend Chart */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Timer className="w-5 h-5 text-cyan-400" />
                60' and 330' Time Trends
              </h3>
              {performanceTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="passNumber" stroke="#94a3b8" label={{ value: 'Pass #', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#94a3b8" domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(3)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="sixtyFoot" 
                      stroke="#06b6d4" 
                      strokeWidth={2}
                      dot={{ fill: '#06b6d4', r: 3 }}
                      name="60' Time"
                      connectNulls
                    />
                    <Line 
                      type="monotone" 
                      dataKey="threeThirty" 
                      stroke="#14b8a6" 
                      strokeWidth={2}
                      dot={{ fill: '#14b8a6', r: 3 }}
                      name="330' Time"
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 text-center py-12">No data available</p>
              )}
            </div>

            {/* Monthly Averages Chart */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-400" />
                Monthly Performance Averages
              </h3>
              {monthlyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis yAxisId="left" stroke="#94a3b8" tickFormatter={(v) => v.toFixed(3)} />
                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar yAxisId="right" dataKey="passes" fill="#64748b" name="Passes" opacity={0.3} />
                    <Line yAxisId="left" type="monotone" dataKey="avgReaction" stroke="#a855f7" strokeWidth={2} name="Avg RT" connectNulls />
                    <Line yAxisId="left" type="monotone" dataKey="avg60ft" stroke="#06b6d4" strokeWidth={2} name="Avg 60'" connectNulls />
                    <Line yAxisId="left" type="monotone" dataKey="avg330ft" stroke="#14b8a6" strokeWidth={2} name="Avg 330'" connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 text-center py-12">No data available</p>
              )}
            </div>

            {/* ET and MPH Trend */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                ET and MPH Trends
              </h3>
              {performanceTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={performanceTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="passNumber" stroke="#94a3b8" label={{ value: 'Pass #', position: 'insideBottom', offset: -5 }} />
                    <YAxis yAxisId="left" stroke="#22c55e" domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(2)} />
                    <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" domain={['auto', 'auto']} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="eighth" 
                      stroke="#22c55e" 
                      strokeWidth={2}
                      dot={{ fill: '#22c55e', r: 3 }}
                      name="1/8 ET"
                      connectNulls
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="mph" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 3 }}
                      name="MPH"
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 text-center py-12">No data available</p>
              )}
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Trend Analysis */}
              {trendAnalysis && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    Performance Trend Summary
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">Reaction</span>
                        {getTrendIcon(trendAnalysis.reactionTrend, false)}
                      </div>
                      <p className={`text-lg font-bold font-mono ${trendAnalysis.reactionTrend && trendAnalysis.reactionTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trendAnalysis.reactionTrend ? `${Math.abs(trendAnalysis.reactionTrend * 1000).toFixed(1)}ms` : '-'}
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">60' Time</span>
                        {getTrendIcon(trendAnalysis.sixtyTrend, false)}
                      </div>
                      <p className={`text-lg font-bold font-mono ${trendAnalysis.sixtyTrend && trendAnalysis.sixtyTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trendAnalysis.sixtyTrend ? `${Math.abs(trendAnalysis.sixtyTrend * 1000).toFixed(1)}ms` : '-'}
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">330' Time</span>
                        {getTrendIcon(trendAnalysis.threeThirtyTrend, false)}
                      </div>
                      <p className={`text-lg font-bold font-mono ${trendAnalysis.threeThirtyTrend && trendAnalysis.threeThirtyTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trendAnalysis.threeThirtyTrend ? `${Math.abs(trendAnalysis.threeThirtyTrend * 1000).toFixed(1)}ms` : '-'}
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">ET</span>
                        {getTrendIcon(trendAnalysis.etTrend, false)}
                      </div>
                      <p className={`text-lg font-bold font-mono ${trendAnalysis.etTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {Math.abs(trendAnalysis.etTrend * 1000).toFixed(1)}ms
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Monthly Performance Table */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-400" />
                  Monthly Performance
                </h3>
                {monthlyTrendData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-700/50">
                          <th className="text-left py-2 text-sm font-medium text-slate-400">Month</th>
                          <th className="text-center py-2 text-sm font-medium text-slate-400">Passes</th>
                          <th className="text-center py-2 text-sm font-medium text-slate-400">Avg RT</th>
                          <th className="text-center py-2 text-sm font-medium text-slate-400">Avg 60'</th>
                          <th className="text-center py-2 text-sm font-medium text-slate-400">Avg 330'</th>
                          <th className="text-center py-2 text-sm font-medium text-slate-400">Avg ET</th>
                          <th className="text-center py-2 text-sm font-medium text-slate-400">Avg MPH</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyTrendData.map((month, idx) => (
                          <tr key={idx} className="border-b border-slate-700/30">
                            <td className="py-3 text-white">{month.month}</td>
                            <td className="py-3 text-center text-white">{month.passes}</td>
                            <td className={`py-3 text-center font-mono ${getReactionColor(month.avgReaction)}`}>
                              {month.avgReaction?.toFixed(3) || '-'}
                            </td>
                            <td className="py-3 text-center text-cyan-400 font-mono">{month.avg60ft?.toFixed(3) || '-'}</td>
                            <td className="py-3 text-center text-teal-400 font-mono">{month.avg330ft?.toFixed(3) || '-'}</td>
                            <td className="py-3 text-center text-green-400 font-mono">{month.avgET.toFixed(3)}</td>
                            <td className="py-3 text-center text-blue-400 font-mono">{month.avgMPH.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">No data available</p>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Consistency Score */}
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/30 p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-400" />
                  Consistency Score
                </h3>
                <div className="text-center">
                  <div className="relative w-32 h-32 mx-auto mb-4">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="12" className="text-slate-700" />
                      <circle
                        cx="64" cy="64" r="56" fill="none" stroke="url(#gradient)" strokeWidth="12" strokeLinecap="round"
                        strokeDasharray={`${performanceStats.consistency ? Math.max(0, 100 - performanceStats.consistency * 100) * 3.52 : 0} 352`}
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#a855f7" />
                          <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold text-white">
                        {performanceStats.consistency 
                          ? Math.max(0, 100 - Math.round(performanceStats.consistency * 100)).toFixed(0)
                          : '-'}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm">ET Std Dev: {performanceStats.consistency?.toFixed(4) || '-'}s</p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Performance Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg Reaction</span>
                    <span className={`font-mono ${getReactionColor(performanceStats.avgReaction)}`}>
                      {performanceStats.avgReaction?.toFixed(3) || '-'}s
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best Reaction</span>
                    <span className="text-green-400 font-mono">{performanceStats.bestReaction?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg 60' Time</span>
                    <span className="text-cyan-400 font-mono">{performanceStats.avg60ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best 60' Time</span>
                    <span className="text-green-400 font-mono">{performanceStats.best60ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg 330' Time</span>
                    <span className="text-teal-400 font-mono">{performanceStats.avg330ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best 330' Time</span>
                    <span className="text-green-400 font-mono">{performanceStats.best330ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg ET</span>
                    <span className="text-white font-mono">{performanceStats.avgET?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg MPH</span>
                    <span className="text-white font-mono">{performanceStats.avgMPH?.toFixed(1) || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Perfect Lights</span>
                    <span className="text-emerald-400 font-mono">{performanceStats.perfectLightCount}</span>
                  </div>
                </div>
              </div>

              {/* Session Breakdown */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-blue-400" />
                  Session Breakdown
                </h3>
                {sessionBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {sessionBreakdown.map((session, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-300">{session.type}</span>
                          <span className="text-slate-400">{session.count} ({session.percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                            style={{ width: `${session.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-4">No data available</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reaction Time Tab */}
        {activeTab === 'reaction' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/30">
                  <div className="text-purple-400 text-sm mb-1">Average RT</div>
                  <p className={`text-2xl font-bold font-mono ${getReactionColor(performanceStats.avgReaction)}`}>
                    {performanceStats.avgReaction?.toFixed(3) || '-'}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
                  <div className="text-green-400 text-sm mb-1">Best RT</div>
                  <p className="text-2xl font-bold text-green-400 font-mono">
                    {performanceStats.bestReaction?.toFixed(3) || '-'}
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="text-slate-400 text-sm mb-1">Median RT</div>
                  <p className={`text-2xl font-bold font-mono ${getReactionColor(performanceStats.medianReaction)}`}>
                    {performanceStats.medianReaction?.toFixed(3) || '-'}
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <div className="text-slate-400 text-sm mb-1">RT Std Dev</div>
                  <p className="text-2xl font-bold text-white font-mono">
                    {performanceStats.reactionStdDev?.toFixed(3) || '-'}
                  </p>
                </div>
              </div>

              {/* Reaction Time Chart */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <LineChartIcon className="w-5 h-5 text-purple-400" />
                  Reaction Time Over Time
                </h3>
                {performanceTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={performanceTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="passNumber" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(3)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="reactionTime" 
                        stroke="#a855f7" 
                        fill="#a855f7"
                        fillOpacity={0.2}
                        strokeWidth={2}
                        name="Reaction Time"
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-12">No data available</p>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/30 p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-400" />
                  RT Benchmarks
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded bg-green-500/10 border border-green-500/20">
                    <span className="text-green-400 text-sm">Perfect</span>
                    <span className="text-green-400 font-mono text-sm">0.000 - 0.020</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-emerald-400 text-sm">Excellent</span>
                    <span className="text-emerald-400 font-mono text-sm">0.021 - 0.050</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                    <span className="text-yellow-400 text-sm">Good</span>
                    <span className="text-yellow-400 font-mono text-sm">0.051 - 0.100</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-orange-500/10 border border-orange-500/20">
                    <span className="text-orange-400 text-sm">Slow</span>
                    <span className="text-orange-400 font-mono text-sm">0.101+</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-red-500/10 border border-red-500/20">
                    <span className="text-red-400 text-sm">Red Light</span>
                    <span className="text-red-400 font-mono text-sm">Negative</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">RT Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Perfect Lights</span>
                    <span className="text-green-400 font-mono">{performanceStats.perfectLightCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Red Lights</span>
                    <span className="text-red-400 font-mono">{performanceStats.redLightCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Worst RT</span>
                    <span className="text-orange-400 font-mono">{performanceStats.worstReaction?.toFixed(3) || '-'}s</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ET Analysis Tab */}
        {activeTab === 'et' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <LineChartIcon className="w-5 h-5 text-green-400" />
                  ET Trend Over Time
                </h3>
                {performanceTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={performanceTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="passNumber" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(2)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="eighth" stroke="#22c55e" strokeWidth={2} name="1/8 ET" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-12">No data available</p>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">ET Statistics</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best ET</span>
                    <span className="text-green-400 font-mono">{performanceStats.bestET?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Average ET</span>
                    <span className="text-white font-mono">{performanceStats.avgET?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best 60'</span>
                    <span className="text-cyan-400 font-mono">{performanceStats.best60ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg 60'</span>
                    <span className="text-white font-mono">{performanceStats.avg60ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best 330'</span>
                    <span className="text-teal-400 font-mono">{performanceStats.best330ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg 330'</span>
                    <span className="text-white font-mono">{performanceStats.avg330ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best MPH</span>
                    <span className="text-blue-400 font-mono">{performanceStats.bestMPH?.toFixed(1) || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg MPH</span>
                    <span className="text-white font-mono">{performanceStats.avgMPH?.toFixed(1) || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Consistency</span>
                    <span className="text-white font-mono">{performanceStats.consistency?.toFixed(4) || '-'}s</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Track Stats Tab */}
        {activeTab === 'tracks' && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Track Performance
            </h3>
            {trackPerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left py-2 text-sm font-medium text-slate-400">Track</th>
                      <th className="text-center py-2 text-sm font-medium text-slate-400">Passes</th>
                      <th className="text-center py-2 text-sm font-medium text-slate-400">Avg RT</th>
                      <th className="text-center py-2 text-sm font-medium text-slate-400">Avg 60'</th>
                      <th className="text-center py-2 text-sm font-medium text-slate-400">Avg 330'</th>
                      <th className="text-center py-2 text-sm font-medium text-slate-400">Best ET</th>
                      <th className="text-center py-2 text-sm font-medium text-slate-400">Best MPH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackPerformance.map((track, idx) => (
                      <tr key={idx} className="border-b border-slate-700/30">
                        <td className="py-3 text-white">{track.track}</td>
                        <td className="py-3 text-center text-white">{track.passes}</td>
                        <td className={`py-3 text-center font-mono ${getReactionColor(track.avgReaction)}`}>
                          {track.avgReaction?.toFixed(3) || '-'}
                        </td>
                        <td className="py-3 text-center text-cyan-400 font-mono">{track.avg60ft?.toFixed(3) || '-'}</td>
                        <td className="py-3 text-center text-teal-400 font-mono">{track.avg330ft?.toFixed(3) || '-'}</td>
                        <td className="py-3 text-center text-green-400 font-mono">{track.bestET.toFixed(3)}</td>
                        <td className="py-3 text-center text-blue-400 font-mono">{track.bestMPH.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">No track data available</p>
            )}
          </div>
        )}

        {/* Best Reaction Tab */}
        {activeTab === 'bestReaction' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Hero Card */}
              <div className="bg-gradient-to-br from-purple-600/30 to-pink-600/30 rounded-xl border border-purple-500/50 p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full bg-purple-500/30 flex items-center justify-center">
                    <Zap className="w-8 h-8 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-purple-300">Best Reaction Time</h3>
                    <p className="text-slate-400 text-sm">Your fastest reaction off the line</p>
                  </div>
                </div>
                <p className="text-6xl font-bold text-green-400 font-mono mb-4">
                  {performanceStats.bestReaction?.toFixed(3) || '-'}
                  <span className="text-2xl text-slate-400 ml-2">seconds</span>
                </p>
                {(() => {
                  const bestPass = analyticsPasses.find(p => p.reactionTime === performanceStats.bestReaction);
                  if (bestPass) {
                    return (
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                          <span className="text-slate-400">Date:</span>
                          <span className="text-white ml-2">{bestPass.date}</span>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                          <span className="text-slate-400">Track:</span>
                          <span className="text-white ml-2">{bestPass.track || 'Unknown'}</span>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                          <span className="text-slate-400">Session:</span>
                          <span className="text-white ml-2">{bestPass.sessionType || 'Unknown'}</span>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                          <span className="text-slate-400">ET:</span>
                          <span className="text-green-400 ml-2 font-mono">{bestPass.eighth.toFixed(3)}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Reaction Time Trend Chart */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <LineChartIcon className="w-5 h-5 text-purple-400" />
                  Reaction Time History
                </h3>
                {performanceTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={performanceTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="passNumber" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(3)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="reactionTime" 
                        stroke="#a855f7" 
                        fill="#a855f7"
                        fillOpacity={0.2}
                        strokeWidth={2}
                        name="Reaction Time"
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-12">No data available</p>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* Comparison Stats */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Reaction Comparison</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Best RT</span>
                    <span className="text-green-400 font-mono text-xl">{performanceStats.bestReaction?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Average RT</span>
                    <span className={`font-mono text-xl ${getReactionColor(performanceStats.avgReaction)}`}>
                      {performanceStats.avgReaction?.toFixed(3) || '-'}s
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Median RT</span>
                    <span className={`font-mono text-xl ${getReactionColor(performanceStats.medianReaction)}`}>
                      {performanceStats.medianReaction?.toFixed(3) || '-'}s
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Worst RT</span>
                    <span className="text-orange-400 font-mono text-xl">{performanceStats.worstReaction?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="border-t border-slate-700 pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Gap to Average</span>
                      <span className="text-cyan-400 font-mono">
                        {performanceStats.bestReaction && performanceStats.avgReaction 
                          ? `${((performanceStats.avgReaction - performanceStats.bestReaction) * 1000).toFixed(1)}ms faster`
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Light Stats */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Light Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-green-400">Perfect Lights (0.000-0.020)</span>
                    <span className="text-green-400 font-mono">{performanceStats.perfectLightCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-400">Red Lights</span>
                    <span className="text-red-400 font-mono">{performanceStats.redLightCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">RT Std Dev</span>
                    <span className="text-white font-mono">{performanceStats.reactionStdDev?.toFixed(3) || '-'}s</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Best 60' Tab */}
        {activeTab === 'best60' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Hero Card */}
              <div className="bg-gradient-to-br from-cyan-600/30 to-blue-600/30 rounded-xl border border-cyan-500/50 p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full bg-cyan-500/30 flex items-center justify-center">
                    <Gauge className="w-8 h-8 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-cyan-300">Best 60-Foot Time</h3>
                    <p className="text-slate-400 text-sm">Your quickest launch to 60 feet</p>
                  </div>
                </div>
                <p className="text-6xl font-bold text-green-400 font-mono mb-4">
                  {performanceStats.best60ft?.toFixed(3) || '-'}
                  <span className="text-2xl text-slate-400 ml-2">seconds</span>
                </p>
                {(() => {
                  const bestPass = analyticsPasses.find(p => p.sixtyFoot === performanceStats.best60ft);
                  if (bestPass) {
                    return (
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                          <span className="text-slate-400">Date:</span>
                          <span className="text-white ml-2">{bestPass.date}</span>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                          <span className="text-slate-400">Track:</span>
                          <span className="text-white ml-2">{bestPass.track || 'Unknown'}</span>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                          <span className="text-slate-400">Reaction:</span>
                          <span className="text-purple-400 ml-2 font-mono">{bestPass.reactionTime?.toFixed(3) || '-'}</span>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                          <span className="text-slate-400">ET:</span>
                          <span className="text-green-400 ml-2 font-mono">{bestPass.eighth.toFixed(3)}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* 60' Time Trend Chart */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <LineChartIcon className="w-5 h-5 text-cyan-400" />
                  60-Foot Time History
                </h3>
                {performanceTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={performanceTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="passNumber" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(3)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="sixtyFoot" 
                        stroke="#06b6d4" 
                        fill="#06b6d4"
                        fillOpacity={0.2}
                        strokeWidth={2}
                        name="60' Time"
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-12">No data available</p>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* Comparison Stats */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">60' Comparison</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Best 60'</span>
                    <span className="text-green-400 font-mono text-xl">{performanceStats.best60ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Average 60'</span>
                    <span className="text-cyan-400 font-mono text-xl">{performanceStats.avg60ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="border-t border-slate-700 pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Gap to Average</span>
                      <span className="text-cyan-400 font-mono">
                        {performanceStats.best60ft && performanceStats.avg60ft 
                          ? `${((performanceStats.avg60ft - performanceStats.best60ft) * 1000).toFixed(1)}ms faster`
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Related Stats */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Related Performance</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best 330'</span>
                    <span className="text-teal-400 font-mono">{performanceStats.best330ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best ET</span>
                    <span className="text-green-400 font-mono">{performanceStats.bestET?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best MPH</span>
                    <span className="text-blue-400 font-mono">{performanceStats.bestMPH?.toFixed(1) || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Trend Info */}
              {trendAnalysis && trendAnalysis.sixtyTrend !== null && (
                <div className={`rounded-xl border p-5 ${trendAnalysis.sixtyTrend > 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <h3 className="text-lg font-semibold text-white mb-2">60' Trend</h3>
                  <p className={`text-2xl font-bold font-mono ${trendAnalysis.sixtyTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trendAnalysis.sixtyTrend > 0 ? 'Improving' : 'Declining'}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    {Math.abs(trendAnalysis.sixtyTrend * 1000).toFixed(1)}ms {trendAnalysis.sixtyTrend > 0 ? 'faster' : 'slower'} recently
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Best 330' Tab */}
        {activeTab === 'best330' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Hero Card */}
              <div className="bg-gradient-to-br from-teal-600/30 to-emerald-600/30 rounded-xl border border-teal-500/50 p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full bg-teal-500/30 flex items-center justify-center">
                    <Timer className="w-8 h-8 text-teal-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-teal-300">Best 330-Foot Time</h3>
                    <p className="text-slate-400 text-sm">Your quickest time to 330 feet</p>
                  </div>
                </div>
                <p className="text-6xl font-bold text-green-400 font-mono mb-4">
                  {performanceStats.best330ft?.toFixed(3) || '-'}
                  <span className="text-2xl text-slate-400 ml-2">seconds</span>
                </p>
                {(() => {
                  const bestPass = analyticsPasses.find(p => p.threeThirty === performanceStats.best330ft);
                  if (bestPass) {
                    return (
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                          <span className="text-slate-400">Date:</span>
                          <span className="text-white ml-2">{bestPass.date}</span>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                          <span className="text-slate-400">Track:</span>
                          <span className="text-white ml-2">{bestPass.track || 'Unknown'}</span>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                          <span className="text-slate-400">60':</span>
                          <span className="text-cyan-400 ml-2 font-mono">{bestPass.sixtyFoot?.toFixed(3) || '-'}</span>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                          <span className="text-slate-400">ET:</span>
                          <span className="text-green-400 ml-2 font-mono">{bestPass.eighth.toFixed(3)}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* 330' Time Trend Chart */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <LineChartIcon className="w-5 h-5 text-teal-400" />
                  330-Foot Time History
                </h3>
                {performanceTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={performanceTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="passNumber" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(3)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="threeThirty" 
                        stroke="#14b8a6" 
                        fill="#14b8a6"
                        fillOpacity={0.2}
                        strokeWidth={2}
                        name="330' Time"
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-12">No data available</p>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* Comparison Stats */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">330' Comparison</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Best 330'</span>
                    <span className="text-green-400 font-mono text-xl">{performanceStats.best330ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Average 330'</span>
                    <span className="text-teal-400 font-mono text-xl">{performanceStats.avg330ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="border-t border-slate-700 pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Gap to Average</span>
                      <span className="text-teal-400 font-mono">
                        {performanceStats.best330ft && performanceStats.avg330ft 
                          ? `${((performanceStats.avg330ft - performanceStats.best330ft) * 1000).toFixed(1)}ms faster`
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Related Stats */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Related Performance</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best 60'</span>
                    <span className="text-cyan-400 font-mono">{performanceStats.best60ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best ET</span>
                    <span className="text-green-400 font-mono">{performanceStats.bestET?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Best MPH</span>
                    <span className="text-blue-400 font-mono">{performanceStats.bestMPH?.toFixed(1) || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Trend Info */}
              {trendAnalysis && trendAnalysis.threeThirtyTrend !== null && (
                <div className={`rounded-xl border p-5 ${trendAnalysis.threeThirtyTrend > 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <h3 className="text-lg font-semibold text-white mb-2">330' Trend</h3>
                  <p className={`text-2xl font-bold font-mono ${trendAnalysis.threeThirtyTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trendAnalysis.threeThirtyTrend > 0 ? 'Improving' : 'Declining'}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    {Math.abs(trendAnalysis.threeThirtyTrend * 1000).toFixed(1)}ms {trendAnalysis.threeThirtyTrend > 0 ? 'faster' : 'slower'} recently
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Average ET Tab */}
        {activeTab === 'avgET' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Hero Card */}
              <div className="bg-gradient-to-br from-green-600/30 to-emerald-600/30 rounded-xl border border-green-500/50 p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/30 flex items-center justify-center">
                    <Target className="w-8 h-8 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-green-300">Average Elapsed Time</h3>
                    <p className="text-slate-400 text-sm">Your typical 1/8 mile ET</p>
                  </div>
                </div>
                <p className="text-6xl font-bold text-green-400 font-mono mb-4">
                  {performanceStats.avgET?.toFixed(3) || '-'}
                  <span className="text-2xl text-slate-400 ml-2">seconds</span>
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                    <span className="text-slate-400">Passes Analyzed:</span>
                    <span className="text-white ml-2">{performanceStats.analyticsPassCount}</span>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                    <span className="text-slate-400">Best ET:</span>
                    <span className="text-green-400 ml-2 font-mono">{performanceStats.bestET?.toFixed(3) || '-'}</span>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                    <span className="text-slate-400">Consistency:</span>
                    <span className="text-purple-400 ml-2 font-mono">{performanceStats.consistency?.toFixed(4) || '-'}s</span>
                  </div>
                </div>
              </div>

              {/* ET Trend Chart */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <LineChartIcon className="w-5 h-5 text-green-400" />
                  ET History
                </h3>
                {performanceTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={performanceTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="passNumber" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(2)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="eighth" 
                        stroke="#22c55e" 
                        fill="#22c55e"
                        fillOpacity={0.2}
                        strokeWidth={2}
                        name="1/8 ET"
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-12">No data available</p>
                )}
              </div>

              {/* Monthly ET Averages */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-400" />
                  Monthly ET Averages
                </h3>
                {monthlyTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={monthlyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" domain={['auto', 'auto']} tickFormatter={(v) => v.toFixed(2)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="avgET" fill="#22c55e" name="Avg ET" opacity={0.7} />
                      <Line type="monotone" dataKey="avgET" stroke="#16a34a" strokeWidth={2} name="Trend" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-12">No data available</p>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* ET Stats */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">ET Statistics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Average ET</span>
                    <span className="text-green-400 font-mono text-xl">{performanceStats.avgET?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Best ET</span>
                    <span className="text-emerald-400 font-mono text-xl">{performanceStats.bestET?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Consistency (Std Dev)</span>
                    <span className="text-purple-400 font-mono text-xl">{performanceStats.consistency?.toFixed(4) || '-'}s</span>
                  </div>
                  <div className="border-t border-slate-700 pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Gap to Best</span>
                      <span className="text-cyan-400 font-mono">
                        {performanceStats.avgET && performanceStats.bestET 
                          ? `${((performanceStats.avgET - performanceStats.bestET) * 1000).toFixed(1)}ms`
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trend Info */}
              {trendAnalysis && (
                <div className={`rounded-xl border p-5 ${trendAnalysis.etTrend > 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <h3 className="text-lg font-semibold text-white mb-2">ET Trend</h3>
                  <p className={`text-2xl font-bold font-mono ${trendAnalysis.etTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trendAnalysis.etTrend > 0 ? 'Improving' : 'Declining'}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    {Math.abs(trendAnalysis.etTrend * 1000).toFixed(1)}ms {trendAnalysis.etTrend > 0 ? 'faster' : 'slower'} recently
                  </p>
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <p className="text-slate-400 text-xs">
                      Previous avg: {trendAnalysis.previousAvgET.toFixed(3)}s → Recent avg: {trendAnalysis.recentAvgET.toFixed(3)}s
                    </p>
                  </div>
                </div>
              )}

              {/* Related Averages */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Related Averages</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg 60'</span>
                    <span className="text-cyan-400 font-mono">{performanceStats.avg60ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg 330'</span>
                    <span className="text-teal-400 font-mono">{performanceStats.avg330ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg MPH</span>
                    <span className="text-blue-400 font-mono">{performanceStats.avgMPH?.toFixed(1) || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg Reaction</span>
                    <span className={`font-mono ${getReactionColor(performanceStats.avgReaction)}`}>
                      {performanceStats.avgReaction?.toFixed(3) || '-'}s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Average MPH Tab */}
        {activeTab === 'avgMPH' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Hero Card */}
              <div className="bg-gradient-to-br from-blue-600/30 to-indigo-600/30 rounded-xl border border-blue-500/50 p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full bg-blue-500/30 flex items-center justify-center">
                    <TrendingUp className="w-8 h-8 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-blue-300">Average Speed</h3>
                    <p className="text-slate-400 text-sm">Your typical trap speed at the finish</p>
                  </div>
                </div>
                <p className="text-6xl font-bold text-blue-400 font-mono mb-4">
                  {performanceStats.avgMPH?.toFixed(1) || '-'}
                  <span className="text-2xl text-slate-400 ml-2">MPH</span>
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                    <span className="text-slate-400">Passes Analyzed:</span>
                    <span className="text-white ml-2">{performanceStats.analyticsPassCount}</span>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                    <span className="text-slate-400">Best MPH:</span>
                    <span className="text-blue-400 ml-2 font-mono">{performanceStats.bestMPH?.toFixed(1) || '-'}</span>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                    <span className="text-slate-400">Best ET:</span>
                    <span className="text-green-400 ml-2 font-mono">{performanceStats.bestET?.toFixed(3) || '-'}</span>
                  </div>
                </div>
              </div>

              {/* MPH Trend Chart */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <LineChartIcon className="w-5 h-5 text-blue-400" />
                  MPH History
                </h3>
                {performanceTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={performanceTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="passNumber" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" domain={['auto', 'auto']} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="mph" 
                        stroke="#3b82f6" 
                        fill="#3b82f6"
                        fillOpacity={0.2}
                        strokeWidth={2}
                        name="MPH"
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-12">No data available</p>
                )}
              </div>

              {/* Monthly MPH Averages */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-400" />
                  Monthly MPH Averages
                </h3>
                {monthlyTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={monthlyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" domain={['auto', 'auto']} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="avgMPH" fill="#3b82f6" name="Avg MPH" opacity={0.7} />
                      <Line type="monotone" dataKey="avgMPH" stroke="#1d4ed8" strokeWidth={2} name="Trend" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-400 text-center py-12">No data available</p>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* MPH Stats */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">MPH Statistics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Average MPH</span>
                    <span className="text-blue-400 font-mono text-xl">{performanceStats.avgMPH?.toFixed(1) || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Best MPH</span>
                    <span className="text-green-400 font-mono text-xl">{performanceStats.bestMPH?.toFixed(1) || '-'}</span>
                  </div>
                  <div className="border-t border-slate-700 pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Gap to Best</span>
                      <span className="text-cyan-400 font-mono">
                        {performanceStats.avgMPH && performanceStats.bestMPH 
                          ? `${(performanceStats.bestMPH - performanceStats.avgMPH).toFixed(1)} MPH`
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trend Info */}
              {trendAnalysis && (
                <div className={`rounded-xl border p-5 ${trendAnalysis.mphTrend > 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <h3 className="text-lg font-semibold text-white mb-2">MPH Trend</h3>
                  <p className={`text-2xl font-bold font-mono ${trendAnalysis.mphTrend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trendAnalysis.mphTrend > 0 ? 'Increasing' : 'Decreasing'}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    {Math.abs(trendAnalysis.mphTrend).toFixed(1)} MPH {trendAnalysis.mphTrend > 0 ? 'faster' : 'slower'} recently
                  </p>
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <p className="text-slate-400 text-xs">
                      Previous avg: {trendAnalysis.previousAvgMPH.toFixed(1)} → Recent avg: {trendAnalysis.recentAvgMPH.toFixed(1)}
                    </p>
                  </div>
                </div>
              )}

              {/* Related Performance */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Related Performance</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg ET</span>
                    <span className="text-green-400 font-mono">{performanceStats.avgET?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg 60'</span>
                    <span className="text-cyan-400 font-mono">{performanceStats.avg60ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg 330'</span>
                    <span className="text-teal-400 font-mono">{performanceStats.avg330ft?.toFixed(3) || '-'}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg Reaction</span>
                    <span className={`font-mono ${getReactionColor(performanceStats.avgReaction)}`}>
                      {performanceStats.avgReaction?.toFixed(3) || '-'}s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </section>
  );
};

export default AnalyticsDashboard;
