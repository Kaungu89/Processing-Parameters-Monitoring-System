import React, { useEffect, useRef, useState, useMemo } from "react";
import { 
  TrendingUp, 
  Info, 
  Filter, 
  FileSpreadsheet, 
  Layers, 
  Edit3, 
  RotateCcw, 
  AlertTriangle,
  CheckCircle2,
  ListFilter
} from "lucide-react";

// Standard normal operation bounds for our metallurgical pH settings
export const PH_SAFE_LIMITS = {
  raf: { min: 1.2, max: 1.8, label: "RAF Target (typical 1.2 - 1.8)" },
  ils: { min: 1.8, max: 2.4, label: "ILS Target (typical 1.8 - 2.4)" },
  crasher: { min: 2.2, max: 3.2, label: "Crasher Target (typical 2.2 - 3.2)" }
};

interface pHPoint {
  dateStr: string;
  raf: number;
  ils: number;
  crasher: number;
}

export default function PHTrendChart() {
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Tab states: compare vs manual input overrides
  const [activeTab, setActiveTab] = useState<"compare" | "entry">("compare");
  const [selectedEntryPond, setSelectedEntryPond] = useState<"raf" | "ils" | "crasher">("raf");
  
  // Toggles for active visible series
  const [visiblePonds, setVisiblePonds] = useState<Record<string, boolean>>({
    raf: true,
    ils: true,
    crasher: true,
  });

  // State to track exact cursor snapshot coordinate
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Hardcoded real/simulated 7-day pH measurements with manual override capability
  const [manualpHOverrides, setManualpHOverrides] = useState<Record<string, number[]>>({});

  // Generate 7-day date labels
  const datesList = useMemo(() => {
    const list: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      list.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    }
    return list;
  }, []);

  // Default baselines representing normal metallurgical operations
  const defaultValues = useMemo<Record<string, number[]>>(() => ({
    raf: [1.35, 1.42, 1.39, 1.48, 1.55, 1.40, 1.38],
    ils: [2.05, 1.98, 2.12, 2.20, 2.08, 1.95, 2.15],
    crasher: [2.45, 2.60, 2.58, 2.75, 2.82, 2.90, 2.65]
  }), []);

  // Dynamic values resolved by blending defaults with local overrides
  const trendPoints = useMemo<pHPoint[]>(() => {
    return datesList.map((dateStr, idx) => {
      const rafVal = manualpHOverrides.raf?.[idx] !== undefined ? manualpHOverrides.raf[idx] : defaultValues.raf[idx];
      const ilsVal = manualpHOverrides.ils?.[idx] !== undefined ? manualpHOverrides.ils[idx] : defaultValues.ils[idx];
      const crasherVal = manualpHOverrides.crasher?.[idx] !== undefined ? manualpHOverrides.crasher[idx] : defaultValues.crasher[idx];
      return {
        dateStr,
        raf: rafVal,
        ils: ilsVal,
        crasher: crasherVal
      };
    });
  }, [datesList, manualpHOverrides, defaultValues]);

  // Export current simulated trend spreadsheet as CSV
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Mimbula Acid Circuit - 7-Day Historical pH Logs\r\n";
    csvContent += "Generated On," + new Date().toISOString() + "\r\n\r\n";
    
    // Header
    csvContent += "Date,RAF Pond pH,ILS Pond pH,Crasher pH\r\n";
    
    trendPoints.forEach(pt => {
      csvContent += `${pt.dateStr},${pt.raf.toFixed(2)},${pt.ils.toFixed(2)},${pt.crasher.toFixed(2)}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Mimbula_Circuit_Historical_pH_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dimensions of the coordinate SVG viewport
  const width = 800;
  const height = 280;
  const margin = { top: 30, right: 40, bottom: 40, left: 55 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // pH bounds for high quality rendering (usually maps between pH 1.0 to pH 4.0)
  const yMin = 1.0;
  const yMax = 4.0;

  // Mapping coordinate helper: X coordinate
  const getX = (idx: number) => {
    return margin.left + (idx / (datesList.length - 1)) * chartWidth;
  };

  // Mapping coordinate helper: Y coordinate for a given pH value
  const getY = (val: number) => {
    const clampedVal = Math.min(yMax, Math.max(yMin, val));
    return margin.top + chartHeight - ((clampedVal - yMin) / (yMax - yMin)) * chartHeight;
  };

  // Generate continuous SVG spline strings using simple bezier control points
  const generatePathLine = (pondId: "raf" | "ils" | "crasher") => {
    const coords = trendPoints.map((pt, idx) => ({ x: getX(idx), y: getY(pt[pondId]) }));
    if (coords.length === 0) return "";
    
    let path = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 3;
      const cpY1 = p0.y;
      const cpX2 = p0.x + 2 * (p1.x - p0.x) / 3;
      const cpY2 = p1.y;
      path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  const getPondColor = (id: string, opacity = 1) => {
    if (id === "raf") return `rgba(20, 184, 166, ${opacity})`;   // Teal-500
    if (id === "ils") return `rgba(99, 102, 241, ${opacity})`;   // Indigo-500
    return `rgba(239, 68, 68, ${opacity})`;                        // Red-500
  };

  const getPondLabel = (id: string) => {
    if (id === "raf") return "RAF Pond";
    if (id === "ils") return "ILS Pond";
    return "Acid to Crasher";
  };

  // Validate current pH values to trigger alerts
  const getAcidityWarnings = () => {
    const warnings: string[] = [];
    const latest = trendPoints[trendPoints.length - 1];
    
    if (visiblePonds.raf) {
      if (latest.raf < PH_SAFE_LIMITS.raf.min) {
        warnings.push(`RAF Pond extremely corrosive (pH ${latest.raf.toFixed(2)} < ${PH_SAFE_LIMITS.raf.min}). Increased pipe wear risk!`);
      } else if (latest.raf > PH_SAFE_LIMITS.raf.max) {
        warnings.push(`RAF Pond acidity level too low (pH ${latest.raf.toFixed(2)} > ${PH_SAFE_LIMITS.raf.max}). May hamper heap leaching efficiency.`);
      }
    }
    if (visiblePonds.ils) {
      if (latest.ils < PH_SAFE_LIMITS.ils.min) {
        warnings.push(`ILS Pond pH is abnormally acidic (pH ${latest.ils.toFixed(2)} < ${PH_SAFE_LIMITS.ils.min}). Check bypass values!`);
      } else if (latest.ils > PH_SAFE_LIMITS.ils.max) {
        warnings.push(`ILS Pond pH is elevated (pH ${latest.ils.toFixed(2)} > ${PH_SAFE_LIMITS.ils.max}). Copper recovery throughput might decline.`);
      }
    }
    if (visiblePonds.crasher) {
      if (latest.crasher < PH_SAFE_LIMITS.crasher.min) {
        warnings.push(`Crasher bypass pH is too high/low (pH ${latest.crasher.toFixed(2)}). Check inline dosing valve calibration.`);
      }
    }
    return warnings;
  };

  const currentAcidityWarnings = getAcidityWarnings();

  // Handle cursor hover events on the SVG rect overlay
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xCoordsMatrix = datesList.map((_, idx) => getX(idx));
    const mx = ((e.clientX - rect.left) / rect.width) * width;
    
    let closestIdx = 0;
    let minDiff = Infinity;
    xCoordsMatrix.forEach((px, idx) => {
      const diff = Math.abs(px - mx);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    setHoveredIdx(closestIdx);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      {/* Title & Operations bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-3.5 gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className="font-sans font-semibold text-slate-800 text-sm">Historical Acidity & pH Trends</h3>
            <p className="text-xs text-slate-400 font-mono">Continuous 7-Day Metallurgical Buffer Tracking</p>
          </div>
        </div>

        {/* Action controllers */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold font-mono">
          <span className="flex items-center gap-1 text-slate-400 font-semibold mr-1">
            <Filter size={11} /> SHORTCUTS:
          </span>
          <button
            type="button"
            onClick={() => setVisiblePonds({ raf: true, ils: true, crasher: true })}
            className="px-2 py-1 bg-slate-100/80 hover:bg-slate-200/80 rounded transition active:scale-95 cursor-pointer border border-slate-200 text-slate-600"
          >
            Show All
          </button>
          
          <button
            type="button"
            onClick={() => setVisiblePonds({ raf: true, ils: false, crasher: false })}
            className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded transition active:scale-95 cursor-pointer border border-teal-200"
          >
            RAF Only
          </button>
          
          <button
            type="button"
            onClick={() => setVisiblePonds({ raf: false, ils: true, crasher: false })}
            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded transition active:scale-95 cursor-pointer border border-indigo-200"
          >
            ILS Only
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="p-1 px-2.5 bg-slate-150 hover:bg-slate-200 rounded text-slate-705 transition-all flex items-center gap-1 cursor-pointer border border-slate-200 shadow-sm"
            title="Download historical pH trends logs as CSV format"
          >
            <FileSpreadsheet size={11} className="text-slate-605" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* SVG Multi-Series Plot Block */}
        <div className="lg:col-span-8 space-y-3">
          <div className="relative border border-slate-100 bg-slate-50/20 rounded-xl overflow-x-auto p-2">
            <svg
              ref={svgRef}
              id="ph-historical-trend-svg"
              className="min-w-[650px] h-auto select-none"
              viewBox={`0 0 ${width} ${height}`}
              width="100%"
              height={height}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Horizontal pH Reference Guidelines Grid */}
              {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0].map((level, i) => {
                const y = getY(level);
                return (
                  <g key={i} className="opacity-25">
                    <line
                      x1={margin.left}
                      y1={y}
                      x2={width - margin.right}
                      y2={y}
                      stroke="#475569"
                      strokeWidth="0.8"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={margin.left - 10}
                      y={y + 3}
                      textAnchor="end"
                      className="font-mono text-[9px] font-bold fill-slate-500"
                    >
                      {level.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* High-Contrast Target Acid Threshold Zone band overlays */}
              <rect
                x={margin.left}
                y={getY(1.8)}
                width={chartWidth}
                height={getY(1.2) - getY(1.8)}
                fill="url(#targetZoneRaf)"
                opacity="0.04"
                pointerEvents="none"
              />
              <rect
                x={margin.left}
                y={getY(2.4)}
                width={chartWidth}
                height={getY(1.8) - getY(2.4)}
                fill="url(#targetZoneIls)"
                opacity="0.04"
                pointerEvents="none"
              />

              {/* Critical pH Limit Lines (1.5 and 2.5) */}
              {[1.5, 2.5].map((criticalLevel) => {
                const y = getY(criticalLevel);
                return (
                  <g key={`critical-limit-${criticalLevel}`}>
                    <line
                      x1={margin.left}
                      y1={y}
                      x2={width - margin.right}
                      y2={y}
                      stroke="#f43f5e"
                      strokeWidth="1.5"
                      strokeDasharray="5 3"
                    />
                    {/* Background badge for readability */}
                    <rect
                      x={width - margin.right - 145}
                      y={y - 8}
                      width="140"
                      height="15"
                      rx="4"
                      fill="#fff1f2"
                      stroke="#fecdd3"
                      strokeWidth="1"
                      className="opacity-95"
                    />
                    <text
                      x={width - margin.right - 10}
                      y={y + 3}
                      textAnchor="end"
                      className="font-mono text-[8.5px] font-black fill-rose-600"
                    >
                      CRITICAL DRIFT LIMIT: {criticalLevel.toFixed(1)} pH
                    </text>
                  </g>
                );
              })}

              {/* Draw 7-Day Date Tick Strings on bottom margin axis */}
              {datesList.map((dateStr, idx) => {
                const x = getX(idx);
                return (
                  <g key={idx}>
                    <line
                      x1={x}
                      y1={height - margin.bottom}
                      x2={x}
                      y2={height - margin.bottom + 5}
                      stroke="#94a3b8"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={height - margin.bottom + 17}
                      textAnchor="middle"
                      className="font-mono text-[9px] font-bold fill-slate-505"
                    >
                      {dateStr}
                    </text>
                  </g>
                );
              })}

              <line
                x1={margin.left}
                y1={height - margin.bottom}
                x2={width - margin.right}
                y2={height - margin.bottom}
                stroke="#cbd5e1"
                strokeWidth="1"
              />

              {/* Dynamic Coordinate Curves */}
              {visiblePonds.crasher && (
                <path
                  d={generatePathLine("crasher")}
                  fill="none"
                  stroke={getPondColor("crasher")}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="transition-all duration-350 pointer-events-none"
                />
              )}
              {visiblePonds.ils && (
                <path
                  d={generatePathLine("ils")}
                  fill="none"
                  stroke={getPondColor("ils")}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="transition-all duration-350 pointer-events-none"
                />
              )}
              {visiblePonds.raf && (
                <path
                  d={generatePathLine("raf")}
                  fill="none"
                  stroke={getPondColor("raf")}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="transition-all duration-350 pointer-events-none"
                />
              )}

              {/* Point Node Highlights */}
              {trendPoints.map((pt, idx) => {
                const x = getX(idx);
                const isCurrentHovered = hoveredIdx === idx;
                return (
                  <g key={idx} className="pointer-events-none">
                    {visiblePonds.raf && (
                      <circle
                        cx={x}
                        cy={getY(pt.raf)}
                        r={isCurrentHovered ? "5.5" : "3"}
                        fill="#ffffff"
                        stroke={getPondColor("raf")}
                        strokeWidth={isCurrentHovered ? "3" : "1.8"}
                      />
                    )}
                    {visiblePonds.ils && (
                      <circle
                        cx={x}
                        cy={getY(pt.ils)}
                        r={isCurrentHovered ? "5.5" : "3"}
                        fill="#ffffff"
                        stroke={getPondColor("ils")}
                        strokeWidth={isCurrentHovered ? "3" : "1.8"}
                      />
                    )}
                    {visiblePonds.crasher && (
                      <circle
                        cx={x}
                        cy={getY(pt.crasher)}
                        r={isCurrentHovered ? "5.5" : "3"}
                        fill="#ffffff"
                        stroke={getPondColor("crasher")}
                        strokeWidth={isCurrentHovered ? "3" : "1.8"}
                      />
                    )}
                  </g>
                );
              })}

              {/* Snapping Interactive vertical track bar */}
              {hoveredIdx !== null && (
                <g className="pointer-events-none">
                  <line
                    x1={getX(hoveredIdx)}
                    y1={margin.top}
                    x2={getX(hoveredIdx)}
                    y2={height - margin.bottom}
                    stroke="#f43f5e"
                    strokeWidth="1.2"
                    strokeDasharray="4 2"
                  />
                </g>
              )}

              {/* Y Axis unit Label */}
              <text
                x={margin.left - 10}
                y={margin.top - 12}
                textAnchor="end"
                className="font-mono text-[8px] font-bold fill-slate-400 tracking-wider"
              >
                pH LEVEL
              </text>

              {/* SVG Gradients definitions */}
              <defs>
                <linearGradient id="targetZoneRaf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2dd4bf" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
                <linearGradient id="targetZoneIls" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Quick Informational advice message with Warning alerts if out of bounds */}
          {currentAcidityWarnings.length > 0 ? (
            <div className="bg-rose-50 rounded-xl p-3 border border-rose-200/60 flex items-start gap-2 text-[11px] text-rose-800 animate-pulse">
              <AlertTriangle size={14} className="text-rose-500 mt-0.5 flex-none" />
              <div className="space-y-1">
                <span className="font-bold">URGENT PH DRIFT DETECTED:</span>
                <ul className="list-disc pl-4 space-y-0.5 font-mono">
                  {currentAcidityWarnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200/60 flex items-start gap-2 text-[11.5px] text-emerald-800">
              <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 flex-none" />
              <p className="font-sans">
                <strong>Stable Buffer Chemistry:</strong> All pond pH metrics reside safely within nominal baseline metallurgical recovery margins (Optimal acid concentration). No immediate dosing adjustments are required.
              </p>
            </div>
          )}
        </div>

        {/* Control Config Panel: Toggle/Configure and overrides data (Right) */}
        <div className="lg:col-span-4 flex flex-col gap-3.5">
          {/* Live Snapping Monitor overlay panel */}
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 shadow border border-slate-800 space-y-3 min-h-[125px] flex flex-col justify-between">
            {hoveredIdx !== null ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5XY">
                  <span className="text-xxs font-mono text-rose-400 font-bold uppercase tracking-wider">
                    pH Trace Monitor
                  </span>
                  <span className="font-mono font-bold text-xs bg-rose-955 text-rose-350 px-2 py-0.5 rounded border border-rose-800/30">
                    {datesList[hoveredIdx]}
                  </span>
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  {visiblePonds.raf && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-teal-500" />
                        <span className="text-slate-330">RAF Pond:</span>
                      </div>
                      <span className="font-bold text-teal-400">{trendPoints[hoveredIdx].raf.toFixed(2)} pH</span>
                    </div>
                  )}

                  {visiblePonds.ils && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-indigo-505" style={{ backgroundColor: getPondColor("ils") }} />
                        <span className="text-slate-330">ILS Pond:</span>
                      </div>
                      <span className="font-bold text-indigo-350">{trendPoints[hoveredIdx].ils.toFixed(2)} pH</span>
                    </div>
                  )}

                  {visiblePonds.crasher && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-red-500" style={{ backgroundColor: getPondColor("crasher") }} />
                        <span className="text-slate-330">Crasher:</span>
                      </div>
                      <span className="font-bold text-red-400">{trendPoints[hoveredIdx].crasher.toFixed(2)} pH</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-4 my-auto space-y-1.5 h-full">
                <Layers className="text-rose-450 animate-pulse" size={18} />
                <p className="text-xs font-semibold text-slate-205">Acidity Sensor Probe Idle</p>
                <p className="text-[10px] text-slate-500 font-mono max-w-[190px]">
                  Hover over the trend graph points to trace chemical data logs.
                </p>
              </div>
            )}
            
            <div className="text-[9.5px] font-mono text-slate-400 pt-1 border-t border-slate-800/30">
              Sensors: <span className="text-emerald-400">Calibration valid</span>
            </div>
          </div>

          {/* Interactive tabs */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col flex-1 min-h-[200px]">
            {/* Tab control headers */}
            <div className="flex border-b border-slate-200 pb-1 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("compare")}
                className={`pb-1.5 px-2 text-xs font-sans font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all border-b-2 -mb-1.5 ${
                  activeTab === "compare"
                    ? "border-rose-600 text-rose-700"
                    : "border-transparent text-slate-400 hover:text-slate-650"
                }`}
              >
                <ListFilter size={12} />
                <span>Pond Checklist</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("entry")}
                className={`pb-1.5 px-2 text-xs font-sans font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all border-b-2 -mb-1.5 ${
                  activeTab === "entry"
                    ? "border-rose-600 text-rose-700"
                    : "border-transparent text-slate-400 hover:text-slate-650"
                }`}
              >
                <Edit3 size={12} />
                <span>Override Log</span>
              </button>
            </div>

            {/* TAB CONTENT: Visibility Toggles */}
            {activeTab === "compare" && (
              <div className="space-y-3 pt-2.5 animate-fadeIn">
                <p className="text-[10.5px] text-slate-400 leading-normal font-sans">
                  Toggle process stream series overlay. Click labels to select or filter streams shown.
                </p>
                
                <div className="space-y-2">
                  {(["raf", "ils", "crasher"] as const).map((pondId) => {
                    const isVisible = visiblePonds[pondId];
                    const color = getPondColor(pondId);
                    return (
                      <button
                        key={pondId}
                        type="button"
                        onClick={() => {
                          setVisiblePonds(prev => ({
                            ...prev,
                            [pondId]: !prev[pondId]
                          }));
                        }}
                        className={`w-full p-2 rounded-lg border text-xs font-mono font-bold flex items-center justify-between cursor-pointer transition-all ${
                          isVisible
                            ? "bg-white text-slate-900 shadow-xs border-slate-300"
                            : "bg-slate-100/50 text-slate-400 border-slate-200"
                        }`}
                        style={isVisible ? { borderLeft: `3px solid ${color}` } : undefined}
                      >
                        <span className="font-extrabold uppercase">{getPondLabel(pondId)}</span>
                        <span 
                          className="text-[9px] px-1.5 py-0.5 rounded font-sans font-bold"
                          style={
                            isVisible 
                              ? { backgroundColor: `${color}15`, color: color }
                              : { backgroundColor: "#ebdcd1", color: "#64748b" }
                          }
                        >
                          {isVisible ? "RENDER GRAPHED" : "MUTED"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT: pH Log Entry and Manual Override simulation */}
            {activeTab === "entry" && (
              <div className="space-y-3 pt-2 animate-fadeIn flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-1.5 bg-white p-2 rounded-lg border border-slate-150 shadow-xxs">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Process Stream</span>
                    <select
                      value={selectedEntryPond}
                      onChange={(e) => setSelectedEntryPond(e.target.value as any)}
                      className="text-xs font-mono font-bold text-slate-700 bg-transparent border-none outline-none focus:ring-0 p-0 cursor-pointer"
                    >
                      <option value="raf">Raffinate Pond (RAF)</option>
                      <option value="ils">Intermediate Solution (ILS)</option>
                      <option value="crasher">Crasher Acid Bypass</option>
                    </select>
                  </div>
                  
                  {manualpHOverrides[selectedEntryPond] && (
                    <button
                      type="button"
                      onClick={() => {
                        setManualpHOverrides(prev => {
                          const next = { ...prev };
                          delete next[selectedEntryPond];
                          return next;
                        });
                      }}
                      className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition duration-150 cursor-pointer"
                      title="Reset pond overrides back to plant laboratory design specifications"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>

                <div className="text-[10.5px] text-slate-400 font-sans flex items-center justify-between leading-tight">
                  <span>Enter Daily Chemical Lab pH Readings:</span>
                </div>

                {/* Grid layout of inputs over the 7 days */}
                <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                  {datesList.map((dateStr, idx) => {
                    const currentVal = manualpHOverrides[selectedEntryPond]?.[idx] !== undefined 
                      ? manualpHOverrides[selectedEntryPond][idx] 
                      : defaultValues[selectedEntryPond][idx];
                    const isEdited = manualpHOverrides[selectedEntryPond]?.[idx] !== undefined;

                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between gap-1 p-1 px-2 rounded-lg border text-xxs font-mono transition-all ${
                          isEdited
                            ? "bg-rose-50/25 border-rose-200/50"
                            : "bg-white border-slate-100"
                        }`}
                      >
                        <span className="font-bold text-slate-500">{dateStr}</span>
                        <div className="relative flex items-center bg-white rounded border border-slate-200 shadow-xxs">
                          <input
                            type="number"
                            step="0.01"
                            min="0.1"
                            max="7.0"
                            className="w-20 text-right font-bold text-slate-700 outline-none font-mono py-0.5 pr-6 pl-1 bg-transparent text-xs"
                            value={currentVal}
                            onChange={(e) => {
                              const valueRaw = e.target.value;
                              const numVal = parseFloat(valueRaw);
                              setManualpHOverrides(prev => {
                                const baseArray = [...(prev[selectedEntryPond] || defaultValues[selectedEntryPond])];
                                baseArray[idx] = isNaN(numVal) ? 1.0 : numVal;
                                return {
                                  ...prev,
                                  [selectedEntryPond]: baseArray
                                };
                              });
                            }}
                          />
                          <span className="absolute right-1 text-[8px] text-slate-400 font-bold tracking-wider">pH</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
