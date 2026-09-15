import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { LeachPadNode } from "../types";
import { TrendingUp, CheckSquare, Square, Info, LayoutGrid, CheckCircle2, FileSpreadsheet, Layers, Filter, Edit3, RotateCcw } from "lucide-react";

// Modern distinct colors for each of the 12 process loops
export const PAD_COLORS: Record<string, string> = {
  LP1: "#6366f1",    // Indigo
  LP2: "#3b82f6",    // Blue
  LP3: "#06b6d4",    // Cyan
  LP4: "#0d9488",    // Teal
  LP5: "#10b981",    // Emerald
  LP6: "#84cc16",    // Lime
  LP7: "#eab308",    // Yellow
  LP8: "#f97316",    // Orange
  LP9: "#ef4444",    // Red
  LP10: "#ec4899",   // Pink
  LP11: "#a855f7",   // Purple
  LP12: "#f43f5e"    // Rose
};

interface TrendPoint {
  date: Date;
  dateStr: string;
  totalizer: number;
  delta: number; // change from previous day (flow contribution)
}

interface PadTrend {
  padId: string;
  status: string;
  feedType: "RAF" | "ILS";
  color: string;
  data: TrendPoint[];
}

interface TotalizerTrendChartProps {
  pads: LeachPadNode[];
}

