import React, { useState, useEffect } from "react";
import { LeachPadNode, PondTelemetry, ExtraProcessTelemetry } from "../types";
import { 
  Smartphone, 
  Layers, 
  Database, 
  Sparkles, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Wifi, 
  WifiOff, 
  ChevronRight, 
  Minimize2, 
  HelpCircle, 
  Activity, 
  Check, 
  Search, 
  AlertCircle, 
  RefreshCw, 
  Wrench,
  Camera,
  RotateCcw,
  Plus,
  Minus,
  Beaker,
  Compass,
  Zap,
  FolderSync
} from "lucide-react";
import LivePipelineSVG from "./LivePipelineSVG";

interface MobileFieldSimulatorProps {
  pads: LeachPadNode[];
  ponds: {
    raf: PondTelemetry;
    ils: PondTelemetry;
    crasher: PondTelemetry;
    mainLine: PondTelemetry;
  };
  extraTelemetry: ExtraProcessTelemetry;
  onUpdatePads: (updated: LeachPadNode[]) => void;
  onUpdatePonds: (updated: {
    raf: PondTelemetry;
    ils: PondTelemetry;
    crasher: PondTelemetry;
    mainLine: PondTelemetry;
  }) => void;
  onUpdateExtraTelemetry: (updated: ExtraProcessTelemetry) => void;
  liveCat: string;
}

