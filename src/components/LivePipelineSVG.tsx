import React from "react";
import { LeachPadNode, PondTelemetry } from "../types";
import { Play, Pause, RefreshCw, Layers, Droplet } from "lucide-react";

interface LivePipelineSVGProps {
  pads: LeachPadNode[];
  ponds: {
    raf: PondTelemetry;
    ils: PondTelemetry;
    crasher: PondTelemetry;
    mainLine: PondTelemetry;
  };
  onSelectPad?: (padId: string) => void;
  onSelectPond?: (pondId: string) => void;
}

export default function LivePipelineSVG({ pads, ponds, onSelectPad, onSelectPond }: LivePipelineSVGProps) {
  // Compute totals
  const totalActivePadsFlow = pads
    .filter(p => p.status === "Active")
    .reduce((sum, p) => sum + p.min, 0); // using min as flow rate proxy based on spreadsheet rules

  // Animations run only if flow > 0
  const isRafFlowing = ponds.raf.flow > 0;
  const isIlsFlowing = ponds.ils.flow > 0;
  const isCrasherFlowing = ponds.crasher.flow > 0;
  const isMainLineFlowing = ponds.mainLine.flow > 0;

  // Let's create helper to compute flow speed class
  const getFlowDuration = (flowRate: number) => {
    if (flowRate <= 0) return "0s";
    if (flowRate < 100) return "6s";
    if (flowRate < 500) return "4s";
    return "2s";
  };

  return (
    <div id="pipeline-diagram-card" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 select-none">
        <div>
          <h3 className="font-sans font-bold text-xs tracking-wider uppercase text-slate-800 flex items-center gap-1.5">
            <Layers size={14} className="text-teal-600 animate-pulse" />
            <span>Hydraulic Circuit Pipeline Schematic</span>
          </h3>
          <p className="text-[10px] font-mono text-slate-400 mt-0.5">
            Dynamic live schematic showing active loops & chemical routing paths
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold tracking-tight border border-emerald-150">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Live Flow Indicators</span>
          </span>
        </div>
      </div>

      {/* Main Interactive Diagram Container */}
      <div className="relative flex-1 min-h-[300px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 p-4 flex flex-col justify-between">
        {/* Animated Grid Watermarks */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30"></div>

        {/* Dynamic Water flows */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes march {
            to {
              stroke-dashoffset: -40;
            }
          }
          .animate-flow {
            stroke-dasharray: 8, 4;
            animation: march linear infinite;
          }
          .flow-none {
            stroke-dasharray: none;
            animation: none;
          }
        `}} />

        {/* SVG Drawing of Channels matching Mimbula Minerals layout */}
        <svg className="w-full h-[240px] relative z-10" viewBox="0 0 600 240">
          {/* DEFINITIONS for Gradients and Arrows */}
          <defs>
            <linearGradient id="gradRaf" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
            <linearGradient id="gradIls" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>
            <linearGradient id="gradCrasher" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
            <linearGradient id="gradMainLine" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="activePadGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
          </defs>

          {/* PIPELINE LINES: Background Channels */}
          {/* RAF Pond to Leach Pads Pipeline */}
          <path d="M 110 50 L 250 50 L 250 120" fill="none" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
          {/* ILS Pond to Leach Pads Pipeline */}
          <path d="M 110 120 L 250 120" fill="none" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
          {/* Main Line to Leach Pads Pipeline */}
          <path d="M 110 190 L 320 190 L 320 145" fill="none" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
          {/* Acid to Crasher Pipeline */}
          <path d="M 400 50 L 400 120" fill="none" stroke="#334155" strokeWidth="6" strokeLinecap="round" />

          {/* ACTIVELY GLOWING WATER INDICATORS: CSS Animated Lines */}
          {/* RAF flow simulation */}
          {isRafFlowing && (
            <path 
              d="M 110 50 L 250 50 L 250 120" 
              fill="none" 
              stroke="#38bdf8" 
              strokeWidth="3.5" 
              className="animate-flow" 
              style={{ animationDuration: getFlowDuration(ponds.raf.flow) }} 
            />
          )}

          {/* ILS flow simulation */}
          {isIlsFlowing && (
            <path 
              d="M 110 120 L 250 120" 
              fill="none" 
              stroke="#818cf8" 
              strokeWidth="3.5" 
              className="animate-flow" 
              style={{ animationDuration: getFlowDuration(ponds.ils.flow) }} 
            />
          )}

          {/* Main Line flow simulation */}
          {isMainLineFlowing && (
            <path 
              d="M 110 190 L 320 190 L 320 145" 
              fill="none" 
              stroke="#34d399" 
              strokeWidth="3.5" 
              className="animate-flow" 
              style={{ animationDuration: getFlowDuration(ponds.mainLine.flow) }} 
            />
          )}

          {/* Crasher Flow simulation */}
          {isCrasherFlowing && (
            <path 
              d="M 400 50 L 400 120" 
              fill="none" 
              stroke="#f87171" 
              strokeWidth="3.5" 
              className="animate-flow" 
              style={{ animationDuration: getFlowDuration(ponds.crasher.flow) }} 
            />
          )}

          {/* INTERACTIVE NODES: Ponds (Left Column) */}
          {/* RAF Pond (Sky blue) */}
          <g 
            className="cursor-pointer group transform hover:scale-102 transition-all"
            onClick={() => onSelectPond?.("raf")}
          >
            <rect x="15" y="25" width="95" height="42" rx="6" fill="url(#gradRaf)" stroke="#0284c7" strokeWidth="1.5" />
            <text x="62.5" y="42" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">RAF POND ACID</text>
            <text x="62.5" y="56" fill="#e0f2fe" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">{ponds.raf.flow.toFixed(1)} m³/h</text>
          </g>

          {/* ILS Pond (Indigo) */}
          <g 
            className="cursor-pointer group transform hover:scale-102 transition-all"
            onClick={() => onSelectPond?.("ils")}
          >
            <rect x="15" y="95" width="95" height="42" rx="6" fill="url(#gradIls)" stroke="#4f46e5" strokeWidth="1.5" />
            <text x="62.5" y="112" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">ILS POND ACID</text>
            <text x="62.5" y="126" fill="#e0e7ff" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">{ponds.ils.flow.toFixed(1)} m³/h</text>
          </g>

          {/* MAIN LINE Pond/Collector (Green) */}
          <g 
            className="cursor-pointer group transform hover:scale-102 transition-all"
            onClick={() => onSelectPond?.("mainLine")}
          >
            <rect x="15" y="165" width="95" height="42" rx="6" fill="url(#gradMainLine)" stroke="#059669" strokeWidth="1.5" />
            <text x="62.5" y="182" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">MAIN LINE FEED</text>
            <text x="62.5" y="196" fill="#d1fae5" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">{ponds.mainLine.flow.toFixed(1)} m³/h</text>
          </g>

          {/* LEACH PADS CONSOLIDATION CONTAINER MODULE (Middle-Right Center) */}
          <g className="select-none">
            {/* Outline pad boundary */}
            <rect x="230" y="70" width="130" height="72" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" strokeDasharray="3,3" />
            <text x="295" y="86" fill="#94a3b8" fontSize="8.5" fontWeight="black" fontFamily="sans-serif" letterSpacing="0.8" textAnchor="middle">LEACH PAD NETWORK</text>
            <text x="295" y="106" fill="#38bdf8" fontSize="13" fontWeight="bold" fontFamily="monospace" textAnchor="middle">LP1 - LP{pads.length}</text>
            <text x="295" y="122" fill="#e2e8f0" fontSize="8.5" fontFamily="monospace" textAnchor="middle">Active Cap: {totalActivePadsFlow.toFixed(1)} m³/h</text>
            <text x="295" y="134" fill="#a7f3d0" fontSize="7.5" fontFamily="monospace" textAnchor="middle">LP1 feeds FOHL Plant</text>
          </g>

          {/* FOHL PLANT (Free-On-Heap-Leaching) MODULE (Below Leach Pad Network) */}
          <g className="select-none">
            <rect x="230" y="152" width="130" height="34" rx="6" fill="#090d16" stroke="#10b981" strokeWidth="1.5" />
            <text x="295" y="163" fill="#a7f3d0" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">FOHL PROCESS PLANT</text>
            <text x="295" y="174" fill="#34d399" fontSize="7.5" fontFamily="sans-serif" textAnchor="middle">
              Feeds: LP1, LP2, LP3
            </text>
            <text x="295" y="182" fill="#94a3b8" fontSize="6.5" fontFamily="monospace" textAnchor="middle">
              Inlet: {(pads.find(p => p.id === "LP1")?.min || 0).toFixed(1)} m³/h
            </text>
          </g>

          {/* Flow Lines between Leach Pad Network and FOHL Plant */}
          {/* LP1 feed to FOHL Line */}
          <path d="M 245 142 L 245 152" fill="none" stroke="#475569" strokeWidth="3" />
          {(pads.find(p => p.id === "LP1")?.status === "Active") && (
            <path d="M 245 142 L 245 152" fill="none" stroke="#10b981" strokeWidth="2" className="animate-flow" style={{ animationDuration: "2s" }} />
          )}

          {/* FOHL return to LP1, LP2, LP3 feed Line */}
          <path d="M 345 152 L 345 142" fill="none" stroke="#475569" strokeWidth="3" />
          {(pads.find(p => p.id === "LP1")?.status === "Active") && (
            <path d="M 345 152 L 345 142" fill="none" stroke="#10b981" strokeWidth="2" className="animate-flow" style={{ animationDuration: "2s" }} />
          )}

          {/* CRASHER & EXTRA CIRCUIT CONTROL (Top-right) */}
          <g 
            className="cursor-pointer group transform hover:scale-102 transition-all"
            onClick={() => onSelectPond?.("crasher")}
          >
            <rect x="350" y="15" width="100" height="38" rx="6" fill="url(#gradCrasher)" stroke="#dc2626" strokeWidth="1.5" />
            <text x="400" y="28" fill="#ffffff" fontSize="8.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">ACID TO CRASHER</text>
            <text x="400" y="42" fill="#fee2e2" fontSize="9.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">{ponds.crasher.flow.toFixed(1)} m³/h</text>
          </g>

          {/* HYDRAULIC DISCHARGE PATH: Flow outwards to PLS, ILS and Pit splits */}
          <path d="M 360 115 L 490 115 L 490 160" fill="none" stroke="#475569" strokeWidth="4" />
          {totalActivePadsFlow > 0 && (
            <path d="M 360 115 L 490 115 L 490 160" fill="none" stroke="#22d3ee" strokeWidth="2.5" className="animate-flow" style={{ animationDuration: "3s" }} />
          )}

          {/* DOWNSTREAM PROCESS OUTLETS: SX unit Extraction & ILS Recirculation */}
          {/* PLS Drain (Cyan) */}
          <g className="cursor-pointer" onClick={() => onSelectPad?.("LP5")}>
            <rect x="440" y="160" width="115" height="42" rx="6" fill="#0f172a" stroke="#0891b2" strokeWidth="1.5" />
            <text x="497.5" y="174" fill="#22d3ee" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">PLS TO SX DEPT</text>
            {/* Split statistics */}
            <text x="497.5" y="188" fill="#e2e8f0" fontSize="10" fontWeight="black" fontFamily="monospace" textAnchor="middle">
              {(totalActivePadsFlow * 0.75).toFixed(0)} m³/h (75%)
            </text>
          </g>

          {/* Piping labels / indicators */}
          <circle cx="250" cy="50" r="4" fill="#38bdf8" />
          <circle cx="250" cy="120" r="4" fill="#818cf8" />
          <circle cx="320" cy="190" r="4" fill="#34d399" />
          <circle cx="400" cy="115" r="4" fill="#f87171" />
        </svg>

        {/* Small Touch Legend Overlay */}
        <div className="flex items-center justify-between mt-1 text-[9px] font-mono border-t border-slate-800 pt-3 text-slate-400 select-none">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            <span>RAF Circulation</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            <span>ILS Circulation</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Main Line Feed</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span>Acid Crasher</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            <span>Flowing PLS</span>
          </span>
        </div>
      </div>
    </div>
  );
}