export default function TotalizerTrendChart({ pads }: TotalizerTrendChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPads, setSelectedPads] = useState<Record<string, boolean>>({
    LP1: true,
    LP4: true,
    LP5: true,
    LP6: true,
    LP7: true,
  });

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"compare" | "entry">("entry");
  const [selectedEntryPad, setSelectedEntryPad] = useState<string>("LP1");
  const [manualOverrides, setManualOverrides] = useState<Record<string, number[]>>({});

  // Generate date range and cumulative totalizer values working backwards over 7 days
  const trendsList: PadTrend[] = useMemo(() => {
    return pads.map((pad, idx) => {
      // Current active totalizer base (default high-fidelity seed if empty or undefined)
      let currentTotalizer = pad.totalizer;
      if (currentTotalizer === undefined || isNaN(currentTotalizer)) {
        // Physical seed mimicking cumulative volume scale for different loops
        currentTotalizer = 15000 + idx * 4320.50;
      }

      const avgFlow = (pad.min + pad.max) / 2;
      let dailyAccumulation = avgFlow * 24;

      if (pad.status !== "Active") {
        dailyAccumulation = 0; // Flat totalizer line for un-irrigated loops
      } else if (dailyAccumulation === 0) {
        // If loop is active but flow happens to be currently calibrated at 0, fallback to standard baseline flow
        dailyAccumulation = 95 * 24;
      }

      const points: TrendPoint[] = [];
      let runningTotalizer = currentTotalizer;

      // Unfold backward cumulative totalizer series
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dayName = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        // Apply manual override if active
        let val = runningTotalizer;
        if (manualOverrides[pad.id]?.[i] !== undefined) {
          val = manualOverrides[pad.id][i];
        }

        points.unshift({
          date: d,
          dateStr: dayName,
          totalizer: val,
          delta: dailyAccumulation
        });

        // Continue generating simulated cascade
        runningTotalizer = Math.max(0, runningTotalizer - dailyAccumulation);
      }

      // Re-align delta metrics
      for (let i = 1; i < 7; i++) {
        points[i].delta = Math.max(0, points[i].totalizer - points[i - 1].totalizer);
      }
      points[0].delta = points[1] ? Math.max(0, points[1].totalizer / 7) : dailyAccumulation;

      return {
        padId: pad.id,
        status: pad.status,
        feedType: (pad.feedType as "RAF" | "ILS") || "RAF",
        color: PAD_COLORS[pad.id] || "#64748b",
        data: points
      };
    });
  }, [pads, manualOverrides]);

  const datesList = useMemo(() => {
    if (trendsList.length > 0) {
      return trendsList[0].data.map(p => p.dateStr);
    }
    return [];
  }, [trendsList]);

  // Bulk selectors for control room workflows
  const toggleAll = (activeOnly = false) => {
    const nextState: Record<string, boolean> = {};
    pads.forEach(p => {
      if (activeOnly) {
        nextState[p.id] = p.status === "Active";
      } else {
        nextState[p.id] = true;
      }
    });
    setSelectedPads(nextState);
  };

  const clearAll = () => {
    setSelectedPads({});
  };

  const selectByFeedType = (feedType: "RAF" | "ILS") => {
    const nextState: Record<string, boolean> = {};
    pads.forEach(p => {
      nextState[p.id] = p.feedType === feedType;
    });
    setSelectedPads(nextState);
  };

  // Export current simulated trend spreadsheet as CSV
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Leach Pad Cumulative Flow 7-Day Trend Report\r\n";
    csvContent += "Generated On," + new Date().toISOString() + "\r\n\r\n";
    
    // Header
    csvContent += "Date,Pad ID,Feed Type,Status,Totalizer Volume (m3),24h Delta Increase (m3)\r\n";
    
    trendsList.forEach(trend => {
      trend.data.forEach(p => {
        csvContent += `${p.dateStr},${trend.padId},${trend.feedType},${trend.status},${p.totalizer.toFixed(2)},${p.delta.toFixed(2)}\r\n`;
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `LeachPad_7Day_CumulativeTotalizer_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Active visible series for plotting
  const visibleTrends = useMemo(() => {
    return trendsList.filter(t => selectedPads[t.padId]);
  }, [trendsList, selectedPads]);

  // Main D3 Drawing Engine
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svg.node()) return;

    // Clear previous elements to avoid accumulation
    svg.selectAll("*").remove();

    // Responsive design dimensions based on container
    const width = 800;
    const height = 280;
    const margin = { top: 20, right: 35, bottom: 40, left: 65 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    svg.attr("viewBox", `0 0 ${width} ${height}`)
       .attr("width", "100%")
       .attr("height", height);

    if (visibleTrends.length === 0) {
      // Empty visual warning state
      const textGroup = svg.append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);
      
      textGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("class", "fill-slate-400 font-sans font-medium")
        .text("Select process loops below to generate cumulative trend curves.");
      return;
    }

    // Axes domains
    const xDomain = datesList;
    const allTotalizers = visibleTrends.flatMap(t => t.data.map(p => p.totalizer));
    const minVal = (d3.min(allTotalizers) as any) ?? 0;
    const maxVal = (d3.max(allTotalizers) as any) ?? 100000;
    let yMin = Math.max(0, minVal * 0.95);
    let yMax = maxVal * 1.05;
    if (yMin === yMax) {
      yMin = Math.max(0, yMin - 100);
      yMax = yMax + 100;
    }

    // Scales
    const xScale = d3.scalePoint()
      .domain(xDomain)
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([height - margin.bottom, margin.top]);

    // X Axis drawing
    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).tickSize(5))
      .call(g => g.select(".domain").attr("stroke", "#cbd5e1").attr("stroke-width", "1"))
      .call(g => g.selectAll(".tick line").attr("stroke", "#94a3b8"))
      .call(g => g.selectAll("text")
        .attr("class", "font-mono text-[9.5px] font-semibold fill-slate-500")
        .attr("dy", "10")
      );

    // Y Axis drawing with beautiful grid lines and auto scaling suffix labels
    const yAxis = d3.axisLeft(yScale)
      .ticks(6)
      .tickSize(-chartWidth)
      .tickFormat((d: any) => {
        const val = d as number;
        if (val >= 1000000) {
          return `${(val / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
        }
        if (val >= 1000) {
          return `${(val / 1000).toFixed(1).replace(/\.0$/, "")}k`;
        }
        return val.toFixed(0);
      });

    const yAxisGroup = svg.append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(yAxis);

    yAxisGroup.call(g => g.select(".domain").remove()) // clean borderless look
      .call(g => g.selectAll(".tick line")
        .attr("stroke", "#f1f5f9") // light background grid lines
        .attr("stroke-width", "1")
      )
      .call(g => g.selectAll("text")
        .attr("class", "font-mono text-[9px] font-semibold fill-slate-500")
        .attr("dx", "-4")
      );

    // Add unit indicator label on Y-axis
    svg.append("text")
      .attr("x", margin.left - 10)
      .attr("y", margin.top - 6)
      .attr("text-anchor", "end")
      .attr("class", "font-mono text-[8px] font-bold fill-slate-400 tracking-wider")
      .text("m³ Volume");

    // Line drawing curve definition
    const lineGenerator = d3.line<TrendPoint>()
      .x(d => xScale(d.dateStr)!)
      .y(d => yScale(d.totalizer)!)
      .curve(d3.curveMonotoneX); // sleek organic spline curves

    // Draw lines and matching areas
    const linesGroup = svg.append("g").attr("class", "lines");

    visibleTrends.forEach((trend) => {
      // 1. Draw solid MonotoneX line
      linesGroup.append("path")
        .datum(trend.data)
        .attr("fill", "none")
        .attr("stroke", trend.color)
        .attr("stroke-width", "2.5")
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("d", lineGenerator)
        .attr("opacity", "0.85")
        .attr("class", `line-${trend.padId} transition-all duration-300`);

      // 2. Draw circular nodes (bullets) for each day
      const dotsGroup = svg.append("g").attr("class", `dots-${trend.padId}`);
      dotsGroup.selectAll("circle")
        .data(trend.data)
        .enter()
        .append("circle")
        .attr("cx", (d: any) => xScale(d.dateStr)!)
        .attr("cy", (d: any) => yScale(d.totalizer)!)
        .attr("r", 3.2)
        .attr("fill", "#ffffff")
        .attr("stroke", trend.color)
        .attr("stroke-width", "1.8")
        .attr("class", "transition-all duration-200")
        .attr("opacity", "0.95");
    });

    // 3. Hover Guide / Snapping Crosshair Overlay line
    const hoverGuideGroup = svg.append("g")
      .attr("class", "hover-guide-group")
      .style("display", "none");

    const guideLine = hoverGuideGroup.append("line")
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "#a78bfa")
      .attr("stroke-width", "1.5")
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", "0.75");

    // Invisible mouse trigger overlay
    const overlay = svg.append("rect")
      .attr("class", "overlay")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", chartWidth)
      .attr("height", chartHeight)
      .attr("fill", "transparent");

    // Calculation snap variables
    const xPoints = datesList.map(dateStr => xScale(dateStr)!);

    overlay
      .on("mousemove", function (event) {
        const [mx] = d3.pointer(event);
        
        // Find closest point scale index
        let closestIdx = 0;
        let minDiff = Infinity;
        xPoints.forEach((px, idx) => {
          const diff = Math.abs(px - mx);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = idx;
          }
        });

        // Snap vertical line to point
        const snapX = xPoints[closestIdx];
        guideLine.attr("x1", snapX).attr("x2", snapX);
        hoverGuideGroup.style("display", "block");

        // Set state for React synchronized overlay display list
        setHoveredIdx(closestIdx);

        // Highlight matching dots
        visibleTrends.forEach((trend) => {
          svg.select(`.dots-${trend.padId}`)
             .selectAll("circle")
             .attr("r", (d, i) => i === closestIdx ? 5.5 : 3.2)
             .attr("stroke-width", (d, i) => i === closestIdx ? 2.5 : 1.8);
        });
      })
      .on("mouseleave", function () {
        hoverGuideGroup.style("display", "none");
        setHoveredIdx(null);

        // Revert circle scale sizes
        visibleTrends.forEach((trend) => {
          svg.select(`.dots-${trend.padId}`)
             .selectAll("circle")
             .attr("r", 3.2)
             .attr("stroke-width", 1.8);
        });
      });

  }, [visibleTrends, datesList]);

  // Highlight metrics computed based on active date index
  const activeFocusData = useMemo(() => {
    if (hoveredIdx === null || visibleTrends.length === 0) return null;
    return {
      dateStr: datesList[hoveredIdx],
      records: visibleTrends.map(t => ({
        id: t.padId,
        color: t.color,
        feedType: t.feedType,
        value: t.data[hoveredIdx].totalizer,
        delta: t.data[hoveredIdx].delta,
        pct: t.data[hoveredIdx].totalizer > 0 ? (t.data[hoveredIdx].delta / t.data[hoveredIdx].totalizer) * 100 : 0
      })).sort((a, b) => b.value - a.value) // sorted descending scale
    };
  }, [hoveredIdx, visibleTrends, datesList]);

  return (
    <div ref={containerRef} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      
      {/* Visual Title Header Block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-3.5 gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-violet-50 text-violet-600 rounded-lg">
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className="font-sans font-semibold text-slate-800 text-sm">7-Day Cumulative Totalizer Trend</h3>
            <p className="text-xs text-slate-400 font-mono">Precision D3.js Multi-Series Hydraulic Engine</p>
          </div>
        </div>

        {/* Operational Filter Shortcut Links */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold font-mono text-slate-500">
          <span className="flex items-center gap-1 text-slate-400 font-semibold mr-1">
            <Filter size={11} /> FILTER CONTROLS:
          </span>
          <button
            type="button"
            onClick={() => toggleAll(false)}
            className="px-2 py-1 bg-slate-100/80 hover:bg-slate-200/80 rounded transition active:scale-95 cursor-pointer border border-slate-200 text-slate-650"
          >
            Show All
          </button>
          <button
            type="button"
            onClick={() => toggleAll(true)}
            className="px-2 py-1 bg-teal-50 hover:bg-teal-100 rounded text-teal-700 transition active:scale-95 cursor-pointer border border-teal-200"
          >
            Show Active Only
          </button>
          <button
            type="button"
            onClick={() => selectByFeedType("RAF")}
            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded text-indigo-700 transition active:scale-95 cursor-pointer border border-indigo-200"
          >
            RAF Loops
          </button>
          <button
            type="button"
            onClick={() => selectByFeedType("ILS")}
            className="px-2 py-1 bg-cyan-50 hover:bg-cyan-100 rounded text-cyan-700 transition active:scale-95 cursor-pointer border border-cyan-200"
          >
            ILS Loops
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 rounded text-rose-600 transition active:scale-95 cursor-pointer border border-rose-100"
          >
            Deselect All
          </button>
          
          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 transition-all flex items-center gap-1 cursor-pointer border border-slate-200 text-slate-650 shadow-sm"
            title="Download full 7-day totalizer matrices as spreadsheet CSV"
          >
            <FileSpreadsheet size={11} className="text-slate-600" />
            <span>Spreadsheet</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* SVG Curve Plot Column (Left) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="relative border border-slate-100 bg-slate-50/20 rounded-xl overflow-x-auto p-2">
            <svg
              ref={svgRef}
              id="totalizer-trend-svg"
              className="min-w-[700px] h-auto select-none"
            />
          </div>

          {/* Quick Informational footer note */}
          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200/55 flex items-start gap-2 text-[11px] text-slate-500">
            <Info size={13} className="text-slate-400 mt-0.5 flex-none" />
            <p className="font-sans leading-normal">
              <strong>Interactive Crosshair:</strong> Move your cursor across the D3 spline graph to trace historic cumulative volumes and relative process increments. Totalizer metrics on Today (the rightmost point) stay programmatically synced with values input inside the main Leach Pad telemetry spreadsheet.
            </p>
          </div>
        </div>

        {/* Dynamic Checklist and Highlight Tooltip Panel Column (Right) */}
        <div className="lg:col-span-4 flex flex-col gap-3.5">
          
          {/* Snap Tooltip Area */}
          <div className="flex-none bg-slate-900 text-slate-100 rounded-xl p-4 shadow border border-slate-800 space-y-3.5 min-h-[140px] flex flex-col justify-between">
            {activeFocusData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-xxs font-mono text-purple-400 font-bold uppercase tracking-wider">
                    Trace Snap Matrix
                  </span>
                  <span className="font-mono font-bold text-xs bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded border border-purple-800/30">
                    {activeFocusData.dateStr}
                  </span>
                </div>
                
                {/* Scrollable list of metrics for hovered day */}
                <div className="max-h-[155px] overflow-y-auto space-y-2 pr-1 custom-thin-scrollbar">
                  {activeFocusData.records.slice(0, 5).map((rec) => (
                    <div key={rec.id} className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rec.color }} />
                        <span className="font-bold text-slate-200">{rec.id}</span>
                        <span className="text-xxs text-slate-500">({rec.feedType})</span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-slate-50">{rec.value.toLocaleString(undefined, { maximumFractionDigits: 1 })} m³</span>
                        <span className="text-[10px] text-teal-400 block font-normal">+{rec.delta.toFixed(1)} m³ ({rec.pct.toFixed(1)}%)</span>
                      </div>
                    </div>
                  ))}
                  {activeFocusData.records.length > 5 && (
                    <p className="text-[9.5px] font-mono text-slate-400 text-center pt-1 border-t border-slate-800/40 italic">
                      + {activeFocusData.records.length - 5} other selected loops
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-5 h-full space-y-1.5 my-auto">
                <Layers className="text-purple-400/80 animate-pulse" size={20} />
                <p className="text-xs font-semibold text-slate-200">Engineering Probe Idle</p>
                <p className="text-[10px] text-slate-500 font-mono max-w-[190px]">
                  Swipe or hover cursor across the D3 chart to lock on historic values.
                </p>
              </div>
            )}
            
            <div className="text-[9.5px] font-mono text-slate-400 pt-1 border-t border-slate-800/20">
              System: <span className="text-teal-400">Totalizer Accumulator online</span>
            </div>
          </div>

          {/* Individual Toggle Chips & Manual Entry Tabs */}
          <div className="flex-1 border border-slate-200 rounded-xl p-3.5 space-y-2.5 bg-slate-50/50 flex flex-col">
            
            {/* Elegant Tab Headers */}
            <div className="flex border-b border-slate-200 pb-1 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("compare")}
                className={`pb-1.5 px-2 text-xs font-sans font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all border-b-2 -mb-1.5 ${
                  activeTab === "compare"
                    ? "border-violet-600 text-violet-700"
                    : "border-transparent text-slate-400 hover:text-slate-650"
                }`}
              >
                <LayoutGrid size={12} />
                <span>Compare</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("entry")}
                className={`pb-1.5 px-2 text-xs font-sans font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all border-b-2 -mb-1.5 ${
                  activeTab === "entry"
                    ? "border-violet-600 text-violet-700"
                    : "border-transparent text-slate-400 hover:text-slate-650"
                }`}
              >
                <Edit3 size={12} />
                <span>Data Entry</span>
              </button>
            </div>

            {/* TAB CONTENT: COMPARE CHECKBOXES */}
            {activeTab === "compare" && (
              <div className="space-y-2.5 pt-1 animate-fadeIn">
                <p className="text-[11px] text-slate-400 font-sans">
                  Toggle process loops to customize D3 cumulative trend curves.
                </p>
                {/* Grid checklist */}
                <div className="grid grid-cols-3 gap-2">
                  {pads.map((pad) => {
                    const isSelected = !!selectedPads[pad.id];
                    const color = PAD_COLORS[pad.id] || "#64748b";
                    return (
                      <button
                        key={pad.id}
                        type="button"
                        onClick={() => {
                          setSelectedPads(prev => ({
                            ...prev,
                            [pad.id]: !prev[pad.id]
                          }));
                        }}
                        className={`p-1.5 py-2.5 rounded-lg border text-[10.5px] font-mono font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                          isSelected
                            ? "bg-white text-slate-900 shadow-sm border-slate-350"
                            : "bg-slate-100/50 text-slate-400 hover:text-slate-600 border-slate-200"
                        }`}
                        style={isSelected ? { borderLeft: `3px solid ${color}` } : undefined}
                      >
                        <span className="font-extrabold">{pad.id}</span>
                        <span
                          className="text-[8px] px-1 font-semibold rounded font-sans scale-90"
                          style={
                            isSelected
                              ? { backgroundColor: `${color}15`, color: color }
                              : { backgroundColor: "#ebdcd1", color: "#64748b" }
                          }
                        >
                          {pad.feedType || "RAF"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT: MANUAL DATA ENTRY OVERRIDES */}
            {activeTab === "entry" && (
              <div className="space-y-3 pt-1 animate-fadeIn flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-2 bg-white/70 p-2 rounded-lg border border-slate-150 shadow-xxs">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tight">Active Loop</span>
                    <select
                      value={selectedEntryPad}
                      onChange={(e) => setSelectedEntryPad(e.target.value)}
                      className="text-xs font-mono font-bold text-slate-755 bg-transparent border-none outline-none focus:ring-0 p-0 cursor-pointer"
                    >
                      {pads.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.id} ({p.feedType || "RAF"})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {manualOverrides[selectedEntryPad] && (
                    <button
                      type="button"
                      onClick={() => {
                        setManualOverrides(prev => {
                          const next = { ...prev };
                          delete next[selectedEntryPad];
                          return next;
                        });
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition duration-150 cursor-pointer"
                      title="Reset manual entries back to default calculated values"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 font-sans flex items-center justify-between">
                  <span>7-Day Log (m³ totals)</span>
                  {manualOverrides[selectedEntryPad] && (
                    <span className="text-[10px] text-purple-600 font-mono font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-150">
                      Modified
                    </span>
                  )}
                </div>

                {/* 7 Inputs Grid scrollable */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {datesList.map((dateStr, idx) => {
                    const padTrend = trendsList.find(t => t.padId === selectedEntryPad);
                    const currentVal = padTrend?.data[idx]?.totalizer ?? 0;
                    const valueIsOverridden = manualOverrides[selectedEntryPad]?.[idx] !== undefined;

                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between gap-1 p-1.5 rounded-lg border text-xxs font-mono transition-all ${
                          valueIsOverridden
                            ? "bg-purple-50/20 border-purple-200/60"
                            : "bg-white border-slate-100"
                        }`}
                      >
                        <span className="font-bold text-slate-500">{dateStr}</span>
                        <div className="relative flex items-center bg-white rounded border border-slate-200 shadow-xxs">
                          <input
                            type="number"
                            className="w-24 text-right font-bold text-slate-755 outline-none font-mono py-0.5 pr-6 pl-1 bg-transparent text-xs"
                            value={valueIsOverridden ? manualOverrides[selectedEntryPad][idx] : Math.round(currentVal)}
                            placeholder={Math.round(currentVal).toString()}
                            onChange={(e) => {
                              const rawVal = e.target.value;
                              const num = parseFloat(rawVal);
                              setManualOverrides(prev => {
                                // Baseline default series array for full week
                                const defaultArr = padTrend
                                  ? padTrend.data.map(p => p.totalizer)
                                  : [0, 0, 0, 0, 0, 0, 0];
                                
                                const arr = prev[selectedEntryPad] ? [...prev[selectedEntryPad]] : defaultArr;
                                arr[idx] = isNaN(num) ? 0 : num;
                                
                                // Ensure that edited series displays automatically on the D3 graph
                                setSelectedPads(prevSelected => ({
                                  ...prevSelected,
                                  [selectedEntryPad]: true
                                }));

                                return {
                                  ...prev,
                                  [selectedEntryPad]: arr
                                };
                              });
                            }}
                          />
                          <span className="absolute right-1.5 text-[8px] text-slate-400 font-bold tracking-wider">m³</span>
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