export default function MobileFieldSimulator({
  pads,
  ponds,
  extraTelemetry,
  onUpdatePads,
  onUpdatePonds,
  onUpdateExtraTelemetry,
  liveCat
}: MobileFieldSimulatorProps) {
  // Mobile app tabs
  const [activeTab, setActiveTab] = useState<"pads" | "ponds" | "schematic" | "calculators" | "sync">("pads");
  
  // Local interface states
  const [activePadFilter, setActivePadFilter] = useState<"all" | "Active" | "Off" | "Offline">("all");
  const [searchPhrase, setSearchPhrase] = useState("");
  const [focusedPadId, setFocusedPadId] = useState<string | null>(null);
  
  // Simulated connection states
  const [signalStrength, setSignalStrength] = useState<"excellent" | "fair" | "offline">("excellent");
  const [unsyncedItemsCount, setUnsyncedItemsCount] = useState(0);
  const [isSimulatingSync, setIsSimulatingSync] = useState(false);
  const [isQrScannerActive, setIsQrScannerActive] = useState(false);
  const [qrScanResult, setQrScanResult] = useState<string | null>(null);

  // Field Calculators local states
  const [calcPondVol, setCalcPondVol] = useState(4500); // m³
  const [calcTargetAcid, setCalcTargetAcid] = useState(6.0); // g/L H₂SO₄
  const [calcCurrentAcid, setCalcCurrentAcid] = useState(4.2); // g/L H₂SO₄
  
  const [calcPlsFlow, setCalcPlsFlow] = useState(620); // m³/h
  const [calcCuGrade, setCalcCuGrade] = useState(3.4); // g/L Cu
  const [calcRecovery, setCalcRecovery] = useState(94.0); // %

  // Sound & Vibrate haptic simulator indicators (with visual feedback)
  const [showHapticRumble, setShowHapticRumble] = useState(false);

  const simulateHapticFeedback = () => {
    setShowHapticRumble(true);
    setTimeout(() => setShowHapticRumble(false), 200);
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(20); // standard Android short tap vibrate
    }
  };

  // Sync transmissions cache simulator
  useEffect(() => {
    // Increment unsynced changes whenever state updates and network is unstable/offline
    if (signalStrength === "offline") {
      setUnsyncedItemsCount(prev => prev + 1);
    }
  }, [pads, ponds, signalStrength]);

  const handlePadPropertyChange = (padId: string, updates: Partial<LeachPadNode>) => {
    simulateHapticFeedback();
    const newPads = pads.map(pad => {
      if (pad.id === padId) {
        return { ...pad, ...updates };
      }
      return pad;
    });
    onUpdatePads(newPads);
  };

  const handlePondPropertyChange = (pondId: string, field: "flow" | "totalizer", value: number) => {
    simulateHapticFeedback();
    const currentPond = ponds[pondId as keyof typeof ponds];
    const updatedPond = { ...currentPond, [field]: value };
    onUpdatePonds({
      ...ponds,
      [pondId]: updatedPond
    });
  };

  // Quick incremental steppers
  const adjustFlowValue = (pad: LeachPadNode, direction: "up" | "down", amount = 5) => {
    simulateHapticFeedback();
    // In this spread, the flow is stored in pad.min (as the flow rate indicator)
    const currentVal = pad.min;
    const newVal = direction === "up" 
      ? Math.min(250, currentVal + amount) 
      : Math.max(0, currentVal - amount);
      
    // Sync min and max for direct feedback
    handlePadPropertyChange(pad.id, { min: newVal, max: newVal });
  };

  // Scan QR Simulation of leach Pad post tag
  const handleTriggerQrScanSimulation = () => {
    simulateHapticFeedback();
    setIsQrScannerActive(true);
    setQrScanResult(null);
    
    // Simulate camera lockon and tag identification in 1.8 seconds
    setTimeout(() => {
      const luckyIndex = Math.floor(Math.random() * pads.length);
      const targetPad = pads[luckyIndex];
      setQrScanResult(`IDENTIFIED: Leach Pad Cell #${targetPad.id} (${targetPad.feedType} Feed)`);
      setFocusedPadId(targetPad.id);
      setIsQrScannerActive(false);
      setActiveTab("pads");
      // Scroll focused element into view within simulated viewport
      setTimeout(() => {
        const docEl = document.getElementById(`mobile-pad-item-${targetPad.id}`);
        docEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }, 1800);
  };

  // Perform full database sync simulation
  const handleSimulateSyncAction = () => {
    simulateHapticFeedback();
    setIsSimulatingSync(true);
    setTimeout(() => {
      setIsSimulatingSync(false);
      setUnsyncedItemsCount(0);
      setSignalStrength("excellent");
    }, 2000);
  };

  // Metallurgy math calculations
  const acidRequirementMetric = Math.max(0, calcPondVol * (calcTargetAcid - calcCurrentAcid) * 1.05); // kg acid needed approx (adjusted for standard gravity)
  const forecastedCuShiftProduction = Math.max(0, calcPlsFlow * calcCuGrade * (calcRecovery / 100) * 12 * 0.001); // tons copper per 12-hour shift

  // Filtered pads list
  const filteredPadsList = pads.filter(p => {
    const statusMatch = activePadFilter === "all" || p.status === activePadFilter;
    const searchMatch = p.id.toLowerCase().includes(searchPhrase.toLowerCase()) || 
                        (p.feedType || "").toLowerCase().includes(searchPhrase.toLowerCase());
    return statusMatch && searchMatch;
  });

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-start justify-center max-w-6xl mx-auto py-2 px-1">
      
      {/* 1. SIDEBAR BRIEF: Explaining Play-Store readiness and mobile field layout */}
      <div className="flex-1 space-y-4 max-w-md bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
          <Smartphone className="text-teal-400 animate-pulse" size={20} />
          <div>
            <h3 className="font-sans font-black text-xs uppercase tracking-wider text-slate-200">
              Mimbula Field Handheld Simulator
            </h3>
            <span className="text-[9px] font-mono text-teal-400 font-bold uppercase">Google Play Store Ready Sandbox</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed font-sans">
          This simulated environment represents our specialized 
          <strong className="text-white font-semibold"> Mimbula Minerals Mobile Operational Suite </strong>, 
          designed with extreme tactical density for rugged hand-held devices of our field hydraulic teams in Zambia. 
        </p>

        <div className="space-y-2.5 text-xs">
          <div className="flex items-start gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
            <span className="bg-emerald-500/10 text-emerald-400 p-1 rounded font-bold text-[9px] shrink-0 font-mono mt-0.5">M1</span>
            <div>
              <p className="font-bold text-slate-200 uppercase text-[10px]">Haptic Tactile Dials</p>
              <p className="text-slate-400 text-[10.5px]">Adjust flow rates on foot using physical increment dials, configured with simulated vibration responses.</p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
            <span className="bg-cyan-500/10 text-cyan-400 p-1 rounded font-bold text-[9px] shrink-0 font-mono mt-0.5">M2</span>
            <div>
              <p className="font-bold text-slate-200 uppercase text-[10px]">Quick QR Asset Mapping</p>
              <p className="text-slate-400 text-[10.5px]">Operators tap QR labels on physical leach lines to locate specific records. Click scan below to test!</p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
            <span className="bg-indigo-500/10 text-indigo-400 p-1 rounded font-bold text-[9px] shrink-0 font-mono mt-0.5">M3</span>
            <div>
              <p className="font-bold text-slate-200 uppercase text-[10px]">Zambia Airtel Spotty Cache sync</p>
              <p className="text-slate-400 text-[10.5px]">Simulates connectivity drops. Changes are queued offline & auto-push when signals revive matching native app paradigms.</p>
            </div>
          </div>
        </div>

        {/* Quick Simulator Controls directly adjacent */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
          <p className="font-mono text-[9px] text-slate-500 font-bold uppercase tracking-wider">Device Signal Simulator</p>
          <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px] font-bold">
            <button
              onClick={() => { simulateHapticFeedback(); setSignalStrength("excellent"); }}
              className={`py-1 px-2.5 rounded transition-all flex items-center justify-center gap-1 cursor-pointer ${
                signalStrength === "excellent" ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-850"
              }`}
            >
              <Wifi size={10} />
              <span>Full 4G</span>
            </button>
            <button
              onClick={() => { simulateHapticFeedback(); setSignalStrength("fair"); }}
              className={`py-1 px-2.5 rounded transition-all flex items-center justify-center gap-1 cursor-pointer ${
                signalStrength === "fair" ? "bg-amber-600 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-850"
              }`}
            >
              <Wifi size={10} />
              <span>Spotty</span>
            </button>
            <button
              onClick={() => { simulateHapticFeedback(); setSignalStrength("offline"); }}
              className={`py-1 px-2.5 rounded transition-all flex items-center justify-center gap-1 cursor-pointer ${
                signalStrength === "offline" ? "bg-rose-600 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-850"
              }`}
            >
              <WifiOff size={10} />
              <span>Offline</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. HANDHELD SMARTPHONE SHELL MOCKUP CONTAINER */}
      <div 
        className={`relative w-[370px] h-[780px] bg-slate-900 rounded-[50px] border-[12px] border-slate-950 p-3 shadow-2xl shrink-0 flex flex-col justify-between overflow-hidden transition-all duration-300 ${
          showHapticRumble ? "translate-x-0.5 translate-y-0.5 border-teal-500 shadow-[0_0_20px_rgba(20,184,166,0.3)]" : ""
        }`}
      >
        {/* Device Speaker Notch */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 h-5 w-36 bg-slate-950 rounded-b-xl z-50 flex items-center justify-center">
          <div className="w-12 h-1 bg-slate-800 rounded-full mb-1"></div>
        </div>

        {/* Device Top Status Bar (Play Store Native UI format) */}
        <div className="pt-2 px-4 pb-1 mb-1.5 flex items-center justify-between text-[10px] font-mono text-slate-400 font-bold tracking-tight select-none relative z-40 bg-slate-900">
          <span>08:45 CAT</span>
          {/* Mimbula Network Indicator badge */}
          <div className="flex items-center gap-1 bg-slate-950 py-0.5 px-2 rounded-full border border-slate-800/60 font-mono text-[8px] text-teal-400 uppercase">
            <span className="w-1 h-1 rounded-full bg-teal-400 animate-ping"></span>
            <span>Mimbula Private APN</span>
          </div>
          <div className="flex items-center gap-1.5">
            {signalStrength === "excellent" && <Wifi size={11} className="text-emerald-400" />}
            {signalStrength === "fair" && <Wifi size={11} className="text-amber-400 animate-pulse" />}
            {signalStrength === "offline" && <WifiOff size={11} className="text-rose-500 animate-bounce" />}
            <div className="w-4.5 h-2.5 border border-slate-500 rounded-sm flex items-center p-[1px] bg-slate-950">
              <div className="h-full w-4/5 bg-slate-350 rounded-xs"></div>
            </div>
          </div>
        </div>

        {/* DEVICE SIMULATION VIEWPORT SCREEN */}
        <div className="flex-1 bg-slate-950 rounded-[35px] overflow-hidden flex flex-col justify-between relative shadow-inner">
          
          {/* QR SCAN ANIMATION OVERLAY */}
          {isQrScannerActive && (
            <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-center p-6 text-white font-sans text-center">
              <Camera size={44} className="text-teal-400 animate-pulse mb-3" />
              <p className="text-base font-bold tracking-tight uppercase">Activating Field Laser Scanner...</p>
              <p className="text-[10px] text-slate-400 font-mono mt-1">Aim camera at on-site QR/Barcode tag on physical Leach Line bypass valve</p>
              
              <div className="relative w-48 h-48 border-2 border-teal-500/40 rounded-xl my-6 flex items-center justify-center overflow-hidden">
                {/* Horizontal Sweeper line */}
                <div className="absolute left-0 right-0 h-[2px] bg-teal-400 animate-bounce shadow-md shadow-teal-500"></div>
                <div className="absolute inset-5 border border-dashed border-teal-400/20 rounded-md"></div>
                <div className="text-[8px] font-mono text-teal-400 animate-pulse">AUTO-FOCUSING LENS...</div>
              </div>

              <button
                onClick={() => { simulateHapticFeedback(); setIsQrScannerActive(false); }}
                className="mt-2 text-xs font-bold text-rose-400 uppercase tracking-wider py-1 px-3 bg-rose-500/10 rounded-lg border border-rose-500/30"
              >
                Cancel Scanner
              </button>
            </div>
          )}

          {/* APP HEADLINE BANNER PANEL */}
          <div className="bg-slate-900 border-b border-slate-800 p-3 flex items-center justify-between shadow-sm relative z-30">
            <div className="flex items-center gap-2">
              <div className="bg-teal-500 text-slate-900 p-1.5 rounded-lg shrink-0">
                <Database size={14} className="animate-pulse" />
              </div>
              <div className="text-left">
                <h4 className="text-[11px] font-bold font-sans tracking-tight text-white uppercase">Mimbula Handheld</h4>
                <p className="text-[8.5px] font-mono text-emerald-400 mt-0.2 select-none flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Active Live Draft Context</span>
                </p>
              </div>
            </div>

            {/* Quick QR activator action */}
            <button 
              onClick={handleTriggerQrScanSimulation}
              className="py-1 px-2 bg-slate-950 active:bg-slate-850 hover:border-teal-400 rounded-lg border border-slate-800 text-[10px] font-mono font-bold text-teal-400 tracking-tight flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
              title="Simulate scanning a real physical leach pad asset tag code to focus"
            >
              <Camera size={11} />
              <span>SCAN QR</span>
            </button>
          </div>

          {/* MAIN APP BODY CONTENTS SCROLL BOX */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3.5 relative z-20 scrollbar-none">
            
            {/* Quick alert notifications inside mobile app */}
            {qrScanResult && (
              <div className="bg-teal-950/70 border border-teal-500/30 p-2.5 rounded-xl flex items-start gap-2 animate-slide-in">
                <CheckCircle2 size={13} className="text-teal-400 mt-0.5 shrink-0" />
                <div className="text-left leading-tight">
                  <span className="text-[9px] font-bold text-teal-300 font-sans tracking-wide uppercase">ASSET CAPTURED</span>
                  <p className="text-[10px] text-slate-300 font-mono mt-0.5">{qrScanResult}</p>
                </div>
              </div>
            )}

            {/* Render Tab Contents */}
            {activeTab === "pads" && (
              <div className="space-y-3 block">
                {/* Search & filters inside mobile tab */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-500" size={12} />
                    <input
                      type="text"
                      placeholder="Locator search LP..."
                      value={searchPhrase}
                      onChange={e => setSearchPhrase(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-1.5 pl-8 pr-3 text-[10px] font-mono text-white focus:outline-none focus:border-teal-500 placeholder-slate-500"
                    />
                  </div>
                  
                  {/* Segmented status selector chips */}
                  <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                    {(["all", "Active", "Off", "Offline"] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => { simulateHapticFeedback(); setActivePadFilter(f); }}
                        className={`px-2 py-0.5 text-[8.5px] font-mono font-bold rounded-full border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          activePadFilter === f 
                            ? "bg-slate-200 text-slate-900 border-slate-350" 
                            : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                        }`}
                      >
                        {f === "all" ? "SHOW ALL" : f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Leach Pad Scroll Cards */}
                <div className="space-y-2.5">
                  {filteredPadsList.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 font-mono text-[10px]">
                      No matching Leach Pad units found.
                    </div>
                  ) : (
                    filteredPadsList.map(pad => {
                      const isFocused = focusedPadId === pad.id;
                      const isPadActive = pad.status === "Active";
                      const feedColor = pad.feedType === "RAF" ? "text-sky-400 border-sky-900/30 bg-sky-950/20" : "text-indigo-400 border-indigo-900/30 bg-indigo-950/20";
                      
                      return (
                        <div
                          key={pad.id}
                          id={`mobile-pad-item-${pad.id}`}
                          className={`p-3 rounded-2xl border transition-all duration-300 relative ${
                            isFocused 
                              ? "bg-slate-900/90 border-teal-500/70 shadow-[0_0_12px_rgba(20,184,166,0.15)] ring-1 ring-teal-500/40" 
                              : "bg-slate-900/50 border-slate-800"
                          }`}
                        >
                          {/* Anchor anchor dot to highlight focus */}
                          {isFocused && (
                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                            </span>
                          )}

                          {/* Quick Card info row */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black font-mono text-white tracking-wider">{pad.id}</span>
                              <span className={`text-[8px] font-mono font-bold border px-1.5 py-0.2 rounded ${feedColor}`}>
                                {pad.feedType || "RAF"}
                              </span>
                            </div>

                            {/* Status Selector dropdown */}
                            <select
                              value={pad.status}
                              onChange={e => handlePadPropertyChange(pad.id, { status: e.target.value as any })}
                              className={`text-[9px] font-mono font-extrabold rounded-md px-1.5 py-0.5 bg-slate-950 border text-center cursor-pointer ${
                                pad.status === "Active" 
                                  ? "text-sky-400 border-sky-900/70" 
                                  : pad.status === "Off" 
                                  ? "text-amber-500 border-amber-900/50" 
                                  : "text-rose-500 border-rose-950/30"
                              }`}
                            >
                              <option value="Active">ACTIVE</option>
                              <option value="Off">OFF</option>
                              <option value="Offline">OFFLINE</option>
                            </select>
                          </div>

                          {/* Pad Irrigation flow entry slider / tactile controls */}
                          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 mb-2 space-y-1">
                            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                              <span>IRRIGATION FLOW RATE</span>
                              <span className="text-[10.5px] font-bold text-sky-400 font-mono tracking-tight">
                                {pad.min.toFixed(1)} m³/h
                              </span>
                            </div>

                            {/* Dial buttons stepper */}
                            <div className="flex items-center gap-1.5 pt-1.5">
                              <button
                                type="button"
                                disabled={!isPadActive}
                                onClick={() => adjustFlowValue(pad, "down", 5)}
                                className="flex-1 py-1 bg-slate-900 active:bg-slate-800 hover:text-white border border-slate-800 rounded-lg text-slate-400 text-center flex justify-center cursor-pointer disabled:opacity-40"
                              >
                                <Minus size={11} />
                              </button>
                              
                              {/* Direct text input */}
                              <input
                                type="number"
                                disabled={!isPadActive}
                                value={pad.min === 0 ? "" : pad.min}
                                onChange={e => {
                                  const val = parseFloat(e.target.value);
                                  handlePadPropertyChange(pad.id, { min: isNaN(val) ? 0 : val, max: isNaN(val) ? 0 : val });
                                }}
                                className="w-16 bg-slate-900 border border-slate-800 rounded-lg text-center text-xs font-mono font-bold text-white focus:outline-none focus:border-teal-500 py-0.5"
                                placeholder="0.0"
                              />

                              <button
                                type="button"
                                disabled={!isPadActive}
                                onClick={() => adjustFlowValue(pad, "up", 5)}
                                className="flex-1 py-1 bg-slate-900 active:bg-slate-800 hover:text-white border border-slate-800 rounded-lg text-slate-400 text-center flex justify-center cursor-pointer disabled:opacity-40"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                          </div>

                          {/* Split percentages and Totalizer */}
                          <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                            {/* Totalizer */}
                            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/80 flex flex-col justify-center">
                              <span className="text-[8px] text-slate-500 uppercase">Totalizer Reading</span>
                              <input
                                type="text"
                                value={pad.totalizer ?? ""}
                                onChange={e => {
                                  // As requested: ensure pure raw string is bound or cleaned to only contain numbers and dots
                                  const filterRaw = e.target.value.replace(/[^0-9.]/g, ''); 
                                  const parsedVal = parseFloat(filterRaw);
                                  handlePadPropertyChange(pad.id, { totalizer: isNaN(parsedVal) ? 0 : parsedVal });
                                }}
                                className="bg-transparent text-white focus:outline-none font-bold text-xs mt-1 w-full border-b border-slate-800 focus:border-teal-500 text-left py-0.5 placeholder-slate-700"
                                placeholder="0.00 m³"
                              />
                            </div>

                            {/* Splits percents */}
                            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/80 flex flex-col justify-center">
                              <div className="flex justify-between text-[7px] text-slate-500 uppercase tracking-tight">
                                <span>PLS/ILS Splits</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[9px] font-black text-cyan-400">P:{pad.dischargePlsPercent ?? 100}%</span>
                                <span className="h-2 w-[1px] bg-slate-800"></span>
                                <span className="text-[9px] font-black text-indigo-400">I:{pad.dischargeIlsPercent ?? 0}%</span>
                              </div>
                              <div className="flex gap-1.5 mt-1 relative z-10">
                                <button
                                  type="button"
                                  onClick={() => handlePadPropertyChange(pad.id, { dischargePlsPercent: 100, dischargeIlsPercent: 0 })}
                                  className="text-[7px] py-0.5 text-center flex-1 bg-slate-900 border border-slate-800 rounded font-black hover:text-white cursor-pointer active:scale-90"
                                >
                                  PLS
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePadPropertyChange(pad.id, { dischargePlsPercent: 0, dischargeIlsPercent: 100 })}
                                  className="text-[7px] py-0.5 text-center flex-1 bg-slate-900 border border-slate-800 rounded font-black hover:text-white cursor-pointer active:scale-90"
                                >
                                  ILS
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === "ponds" && (
              <div className="space-y-3.5 block">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-black select-none tracking-wider block">Acid Pond Buffer telemetries</span>
                
                {/* 4 Ponds tactile interfaces */}
                {(Object.keys(ponds) as Array<keyof typeof ponds>).map(pondKey => {
                  const pond = ponds[pondKey];
                  // Design theme
                  let pondColor = "from-sky-700 to-sky-950 border-sky-900/50";
                  let textAccent = "text-sky-400";
                  if (pondKey === "ils") {
                    pondColor = "from-indigo-700 to-indigo-950 border-indigo-900/50";
                    textAccent = "text-indigo-400";
                  } else if (pondKey === "crasher") {
                    pondColor = "from-rose-700 to-rose-950 border-rose-900/50";
                    textAccent = "text-rose-400";
                  } else if (pondKey === "mainLine") {
                    pondColor = "from-emerald-700 to-emerald-950 border-emerald-900/50";
                    textAccent = "text-emerald-400";
                  }

                  return (
                    <div key={pond.id} className="bg-slate-900/90 rounded-2xl border border-slate-800 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black font-mono text-white tracking-wide uppercase">{pond.name}</span>
                        <div className="h-1.5 w-16 rounded-full bg-slate-950 overflow-hidden">
                          {/* Volumetric water visual loading representation */}
                          <div 
                            className={`h-full rounded-full bg-gradient-to-r ${pondColor}`} 
                            style={{ width: `${Math.min(100, (pond.flow / 1200) * 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
                        {/* Flow Rate */}
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/85">
                          <span className="text-[8px] text-slate-500 uppercase block">Flow Rate (m³/h)</span>
                          <div className="flex items-center gap-1 mt-1 justify-between">
                            <input
                              type="number"
                              value={pond.flow === 0 ? "" : pond.flow}
                              onChange={e => {
                                const val = parseFloat(e.target.value);
                                handlePondPropertyChange(pond.id, "flow", isNaN(val) ? 0 : val);
                              }}
                              className="bg-transparent text-white font-bold text-xs w-full focus:outline-none"
                              placeholder="0.0"
                            />
                            <span className={`${textAccent} font-bold`}>FLW</span>
                          </div>
                        </div>

                        {/* Totalizer entry - raw format requested: without commas but dot */}
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/85">
                          <span className="text-[8px] text-slate-500 uppercase block">Totalizer (m³)</span>
                          <div className="flex items-center gap-1 mt-1 justify-between">
                            <input
                              type="text"
                              value={pond.totalizer}
                              onChange={e => {
                                const filterRaw = e.target.value.replace(/[^0-9.]/g, ''); 
                                const val = parseFloat(filterRaw);
                                handlePondPropertyChange(pond.id, "totalizer", isNaN(val) ? 0 : val);
                              }}
                              className="bg-transparent text-white font-bold text-xs w-full focus:outline-none"
                              placeholder="0.0"
                            />
                            <span className="text-slate-400 font-bold">TOT</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "schematic" && (
              <div className="space-y-2 block h-[450px]">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold select-none tracking-wider block">Fluid Circuit flow chart</span>
                
                {/* Responsive scaling of pipeline schematic within simulated screen box wrapper */}
                <div className="scale-65 origin-top-left w-[150%] h-[400px] border border-slate-800/50 bg-slate-950 rounded-2xl overflow-hidden">
                  <LivePipelineSVG
                    pads={pads}
                    ponds={ponds}
                    onSelectPad={(id) => {
                      setFocusedPadId(id);
                      setActiveTab("pads");
                    }}
                    onSelectPond={(id) => {
                      setActiveTab("ponds");
                    }}
                  />
                </div>
              </div>
            )}

            {activeTab === "calculators" && (
              <div className="space-y-3.5 block">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-black select-none tracking-wider block">Hydometallurgy Calculators</span>

                {/* 1. Acid addition booster */}
                <div className="bg-slate-900/90 border border-slate-850 p-3 rounded-2xl space-y-2">
                  <span className="text-[10px] font-black text-amber-500 font-mono tracking-tight flex items-center gap-1">
                    <Beaker size={11} />
                    <span>LIME/ACID ESTIMATION TOOL</span>
                  </span>
                  
                  <div className="space-y-2.5 text-[9px] font-mono text-slate-350">
                    <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg">
                      <span>Pond Volume:</span>
                      <div className="flex items-center gap-1 text-white">
                        <input
                          type="number"
                          value={calcPondVol}
                          onChange={e => setCalcPondVol(parseInt(e.target.value) || 0)}
                          className="w-12 text-right bg-slate-900 px-1 border border-slate-800 rounded font-bold focus:outline-none"
                        />
                        <span>m³</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <div className="bg-slate-950 p-1.5 rounded-lg flex flex-col">
                        <span>Current Acid:</span>
                        <div className="flex items-center gap-1 text-white mt-1">
                          <input
                            type="number"
                            step="0.1"
                            value={calcCurrentAcid}
                            onChange={e => setCalcCurrentAcid(parseFloat(e.target.value) || 0)}
                            className="bg-transparent w-full text-xs font-bold focus:outline-none focus:border-b focus:border-teal-500"
                          />
                          <span>g/L</span>
                        </div>
                      </div>
                      <div className="bg-slate-950 p-1.5 rounded-lg flex flex-col">
                        <span>Target Acid:</span>
                        <div className="flex items-center gap-1 text-white mt-1">
                          <input
                            type="number"
                            step="0.1"
                            value={calcTargetAcid}
                            onChange={e => setCalcTargetAcid(parseFloat(e.target.value) || 0)}
                            className="bg-transparent w-full text-xs font-bold focus:outline-none focus:border-b focus:border-teal-500"
                          />
                          <span>g/L</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-xl text-center">
                      <p className="text-[8.5px] uppercase text-slate-500 font-extrabold tracking-wider">Required Raw Sulfuric Acid</p>
                      <p className="text-sm font-black text-emerald-400 mt-1 font-mono">{acidRequirementMetric.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</p>
                      <p className="text-[7.5px] text-slate-400 mt-0.5 mt-1 font-sans">Required to bolster concentrated storage reservoir buffers</p>
                    </div>
                  </div>
                </div>

                {/* 2. Copper recovery yield calculator */}
                <div className="bg-slate-900/90 border border-slate-850 p-3 rounded-2xl space-y-2">
                  <span className="text-[10px] font-black text-sky-400 font-mono tracking-tight flex items-center gap-1">
                    <TrendingUp size={11} className="text-sky-400" />
                    <span>LME ELECTROWINNING HARVEST</span>
                  </span>

                  <div className="space-y-2.5 text-[9px] font-mono text-slate-350">
                    <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg">
                      <span>PLS Stream Flow:</span>
                      <div className="flex items-center gap-1 text-white">
                        <input
                          type="number"
                          value={calcPlsFlow}
                          onChange={e => setCalcPlsFlow(parseInt(e.target.value) || 0)}
                          className="w-12 text-right bg-slate-900 px-1 border border-slate-800 rounded font-bold focus:outline-none"
                        />
                        <span>m³/h</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <div className="bg-slate-950 p-1.5 rounded-lg flex flex-col">
                        <span>Solution Grade (Cu):</span>
                        <div className="flex items-center gap-1 text-white mt-1">
                          <input
                            type="number"
                            step="0.1"
                            value={calcCuGrade}
                            onChange={e => setCalcCuGrade(parseFloat(e.target.value) || 0)}
                            className="bg-transparent w-full text-xs font-bold focus:outline-none focus:border-b focus:border-teal-500"
                          />
                          <span>g/L</span>
                        </div>
                      </div>
                      <div className="bg-slate-950 p-1.5 rounded-lg flex flex-col">
                        <span>SX-EW Recovery:</span>
                        <div className="flex items-center gap-1 text-white mt-1">
                          <input
                            type="number"
                            step="0.5"
                            value={calcRecovery}
                            onChange={e => setCalcRecovery(parseFloat(e.target.value) || 0)}
                            className="bg-transparent w-full text-xs font-bold focus:outline-none focus:border-b focus:border-teal-500"
                          />
                          <span>%</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-xl text-center">
                      <p className="text-[8.5px] uppercase text-slate-500 font-extrabold tracking-wider">Estimated Cathode Harvest / Shift</p>
                      <p className="text-sm font-black text-cyan-400 mt-1 font-mono">{forecastedCuShiftProduction.toFixed(2)} Met Tons Cu</p>
                      <p className="text-[7.5px] text-slate-400 mt-1 font-sans">Computed based on current solution flux across an active 12-hour duty roster cycle</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "sync" && (
              <div className="space-y-3.5 block text-left">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-black select-none tracking-wider block">Operational cloud Synchronization</span>

                <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl space-y-3 font-mono text-[10px] text-slate-300">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="font-bold">APN Connection:</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                      signalStrength === "excellent" 
                        ? "bg-emerald-900 border border-emerald-500/20 text-emerald-400" 
                        : signalStrength === "fair" 
                        ? "bg-amber-900 border border-amber-500/20 text-amber-400" 
                        : "bg-rose-950 border border-rose-500/20 text-rose-500"
                    }`}>
                      {signalStrength === "excellent" ? "Excellent 4G stable" : signalStrength === "fair" ? "Transient / Spotty" : "Offline / Local"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Zambia Carrier:</span>
                    <span className="font-bold text-white">Airtel Zambia MT</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Unsynced Queue Size:</span>
                    <span className={`font-black ${unsyncedItemsCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`}>{unsyncedItemsCount} changes queued</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Cloud Database IP:</span>
                    <span className="text-slate-400">10.144.20.12 (Mining WAN)</span>
                  </div>

                  {unsyncedItemsCount > 0 && (
                    <div className="bg-amber-950/40 p-2.5 rounded-xl border border-amber-900/30 text-[9px] flex items-start gap-1.5">
                      <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-slate-300 leading-normal">
                        Some parameters were collected while cellular signal was offline or unstable. Press sync below to flush queues forcefully to central databases.
                      </p>
                    </div>
                  )}

                  {/* Sync Action button */}
                  <button
                    type="button"
                    onClick={handleSimulateSyncAction}
                    disabled={isSimulatingSync}
                    className={`w-full py-2.5 rounded-xl text-center font-bold font-sans text-xs flex items-center justify-center gap-2 tracking-wide cursor-pointer transition-all active:scale-97 ${
                      isSimulatingSync 
                        ? "bg-amber-600 animate-pulse text-white font-black" 
                        : "bg-teal-500 active:bg-teal-600 text-slate-950 font-black"
                    }`}
                  >
                    <FolderSync size={14} className={isSimulatingSync ? "animate-spin" : ""} />
                    <span>{isSimulatingSync ? "Pushing queues..." : "SYNCHRONIZE TO CLOUD DB"}</span>
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* DEVICE MOBILE TAB NAVIGATION BAR (5-Tab Tactile Menu) */}
          <div className="border-t border-slate-900 bg-slate-900 flex py-1.5 px-1 relative z-30 select-none pb-3">
            
            <button
              onClick={() => { simulateHapticFeedback(); setActiveTab("pads"); }}
              className={`flex-1 flex flex-col items-center gap-0.5 pt-1 text-center transition-all ${
                activeTab === "pads" ? "text-teal-400 font-bold scale-102" : "text-slate-500 hover:text-slate-400"
              }`}
            >
              <Database size={15} />
              <span className="text-[7.5px] font-mono tracking-tight">LeachPads</span>
            </button>

            <button
              onClick={() => { simulateHapticFeedback(); setActiveTab("ponds"); }}
              className={`flex-1 flex flex-col items-center gap-0.5 pt-1 text-center transition-all ${
                activeTab === "ponds" ? "text-teal-400 font-bold scale-102" : "text-slate-500 hover:text-slate-400"
              }`}
            >
              <Beaker size={15} />
              <span className="text-[7.5px] font-mono tracking-tight">AcidPonds</span>
            </button>

            <button
              onClick={() => { simulateHapticFeedback(); setActiveTab("schematic"); }}
              className={`flex-1 flex flex-col items-center gap-0.4 pt-1 text-center transition-all ${
                activeTab === "schematic" ? "text-teal-400 font-bold scale-102" : "text-slate-500 hover:text-slate-400"
              }`}
            >
              <Compass size={15} />
              <span className="text-[7.5px] font-mono tracking-tight">Schema</span>
            </button>

            <button
              onClick={() => { simulateHapticFeedback(); setActiveTab("calculators"); }}
              className={`flex-1 flex flex-col items-center gap-0.5 pt-1 text-center transition-all ${
                activeTab === "calculators" ? "text-teal-400 font-bold scale-102" : "text-slate-500 hover:text-slate-400"
              }`}
            >
              <Zap size={15} />
              <span className="text-[7.5px] font-mono tracking-tight">Calculators</span>
            </button>

            <button
              onClick={() => { simulateHapticFeedback(); setActiveTab("sync"); }}
              className={`flex-1 flex flex-col items-center gap-0.5 pt-1 text-center transition-all relative ${
                activeTab === "sync" ? "text-teal-400 font-bold scale-102" : "text-slate-500 hover:text-slate-400"
              }`}
            >
              {unsyncedItemsCount > 0 && (
                <span className="absolute top-0 right-3 bg-rose-500 rounded-full h-3 w-3 text-[7.5px] text-white flex items-center justify-center font-bold">
                  {unsyncedItemsCount}
                </span>
              )}
              <RefreshCw size={15} className={isSimulatingSync ? "animate-spin text-teal-400" : ""} />
              <span className="text-[7.5px] font-mono tracking-tight">CloudSync</span>
            </button>

          </div>

        </div>

        {/* Smartphone Home Screen Navigation Button strip */}
        <div className="h-6 w-full flex justify-center items-center pb-2 select-none relative z-40 bg-slate-900">
          <button 
            type="button"
            onClick={() => { simulateHapticFeedback(); setActiveTab("pads"); }}
            title="Home button"
            className="w-12 h-1.5 bg-slate-800 hover:bg-slate-700 rounded-full cursor-pointer"
          ></button>
        </div>

      </div>

    </div>
  );
}
