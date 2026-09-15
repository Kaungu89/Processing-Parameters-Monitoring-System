import { useState, useRef } from "react";
import { LeachPadNode, ShiftTelemetryData } from "../types";
import { 
  BarChart3, 
  Info, 
  TrendingUp, 
  Percent, 
  Camera, 
  FileDown, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Activity,
  Sliders,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  Flame,
  Wrench
} from "lucide-react";
import { IMAGE_PRESET_PADS } from "../data";

interface TelemetryChartProps {
  pads: LeachPadNode[];
  history?: ShiftTelemetryData[];
  currentShiftId?: string;
}

export type DeviationSeverity = "normal" | "blockage" | "surge" | "critical_offline";

export interface PadTelemetryAnalysis {
  pad: LeachPadNode;
  currentFlow: number;
  ma24h: number;
  lower15Limit: number;
  upper15Limit: number;
  deviationPct: number;
  isFlagged: boolean;
  severity: DeviationSeverity;
  diagnosis: string;
  recommendation: string;
}

export default function TelemetryChart({ pads, history = [], currentShiftId = "SHIFT-ACTIVE-SESSION" }: TelemetryChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredPad, setHoveredPad] = useState<LeachPadNode | null>(null);
  const [selectedFlaggedPadId, setSelectedFlaggedPadId] = useState<string | null>(null);
  const [showMovingAvg, setShowMovingAvg] = useState<boolean>(true);
  const [showToleranceBand, setShowToleranceBand] = useState<boolean>(true);
  const [showHistTrend, setShowHistTrend] = useState<boolean>(false);
  const [showPrevTrend, setShowPrevTrend] = useState<boolean>(false);
  const [showDeltaView, setShowDeltaView] = useState<boolean>(false);
  const [toleranceThreshold, setToleranceThreshold] = useState<number>(15); // Default 15%
  const [filterOnlyFlagged, setFilterOnlyFlagged] = useState<boolean>(false);

  // Layout parameters for SVG
  const width = 800;
  const height = 250;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 32;
  const paddingBottom = 42;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Maximum flow for scaling
  const maxFlowLimit = Math.max(
    ...pads.map((p) => Math.max(p.max, 200)),
    ...IMAGE_PRESET_PADS.map((p) => Math.max(p.max * 1.3, 200))
  );

  // 1. Get historical shifts for 24-hour moving average calculations
  const historicalShifts = history.filter(h => h.id !== currentShiftId);
  const hasHistory = historicalShifts.length > 0;

  // Filter shifts specifically representing the 24-hour operational cycle (up to 3 recent 8h shifts or 24h timestamp)
  const recent24hShifts = historicalShifts.slice(0, 3);

  // Calculate 24-hour moving average for a specific pad
  const get24hMovingAvg = (padId: string): number => {
    if (recent24hShifts.length > 0) {
      const validPadEntries = recent24hShifts
        .map(h => h.pads.find(p => p.id === padId))
        .filter((p): p is LeachPadNode => !!p && (p.status === "Active" || p.min > 0 || p.max > 0));
      
      if (validPadEntries.length > 0) {
        const sumFlow = validPadEntries.reduce((sum, p) => sum + (p.min + p.max) / 2, 0);
        return sumFlow / validPadEntries.length;
      }
    }

    // High-fidelity fallback based on preset state if no prior shifts in 24h window
    const preset = IMAGE_PRESET_PADS.find(p => p.id === padId);
    if (preset && (preset.status === "Active" || preset.min > 0 || preset.max > 0)) {
      return (preset.min + preset.max) / 2;
    }
    return 0;
  };

  // Preceding shift value
  const getPrevValue = (padId: string): number => {
    if (hasHistory) {
      const prevShift = historicalShifts[0];
      const prevPad = prevShift.pads.find(p => p.id === padId);
      if (prevPad) {
        return (prevPad.min + prevPad.max) / 2;
      }
    }
    const preset = IMAGE_PRESET_PADS.find(p => p.id === padId);
    if (preset && (preset.status === "Active" || preset.min > 0)) {
      return Math.max(0, (preset.min + preset.max) / 2 * 0.96);
    }
    return 0;
  };

  // Comprehensive pad-by-pad deviation & anomaly analysis
  const analyzedPads: PadTelemetryAnalysis[] = pads.map((pad) => {
    const currentFlow = pad.status === "Active" ? (pad.min + pad.max) / 2 : 0;
    const ma24h = get24hMovingAvg(pad.id);
    const lower15Limit = ma24h * (1 - toleranceThreshold / 100);
    const upper15Limit = ma24h * (1 + toleranceThreshold / 100);

    let deviationPct = 0;
    if (ma24h > 0) {
      deviationPct = ((currentFlow - ma24h) / ma24h) * 100;
    } else if (currentFlow > 0) {
      deviationPct = 100; // New unbaselined active flow
    }

    let isFlagged = false;
    let severity: DeviationSeverity = "normal";
    let diagnosis = "Operating within nominal ±15% tolerance corridor.";
    let recommendation = "Maintain current flow setpoints and pressure balances.";

    if (pad.status === "Active") {
      if (ma24h > 0 && deviationPct < -toleranceThreshold) {
        isFlagged = true;
        severity = "blockage";
        diagnosis = `Flow rate is ${Math.abs(deviationPct).toFixed(1)}% below the 24-hour moving average (${currentFlow.toFixed(1)} vs ${ma24h.toFixed(1)} m³/h).`;
        recommendation = "Inspect drip emitter laterals for clogging/scaling, check inline strainers, verify header isolation valve position, and test feed pump discharge pressure.";
      } else if (ma24h > 0 && deviationPct > toleranceThreshold) {
        isFlagged = true;
        severity = "surge";
        diagnosis = `Flow rate is ${deviationPct.toFixed(1)}% above the 24-hour moving average (${currentFlow.toFixed(1)} vs ${ma24h.toFixed(1)} m³/h).`;
        recommendation = "Check for line blow-off/rupture downstream of flowmeter, inspect pressure regulator valve bypass, or throttle VFD pump frequency.";
      }
    } else if (ma24h > 30) {
      // Loop is turned OFF but had significant 24h baseline
      isFlagged = true;
      severity = "critical_offline";
      diagnosis = `Pad is marked ${pad.status}, while 24-hour moving average was ${ma24h.toFixed(1)} m³/h.`;
      recommendation = "Confirm whether this was a scheduled maintenance shutdown or an unintended pump trip / feed supply starvation.";
    }

    return {
      pad,
      currentFlow,
      ma24h,
      lower15Limit,
      upper15Limit,
      deviationPct,
      isFlagged,
      severity,
      diagnosis,
      recommendation
    };
  });

  const flaggedPads = analyzedPads.filter(a => a.isFlagged);
  const displayedPads = filterOnlyFlagged && flaggedPads.length > 0
    ? pads.filter(p => flaggedPads.some(f => f.pad.id === p.id))
    : pads;

  // X scaling parameters based on rendered pads
  const barSpacing = chartWidth / displayedPads.length;
  const barWidth = Math.min(barSpacing * 0.55, 42);

  // SVG Points for 24h Moving Average Line & Tolerance Band
  const pointsMA: string[] = [];
  const pointsUpper15: { x: number; y: number }[] = [];
  const pointsLower15: { x: number; y: number }[] = [];
  const pointsHist: string[] = [];
  const pointsPrev: string[] = [];

  displayedPads.forEach((pad, idx) => {
    const x = paddingLeft + idx * barSpacing + barSpacing / 2;
    const maVal = get24hMovingAvg(pad.id);
    const upperVal = maVal * (1 + toleranceThreshold / 100);
    const lowerVal = Math.max(0, maVal * (1 - toleranceThreshold / 100));
    const prevVal = getPrevValue(pad.id);

    const yMA = chartHeight + paddingTop - (maVal / maxFlowLimit) * chartHeight;
    const yUpper = chartHeight + paddingTop - (upperVal / maxFlowLimit) * chartHeight;
    const yLower = chartHeight + paddingTop - (lowerVal / maxFlowLimit) * chartHeight;
    const yPrev = chartHeight + paddingTop - (prevVal / maxFlowLimit) * chartHeight;

    pointsMA.push(`${x},${yMA}`);
    pointsUpper15.push({ x, y: yUpper });
    pointsLower15.push({ x, y: yLower });
    pointsHist.push(`${x},${yMA}`);
    pointsPrev.push(`${x},${yPrev}`);
  });

  // Construct closed polygon path for the shaded tolerance corridor
  const toleranceBandPath = pointsUpper15.length > 1
    ? `M ${pointsUpper15.map(p => `${p.x},${p.y}`).join(" L ")} L ${pointsLower15.slice().reverse().map(p => `${p.x},${p.y}`).join(" L ")} Z`
    : "";

  const activeHoveredAnalysis = hoveredPad 
    ? analyzedPads.find(a => a.pad.id === hoveredPad.id) 
    : null;

  const downloadPng = () => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    try {
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
      clonedSvg.setAttribute("width", width.toString());
      clonedSvg.setAttribute("height", height.toString());

      const styleElement = document.createElementNS("http://www.w3.org/2000/svg", "style");
      styleElement.textContent = `
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
        .font-bold { font-weight: 700; }
        .font-extrabold { font-weight: 800; }
        .fill-slate-500 { fill: #64748b; }
        .fill-slate-400 { fill: #94a3b8; }
        .fill-slate-900 { fill: #0f172a; }
        .fill-emerald-700 { fill: #047857; }
        .fill-rose-700 { fill: #be123c; }
        .fill-amber-700 { fill: #b45309; }
        text { user-select: none; }
      `;
      clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(clonedSvg);

      if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const blobUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 2; 
        canvas.width = width * scale;
        canvas.height = height * scale;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((pngBlob) => {
            if (pngBlob) {
              const pngUrl = URL.createObjectURL(pngBlob);
              const downloadLink = document.createElement("a");
              const dateStr = new Date().toISOString().split("T")[0];
              downloadLink.download = `LeachPad_Telemetry_Chart_24hMA_${dateStr}.png`;
              downloadLink.href = pngUrl;
              document.body.appendChild(downloadLink);
              downloadLink.click();
              document.body.removeChild(downloadLink);
              URL.revokeObjectURL(pngUrl);
            }
          }, "image/png");
        }
        URL.revokeObjectURL(blobUrl);
      };
      
      img.onerror = (e) => {
        console.error("Error loading SVG into Image for canvas conversion:", e);
        URL.revokeObjectURL(blobUrl);
      };

      img.src = blobUrl;
    } catch (error) {
      console.error("PNG Chart capture failed: ", error);
    }
  };

  const downloadPdf = () => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    try {
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
      clonedSvg.setAttribute("width", width.toString());
      clonedSvg.setAttribute("height", height.toString());

      const styleElement = document.createElementNS("http://www.w3.org/2000/svg", "style");
      styleElement.textContent = `
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
        .font-bold { font-weight: 700; }
        .font-extrabold { font-weight: 800; }
        text { user-select: none; }
      `;
      clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(clonedSvg);

      if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const blobUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const scale = 2.5; 
        canvas.width = width * scale;
        canvas.height = height * scale;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, width, height);

          const imgData = canvas.toDataURL("image/jpeg", 0.95);
          const { jsPDF } = await import("jspdf");
          const pdf = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4"
          });

          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();

          // 1. Dark Top Bar
          pdf.setFillColor(15, 23, 42);
          pdf.rect(0, 0, pageWidth, 12, "F");

          pdf.setTextColor(255, 255, 255);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.text("MIMBULA MINERALS - LEACH PAD TELEMETRY & 24H MOVING AVERAGE ANOMALY REPORT", 12, 8);

          const todayStr = new Date().toISOString().slice(0, 19).replace("T", " ");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.text(`UTC Time: ${todayStr}`, pageWidth - 12, 8, { align: "right" });

          // 2. Report Title Block
          pdf.setTextColor(15, 23, 42);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(15);
          pdf.text("Leach Pad Flow Telemetry & 24-Hour Moving Average Deviation Analysis", 12, 23);

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8.5);
          pdf.setTextColor(100, 116, 139);
          pdf.text(`Automated anomaly detection flagging flow deviations exceeding ±${toleranceThreshold}% of the 24-hour rolling baseline to detect line blockages and pump failure.`, 12, 28);

          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.4);
          pdf.line(12, 32, pageWidth - 12, 32);

          // 3. Metadata Grid
          pdf.setTextColor(51, 65, 85);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.5);

          pdf.text("SHIFT STATUS", 12, 38);
          pdf.setFont("helvetica", "normal");
          pdf.text(`Shift ID: ${currentShiftId || "N/A"}`, 12, 43);
          const activeShiftPads = pads.filter(p => p.status === "Active");
          pdf.text(`Active Loops: ${activeShiftPads.length} of ${pads.length} Total`, 12, 47);

          pdf.setFont("helvetica", "bold");
          pdf.text("ANOMALY DETECTION (±15% RULE)", 95, 38);
          pdf.setFont("helvetica", "normal");
          pdf.text(`Flagged Anomaly Loops: ${flaggedPads.length} Pads`, 95, 43);
          const blockageCount = flaggedPads.filter(f => f.severity === "blockage").length;
          const surgeCount = flaggedPads.filter(f => f.severity === "surge").length;
          pdf.text(`Categories: ${blockageCount} Blockage Risk / ${surgeCount} Surge Risk`, 95, 47);

          pdf.setFont("helvetica", "bold");
          pdf.text("BASELINE CORRIDOR", 180, 38);
          pdf.setFont("helvetica", "normal");
          pdf.text(`24h Moving Avg Line: ${showMovingAvg ? "Rendered Active" : "Hidden"}`, 180, 43);
          pdf.text(`Safety Corridor Envelope: ±${toleranceThreshold}% Normal Band`, 180, 47);

          // 4. Background frame for chart
          pdf.setFillColor(248, 250, 252);
          pdf.rect(12, 52, pageWidth - 24, 126, "F");
          pdf.setDrawColor(203, 213, 225);
          pdf.rect(12, 52, pageWidth - 24, 126, "D");

          const displayWidth = pageWidth - 42; 
          const displayHeight = (height / width) * displayWidth; 
          const imageX = (pageWidth - displayWidth) / 2;
          const imageY = 56 + (116 - displayHeight) / 2; 
          pdf.addImage(imgData, "JPEG", imageX, imageY, displayWidth, displayHeight);

          // 5. Dynamic Legend in PDF
          const legendY = pageHeight - 16;
          pdf.setFillColor(20, 184, 166);
          pdf.rect(15, legendY, 3, 3, "F");
          pdf.setTextColor(71, 85, 105);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8);
          pdf.text("Nominal Flow", 20, legendY + 2.5);

          pdf.setFillColor(244, 63, 94);
          pdf.rect(48, legendY, 3, 3, "F");
          pdf.text("Blockage (>15% Drop)", 53, legendY + 2.5);

          pdf.setFillColor(245, 158, 11);
          pdf.rect(88, legendY, 3, 3, "F");
          pdf.text("Surge (>15% High)", 93, legendY + 2.5);

          pdf.setDrawColor(99, 102, 241);
          pdf.setLineWidth(1);
          pdf.line(125, legendY + 1.5, 135, legendY + 1.5);
          pdf.text("24h Moving Average", 138, legendY + 2.5);

          pdf.setDrawColor(199, 210, 254);
          pdf.rect(173, legendY - 0.5, 8, 4, "F");
          pdf.text(`±${toleranceThreshold}% Safety Corridor`, 184, legendY + 2.5);

          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.4);
          pdf.line(12, pageHeight - 10, pageWidth - 12, pageHeight - 10);

          pdf.setTextColor(148, 163, 184);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7.5);
          pdf.text("MIMBULA MINERALS SCADA TELEMETRY VERIFICATION • RESTRICTED", 12, pageHeight - 6);
          pdf.text("Page 1 of 1", pageWidth - 12, pageHeight - 6, { align: "right" });

          const dateStr = new Date().toISOString().split("T")[0];
          pdf.save(`LeachPad_Telemetry_24hMA_Report_${dateStr}.pdf`);
        }
        URL.revokeObjectURL(blobUrl);
      };
      
      img.onerror = (e) => {
        console.error("Error loading SVG into Image for PDF conversion:", e);
        URL.revokeObjectURL(blobUrl);
      };

      img.src = blobUrl;
    } catch (error) {
      console.error("PDF Chart export failed: ", error);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      {/* Title & Interactive Legend/Toggles Dock */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b pb-3.5 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/80 shadow-xs">
            <BarChart3 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-sans font-bold text-slate-800 text-sm tracking-tight">Real-Time Flow Distribution & 24h Moving Average</h3>
              {flaggedPads.length > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                  <AlertTriangle size={11} className="text-rose-600" />
                  {flaggedPads.length} FLAGGED (&gt;{toleranceThreshold}%)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={11} className="text-emerald-600" />
                  NOMINAL (±{toleranceThreshold}%)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">Heap Leach m³/h (LP1 - LP12) • 24-Hour Rolling Baseline Anomaly Engine</p>
          </div>
        </div>

        {/* Action Toggles Bar */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-mono">
          {/* Status Color Indicators */}
          <div className="flex items-center gap-2.5 border-r border-slate-200 pr-3 hidden sm:flex">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-teal-500 block"></span>
              <span className="text-slate-500 text-[11px]">Normal</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-rose-500 block animate-pulse"></span>
              <span className="text-rose-600 font-semibold text-[11px]">Blockage</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-400 block"></span>
              <span className="text-amber-600 font-semibold text-[11px]">Surge</span>
            </div>
          </div>

          {/* Interactive Feature Toggle Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* 24h Moving Average Line Toggle */}
            <button
              id="btn-toggle-24h-ma"
              type="button"
              onClick={() => setShowMovingAvg(!showMovingAvg)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                showMovingAvg
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-400"
              }`}
              title="Toggle 24-hour moving average baseline trend line"
            >
              <Activity size={11} className={showMovingAvg ? "text-indigo-600" : "text-slate-400"} />
              <span className={`w-1.5 h-1.5 rounded-full ${showMovingAvg ? "bg-indigo-500" : "bg-slate-300"}`}></span>
              24h Moving Avg
            </button>

            {/* ±15% Safety Corridor Toggle */}
            <button
              id="btn-toggle-tolerance-band"
              type="button"
              onClick={() => setShowToleranceBand(!showToleranceBand)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                showToleranceBand
                  ? "bg-purple-50 border-purple-200 text-purple-700 shadow-xs font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-400"
              }`}
              title={`Toggle the shaded ±${toleranceThreshold}% normal operating corridor`}
            >
              <ShieldAlert size={11} className={showToleranceBand ? "text-purple-600" : "text-slate-400"} />
              <span className={`w-1.5 h-1.5 rounded-full ${showToleranceBand ? "bg-purple-500" : "bg-slate-300"}`}></span>
              ±{toleranceThreshold}% Band
            </button>

            {/* Delta View Toggle */}
            <button
              id="btn-toggle-delta"
              type="button"
              onClick={() => setShowDeltaView(!showDeltaView)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                showDeltaView
                  ? "bg-emerald-50 border-emerald-250 text-emerald-800 shadow-xs font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-400"
              }`}
              title="Overlay exact percentage drift badges on all pad bars"
            >
              <Percent size={10} className={showDeltaView ? "text-emerald-600" : "text-slate-400"} />
              <span className={`w-1.5 h-1.5 rounded-full ${showDeltaView ? "bg-emerald-500" : "bg-slate-300"}`}></span>
              Delta %
            </button>

            {/* Filter Flagged Only */}
            {flaggedPads.length > 0 && (
              <button
                id="btn-filter-flagged"
                type="button"
                onClick={() => setFilterOnlyFlagged(!filterOnlyFlagged)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  filterOnlyFlagged
                    ? "bg-rose-100 border-rose-300 text-rose-800 shadow-xs"
                    : "bg-rose-50 border-rose-200 text-rose-700"
                }`}
                title="Isolate only the flagged pads deviating by >15%"
              >
                <Filter size={10} className="text-rose-600" />
                {filterOnlyFlagged ? "Show All (12)" : `Flagged (${flaggedPads.length})`}
              </button>
            )}

            <div className="h-4 w-px bg-slate-200 mx-0.5 hidden md:block"></div>

            {/* PNG & PDF Exporters */}
            <button
              id="btn-capture-png"
              type="button"
              onClick={downloadPng}
              className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 transition-all rounded-full cursor-pointer shadow-xs active:scale-95"
              title="Download high-resolution chart as a PNG image"
            >
              <Camera size={11} className="text-slate-600" />
              <span>PNG</span>
            </button>

            <button
              id="btn-export-pdf"
              type="button"
              onClick={downloadPdf}
              className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-[10px] font-bold flex items-center gap-1 transition-all rounded-full cursor-pointer shadow-xs active:scale-95"
              title="Export high-resolution telemetry chart and anomaly report to landscape PDF"
            >
              <FileDown size={11} className="text-teal-700" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* SVG Drawing Canvas */}
      <div className="relative w-full overflow-x-auto select-none bg-slate-950/2 rounded-xl p-2 border border-slate-100">
        <svg
          ref={svgRef}
          id="telemetry-chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          className="min-w-[680px]"
        >
          {/* Subtle Grid Lines & Y-Axis Scale */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const hVal = maxFlowLimit * ratio;
            const y = chartHeight + paddingTop - ratio * chartHeight;
            return (
              <g key={i} className="opacity-25">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#475569"
                  strokeWidth="0.8"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  className="font-mono text-[9px] font-bold fill-slate-500"
                >
                  {Math.round(hVal)}
                </text>
              </g>
            );
          })}

          {/* Shaded ±15% Tolerance Corridor (Normal Operating Safety Envelope) */}
          {showToleranceBand && toleranceBandPath && (
            <g className="transition-all duration-300 pointer-events-none">
              <path
                d={toleranceBandPath}
                fill="url(#toleranceCorridorGrad)"
                stroke="#818cf8"
                strokeWidth="1"
                strokeDasharray="3 3"
                strokeOpacity="0.45"
                className="transition-all duration-300"
              />
            </g>
          )}

          {/* Leach Pad Flow Range Bars */}
          {displayedPads.map((pad, idx) => {
            const x = paddingLeft + idx * barSpacing + (barSpacing - barWidth) / 2;
            const avgFlow = (pad.min + pad.max) / 2;
            const analysis = analyzedPads.find(a => a.pad.id === pad.id);
            const isFlagged = analysis?.isFlagged || false;
            const severity = analysis?.severity || "normal";

            // Height scaling
            const minHeight = (pad.min / maxFlowLimit) * chartHeight;
            const maxHeight = (pad.max / maxFlowLimit) * chartHeight;

            const isHovered = hoveredPad?.id === pad.id || selectedFlaggedPadId === pad.id;

            // Determine bar fill gradient & border highlights
            let barColor = "url(#activeGrad)";
            let strokeColor = "#0f766e";

            if (severity === "blockage") {
              barColor = "url(#blockageGrad)";
              strokeColor = "#e11d48";
            } else if (severity === "surge") {
              barColor = "url(#surgeGrad)";
              strokeColor = "#d97706";
            } else if (pad.status === "Off") {
              barColor = "url(#offGrad)";
              strokeColor = "#b45309";
            } else if (pad.status === "Offline") {
              barColor = "url(#offlineGrad)";
              strokeColor = "#be123c";
            }

            return (
              <g
                key={pad.id}
                onMouseEnter={() => setHoveredPad(pad)}
                onMouseLeave={() => setHoveredPad(null)}
                onClick={() => setSelectedFlaggedPadId(selectedFlaggedPadId === pad.id ? null : pad.id)}
                className="cursor-pointer group"
              >
                {/* Invisible hover trigger area */}
                <rect
                  x={paddingLeft + idx * barSpacing}
                  y={paddingTop}
                  width={barSpacing}
                  height={chartHeight}
                  fill="transparent"
                />

                {/* Vertical Range Bar */}
                {pad.status === "Active" ? (
                  <>
                    {/* Main Bar */}
                    <rect
                      x={x}
                      y={chartHeight + paddingTop - maxHeight}
                      width={barWidth}
                      height={Math.max(maxHeight, 2)}
                      rx="4"
                      fill={barColor}
                      stroke={isFlagged ? strokeColor : "none"}
                      strokeWidth={isFlagged ? 1.5 : 0}
                      className="transition-all duration-300"
                      opacity={isHovered ? 1 : 0.85}
                    />
                    {/* Inner core showing min limits */}
                    <rect
                      x={x + 2}
                      y={chartHeight + paddingTop - minHeight}
                      width={barWidth - 4}
                      height={Math.max(minHeight, 2)}
                      rx="2"
                      fill="url(#innerActiveGrad)"
                      opacity={0.35}
                    />
                  </>
                ) : (
                  /* Zero flow / Off indicator */
                  <rect
                    x={x}
                    y={chartHeight + paddingTop - 8}
                    width={barWidth}
                    height={8}
                    rx="3"
                    fill={barColor}
                    stroke={isFlagged ? strokeColor : "none"}
                    strokeWidth={isFlagged ? 1.2 : 0}
                    className="transition-all duration-300"
                    opacity={isHovered ? 1 : 0.7}
                  />
                )}

                {/* Pulsating Alert Ring if Flagged (>15% deviation) or Hovered */}
                {isFlagged && (
                  <rect
                    x={x - 2}
                    y={chartHeight + paddingTop - Math.max(maxHeight, 8) - 2}
                    width={barWidth + 4}
                    height={Math.max(maxHeight, 8) + 4}
                    rx="6"
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="1.8"
                    strokeDasharray={isHovered ? "none" : "3 2"}
                    className="animate-pulse"
                  />
                )}

                {/* Flagged Anomaly Badge on top of Bar */}
                {isFlagged && pad.status === "Active" && (
                  <g transform={`translate(${x + barWidth / 2}, ${chartHeight + paddingTop - maxHeight - 14})`}>
                    <rect
                      x={-24}
                      y={-6}
                      width={48}
                      height={13}
                      rx={3.5}
                      fill={severity === "blockage" ? "#ffe4e6" : "#fef3c7"}
                      stroke={severity === "blockage" ? "#f43f5e" : "#f59e0b"}
                      strokeWidth="1"
                    />
                    <text
                      y={3.5}
                      textAnchor="middle"
                      className={`font-mono text-[8px] font-extrabold ${
                        severity === "blockage" ? "fill-rose-700" : "fill-amber-800"
                      }`}
                    >
                      {analysis && analysis.deviationPct < 0 
                        ? `${analysis.deviationPct.toFixed(0)}% ⚠️` 
                        : `+${analysis?.deviationPct.toFixed(0)}% ⚠️`}
                    </text>
                  </g>
                )}

                {/* X Axis Labels */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + paddingTop + 16}
                  textAnchor="middle"
                  className={`font-mono text-[9.5px] font-bold tracking-tight transition-colors ${
                    isFlagged
                      ? severity === "blockage" ? "fill-rose-600 font-extrabold" : "fill-amber-600 font-extrabold"
                      : isHovered ? "fill-slate-900 font-extrabold" : "fill-slate-500"
                  }`}
                >
                  {pad.id}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + paddingTop + 27}
                  textAnchor="middle"
                  className={`font-mono text-[8px] ${
                    isFlagged ? "fill-rose-500 font-bold" : "fill-slate-400"
                  }`}
                >
                  {pad.status === "Active" ? `${Math.round(avgFlow)}` : pad.status}
                </text>
              </g>
            );
          })}

          {/* 24-Hour Moving Average Line Path */}
          {showMovingAvg && pointsMA.length > 1 && (
            <path
              d={`M ${pointsMA.join(" L ")}`}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300 pointer-events-none"
              opacity="0.9"
            />
          )}

          {/* Moving Average Nodes on Each Column */}
          {showMovingAvg && displayedPads.map((pad, idx) => {
            const x = paddingLeft + idx * barSpacing + barSpacing / 2;
            const maVal = get24hMovingAvg(pad.id);
            const yMA = chartHeight + paddingTop - (maVal / maxFlowLimit) * chartHeight;
            const isHovered = hoveredPad?.id === pad.id || selectedFlaggedPadId === pad.id;

            return (
              <g key={`ma-node-${pad.id}`} className="transition-all duration-300 pointer-events-none">
                <circle
                  cx={x}
                  cy={yMA}
                  r={isHovered ? "5.5" : "3.5"}
                  fill="#4f46e5"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className="transition-all duration-200"
                />
              </g>
            );
          })}

          {/* Delta Variance Badges Overlay (when toggled) */}
          {showDeltaView && displayedPads.map((pad, idx) => {
            const x = paddingLeft + idx * barSpacing + barSpacing / 2;
            const analysis = analyzedPads.find(a => a.pad.id === pad.id);
            if (!analysis || (analysis.ma24h === 0 && analysis.currentFlow === 0)) return null;

            const yMA = chartHeight + paddingTop - (analysis.ma24h / maxFlowLimit) * chartHeight;
            const yCur = chartHeight + paddingTop - (analysis.currentFlow / maxFlowLimit) * chartHeight;
            const isHovered = hoveredPad?.id === pad.id;
            const isPositive = analysis.deviationPct >= 0;

            const strokeColor = analysis.isFlagged 
              ? (isPositive ? "#f59e0b" : "#f43f5e") 
              : (isPositive ? "#10b981" : "#64748b");
            const bgBadgeColor = analysis.isFlagged 
              ? (isPositive ? "#fef3c7" : "#ffe4e6") 
              : (isPositive ? "#ecfdf5" : "#f1f5f9");
            const borderBadgeColor = analysis.isFlagged 
              ? (isPositive ? "#fcd34d" : "#fda4af") 
              : (isPositive ? "#a7f3d0" : "#cbd5e1");
            const textBadgeColor = analysis.isFlagged 
              ? (isPositive ? "fill-amber-800" : "fill-rose-700") 
              : (isPositive ? "fill-emerald-700" : "fill-slate-600");

            const yMid = (yMA + yCur) / 2;

            return (
              <g key={`delta-line-${pad.id}`} className="transition-all duration-300 pointer-events-none">
                <line
                  x1={x}
                  y1={yMA}
                  x2={x}
                  y2={yCur}
                  stroke={strokeColor}
                  strokeWidth={isHovered ? "2" : "1"}
                  strokeDasharray="2 2"
                  opacity={isHovered ? "1" : "0.8"}
                />
                <g transform={`translate(${x}, ${yMid})`}>
                  <rect
                    x={-20}
                    y={-7}
                    width={40}
                    height={14}
                    rx={3.5}
                    fill={bgBadgeColor}
                    stroke={borderBadgeColor}
                    strokeWidth={isHovered ? "1.2" : "0.8"}
                  />
                  <text
                    y={3}
                    textAnchor="middle"
                    className={`font-mono text-[8px] font-extrabold ${textBadgeColor}`}
                  >
                    {isPositive ? `+${analysis.deviationPct.toFixed(0)}%` : `${analysis.deviationPct.toFixed(0)}%`}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Gradients Definitions */}
          <defs>
            {/* Tolerance corridor fill */}
            <linearGradient id="toleranceCorridorGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0.08" />
            </linearGradient>

            {/* Nominal Active Bar Gradient */}
            <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#0f766e" />
            </linearGradient>
            <linearGradient id="innerActiveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#115e59" />
            </linearGradient>

            {/* Blockage Alert Gradient (Red / Crimson) */}
            <linearGradient id="blockageGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#be123c" />
            </linearGradient>

            {/* Surge Alert Gradient (Amber / Orange) */}
            <linearGradient id="surgeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>

            {/* Off / Offline Gradients */}
            <linearGradient id="offGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
            <linearGradient id="offlineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#881337" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Flagged Anomaly Diagnostic Alert Banner */}
      {flaggedPads.length > 0 ? (
        <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3.5 space-y-2.5 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                <AlertTriangle size={16} />
              </div>
              <div>
                <h4 className="font-sans font-bold text-slate-900 text-xs tracking-tight">
                  Automatic Telemetry Anomaly Detected ({flaggedPads.length} Pads &gt;{toleranceThreshold}% 24h MA Deviation)
                </h4>
                <p className="text-[11px] text-slate-500 font-sans">
                  Flow rates deviating beyond the normal ±{toleranceThreshold}% operating corridor indicate line blockages, scaling, or pump cavitation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded border border-rose-200">
                SCADA ALERT
              </span>
            </div>
          </div>

          {/* Interactive Flagged Pads Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {flaggedPads.map((analysis) => {
              const isSelected = selectedFlaggedPadId === analysis.pad.id;
              const isBlockage = analysis.severity === "blockage";

              return (
                <div
                  key={`card-${analysis.pad.id}`}
                  onClick={() => setSelectedFlaggedPadId(isSelected ? null : analysis.pad.id)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? isBlockage 
                        ? "bg-white border-rose-500 shadow-md ring-2 ring-rose-200" 
                        : "bg-white border-amber-500 shadow-md ring-2 ring-amber-200"
                      : isBlockage
                        ? "bg-white/80 border-rose-200 hover:border-rose-300 hover:bg-white"
                        : "bg-white/80 border-amber-200 hover:border-amber-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                      <span className={`w-2 h-2 rounded-full ${isBlockage ? "bg-rose-500 animate-ping" : "bg-amber-500"}`}></span>
                      <span>{analysis.pad.id}</span>
                      <span className="text-[10px] font-normal text-slate-500">({analysis.pad.feedType || "RAF"})</span>
                    </div>
                    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                      isBlockage 
                        ? "bg-rose-100 text-rose-700" 
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {isBlockage ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}
                      {analysis.deviationPct < 0 ? `${analysis.deviationPct.toFixed(1)}%` : `+${analysis.deviationPct.toFixed(1)}%`}
                    </span>
                  </div>

                  <div className="font-mono text-[11px] text-slate-600 flex justify-between py-1 border-y border-slate-100">
                    <span>Flow: <strong className="text-slate-900">{analysis.currentFlow.toFixed(1)} m³/h</strong></span>
                    <span>24h MA: <strong className="text-indigo-600">{analysis.ma24h.toFixed(1)} m³/h</strong></span>
                  </div>

                  <p className="text-[11px] text-slate-600 font-sans mt-1.5 line-clamp-2 leading-tight">
                    <strong className={isBlockage ? "text-rose-700" : "text-amber-700"}>
                      {isBlockage ? "Blockage Warning: " : "Surge Warning: "}
                    </strong>
                    {analysis.recommendation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 flex-none" />
            <span className="font-medium">
              All active leach pad flow rates are currently within the nominal ±{toleranceThreshold}% moving average safety corridor.
            </span>
          </div>
          <span className="font-mono font-bold text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
            NO ANOMALIES
          </span>
        </div>
      )}

      {/* Dynamic Telemetry Tooltip & Live Inspector */}
      <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/70 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <Info size={15} className="text-slate-400 mt-0.5 flex-none" />
          <div>
            {activeHoveredAnalysis ? (
              <div className="space-y-1 font-mono text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-slate-900 text-sm font-bold">{activeHoveredAnalysis.pad.id} Inspection:</strong>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    activeHoveredAnalysis.pad.status === "Active" ? "bg-teal-100 text-teal-800" : "bg-slate-200 text-slate-700"
                  }`}>
                    {activeHoveredAnalysis.pad.status}
                  </span>
                  <span>Feed: <strong>{activeHoveredAnalysis.pad.feedType || "RAF"}</strong></span>
                  <span>Current Flow: <strong className="text-teal-700 text-sm">{activeHoveredAnalysis.currentFlow.toFixed(1)} m³/h</strong></span>
                  <span>24h Moving Avg: <strong className="text-indigo-600 font-bold">{activeHoveredAnalysis.ma24h.toFixed(1)} m³/h</strong></span>
                  <span>Band: [{activeHoveredAnalysis.lower15Limit.toFixed(1)} - {activeHoveredAnalysis.upper15Limit.toFixed(1)} m³/h]</span>
                </div>
                
                <div className="text-[11px] font-sans pt-1 text-slate-600 flex items-center gap-2">
                  <span className={`inline-block px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                    activeHoveredAnalysis.isFlagged
                      ? activeHoveredAnalysis.severity === "blockage" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {activeHoveredAnalysis.isFlagged ? "⚠️ FLAGGED ANOMALY" : "✓ NOMINAL RANGE"}
                  </span>
                  <span>{activeHoveredAnalysis.diagnosis} {activeHoveredAnalysis.recommendation}</span>
                </div>
              </div>
            ) : (
              <p className="font-sans text-slate-500 leading-normal">
                Tip: Hover over or tap any pad bar to inspect its exact 24-hour moving average, allowable ±{toleranceThreshold}% limits, and live blockage/surge diagnosis.
              </p>
            )}
          </div>
        </div>

        {/* Tolerance Threshold Selector */}
        <div className="flex items-center gap-1.5 self-end sm:self-center font-mono text-[10px] text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
          <Sliders size={11} className="text-slate-400" />
          <span>Threshold:</span>
          {[10, 15, 20].map((th) => (
            <button
              key={th}
              type="button"
              onClick={() => setToleranceThreshold(th)}
              className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                toleranceThreshold === th
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              ±{th}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

