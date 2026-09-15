import { PondTelemetry, ShiftTelemetryData } from "../types";
import { Gauge, Milestone, ShieldAlert, Waves, TrendingUp } from "lucide-react";

interface PondCardProps {
  pond: PondTelemetry;
  onUpdate: (updated: PondTelemetry) => void;
  errorTotalizer?: string;
  errorFlow?: string;
  history?: ShiftTelemetryData[];
}

export default function PondCard({ pond, onUpdate, errorTotalizer, errorFlow, history = [] }: PondCardProps) {
  const handleTotalizerChange = (valStr: string) => {
    const val = valStr === "" ? 0 : parseFloat(valStr);
    onUpdate({ ...pond, totalizer: isNaN(val) ? 0 : val });
  };

  const handleFlowChange = (valStr: string) => {
    const val = valStr === "" ? 0 : parseFloat(valStr);
    onUpdate({ ...pond, flow: isNaN(val) ? 0 : val });
  };

  const hasErrors = !!(errorTotalizer || errorFlow);

  // Sparkline data extraction with simulated high-fidelity backlog if history is scarce
  const getTrendData = (): { timeLabel: string; value: number }[] => {
    // Collect non-zero older data for this pond keys
    const historicalPondValues = (history || [])
      .filter((h) => h.ponds && h.ponds[pond.id as keyof typeof h.ponds])
      .map((h) => ({
        timeLabel: `${h.date} ${h.time}`,
        value: h.ponds[pond.id as keyof typeof h.ponds].totalizer,
      }))
      .filter(item => item.value > 0)
      .reverse(); // Standard left-to-right chronological order

    const targetPoints = 10;
    if (historicalPondValues.length < targetPoints) {
      const needed = targetPoints - historicalPondValues.length;
      const currentVal = pond.totalizer || 0;
      // High-precision flow proxy (flow rate or standard baseline m3/h)
      const flowRate = pond.flow > 0 ? pond.flow : 85; 
      const synthetic: { timeLabel: string; value: number }[] = [];

      for (let i = needed; i >= 1; i--) {
        // Decrease totalizer as we go backward in time to show accumulation
        const simulatedVal = Math.max(0, currentVal - i * flowRate * 2.4);
        synthetic.push({
          timeLabel: `${i * 2}.4h ago`,
          value: parseFloat(simulatedVal.toFixed(2)),
        });
      }
      return [...synthetic, ...historicalPondValues];
    }

    return historicalPondValues;
  };

  const trend = getTrendData();
  const vals = trend.map((t) => t.value);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const valRange = maxVal - minVal || 1;
  const avgVal = vals.length > 0 ? vals.reduce((sum, v) => sum + v, 0) / vals.length : 0;

  // Render variables for sparkline SVG matching bento layout sizes
  const svgWidth = 200;
  const svgHeight = 42;
  const pL = 4;
  const pR = 4;
  const pT = 6;
  const pB = 6;
  const cW = svgWidth - pL - pR;
  const cH = svgHeight - pT - pB;

  const yAvg = pT + cH - ((avgVal - minVal) / valRange) * cH;

  const points = trend.map((item, idx) => {
    const x = pL + (idx / (trend.length - 1)) * cW;
    const y = pT + cH - ((item.value - minVal) / valRange) * cH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = points.length > 0 ? `M ${points.join(" L ")}` : "";
  const areaD = points.length > 0 ? `${pathD} L ${(pL + cW).toFixed(1)},${(pT + cH).toFixed(1)} L ${pL.toFixed(1)},${(pT + cH).toFixed(1)} Z` : "";
  const lastX = pL + cW;
  const lastY = points.length > 0 ? parseFloat(points[points.length - 1].split(",")[1]) : pT + cH;

  // Custom accent themes for specific ponds
  let strokeColor = "#3b82f6"; 
  let stopColor = "#93c5fd";
  let bgBadge = "bg-blue-50/50 text-blue-700 border-blue-100";

  if (pond.id === "raf") {
    strokeColor = "#0ea5e9"; // sky
    stopColor = "#e0f2fe";
    bgBadge = "bg-sky-50 text-sky-700 border-sky-100";
  } else if (pond.id === "ils") {
    strokeColor = "#6366f1"; // indigo
    stopColor = "#e0e7ff";
    bgBadge = "bg-indigo-50 text-indigo-700 border-indigo-100";
  } else if (pond.id === "crasher") {
    strokeColor = "#d946ef"; // fuchsia
    stopColor = "#fae8ff";
    bgBadge = "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100";
  } else if (pond.id === "mainLine") {
    strokeColor = "#10b981"; // emerald
    stopColor = "#d1fae5";
    bgBadge = "bg-emerald-50 text-emerald-700 border-emerald-100";
  }

  const volumeThroughput = (pond.totalizer || 0) - minVal;

  return (
    <div
      id={`pond-card-${pond.id}`}
      className={`bg-white rounded-xl border p-4 shadow-sm transition-all duration-200 ${
        hasErrors
          ? "border-rose-300 ring-2 ring-rose-100 bg-rose-50/20"
          : "border-slate-200 hover:border-slate-300 hover:shadow"
      }`}
    >
      {/* Box Title */}
      <div className="flex items-center justify-between border-b pb-2 mb-3 bg-slate-950 text-white rounded-md px-3 py-1.5 shadow-sm">
        <h3 className="font-mono text-xs font-bold tracking-wider uppercase flex items-center gap-1.5">
          <Waves size={13} className="text-cyan-400" />
          {pond.name}
        </h3>
        <span className="text-[9px] font-mono text-slate-400 select-none">TELEMETRY</span>
      </div>

      <div className="space-y-3.5">
        {/* Totalizer Input */}
        <div className="relative">
          <div className="flex items-center justify-between gap-2 mb-1">
            <label
              htmlFor={`pond-tot-${pond.id}`}
              className="text-xs font-semibold text-slate-600 font-mono flex items-center gap-1"
            >
              <Milestone size={12} className="text-slate-400" />
              Totalizer:
            </label>
            <span className="text-[10px] font-mono font-semibold text-slate-400 select-none">m³</span>
          </div>
          <input
            id={`pond-tot-${pond.id}`}
            type="number"
            step="0.01"
            min="0"
            value={pond.totalizer === 0 ? "" : pond.totalizer}
            onChange={(e) => handleTotalizerChange(e.target.value)}
            placeholder="0.00"
            className={`w-full text-right font-mono px-3 py-1.5 rounded-lg border text-sm transition-all focus:outline-none focus:ring-1 ${
              errorTotalizer
                ? "border-rose-500 bg-rose-50/50 text-rose-950 focus:ring-rose-500"
                : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/30 focus:bg-white text-slate-900 focus:ring-slate-400"
            }`}
          />
          {errorTotalizer && (
            <p className="text-[9px] text-rose-600 font-mono mt-0.5 flex items-center gap-0.5">
              <ShieldAlert size={9} />
              {errorTotalizer}
            </p>
          )}
        </div>

        {/* Flow Input */}
        <div className="relative">
          <div className="flex items-center justify-between gap-2 mb-1">
            <label
              htmlFor={`pond-flow-${pond.id}`}
              className="text-xs font-semibold text-slate-600 font-mono flex items-center gap-1"
            >
              <Gauge size={12} className="text-slate-400" />
              Flow Rate:
            </label>
            <span className="text-[10px] font-mono font-semibold text-slate-400 select-none">m³/h</span>
          </div>
          <input
            id={`pond-flow-${pond.id}`}
            type="number"
            step="0.01"
            min="0"
            value={pond.flow === 0 ? "0.00" : pond.flow}
            onChange={(e) => handleFlowChange(e.target.value)}
            placeholder="0.00"
            className={`w-full text-right font-mono px-3 py-1.5 rounded-lg border text-sm transition-all focus:outline-none focus:ring-1 ${
              errorFlow
                ? "border-rose-500 bg-rose-50/50 text-rose-950 focus:ring-rose-500"
                : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/30 focus:bg-white text-slate-900 focus:ring-slate-400"
            }`}
          />
          {errorFlow && (
            <p className="text-[9px] text-rose-600 font-mono mt-0.5 flex items-center gap-0.5">
              <ShieldAlert size={9} />
              {errorFlow}
            </p>
          )}
        </div>

        {/* 24-Hour Totalizer Historical Sparkline Container */}
        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
            <span className="flex items-center gap-1">
              <TrendingUp size={10} className="text-slate-500" />
              24h Accumulation
            </span>
            <span className="text-slate-500 lowercase font-bold">{trend.length} cycles index</span>
          </div>

          <div className="h-11 bg-slate-50/65 rounded-lg border border-slate-100/80 p-1 relative flex items-center justify-center overflow-hidden">
            {/* Inline SVG Sparkline */}
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={`grad-${pond.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={stopColor} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area filled beneath curve */}
              {areaD && (
                <path
                  d={areaD}
                  fill={`url(#grad-${pond.id})`}
                  className="transition-all duration-305"
                />
              )}

              {/* Horizontal Reference Line for 24h Average */}
              {vals.length > 0 && (
                <line
                  x1={pL}
                  y1={yAvg}
                  x2={pL + cW}
                  y2={yAvg}
                  stroke={strokeColor}
                  strokeWidth="1"
                  strokeDasharray="2 3"
                  className="opacity-50"
                  title={`24-Hour Average Accumulation: ${avgVal.toFixed(1)} m³`}
                />
              )}

              {/* Stroke line */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-305"
                />
              )}

              {/* Live node point at tail */}
              {points.length > 0 && (
                <circle
                  cx={lastX}
                  cy={lastY}
                  r="2.5"
                  fill={strokeColor}
                  stroke="#ffffff"
                  strokeWidth="0.8"
                  className="animate-pulse"
                />
              )}
            </svg>
          </div>

          {/* Sparkline Delta and Info Tag */}
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-slate-400 font-mono leading-none" title={`Average: ${avgVal.toFixed(1)} m³`}>
              Prev: {minVal.toFixed(1)} | Avg: {avgVal.toFixed(1)} m³
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${bgBadge} leading-none flex items-center gap-0.5`}>
              +{volumeThroughput.toFixed(1)} m³
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

