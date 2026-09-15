import { useState, useEffect } from "react";
import { LeachPadNode, PadStatus, FeedType } from "../types";
import { AlertTriangle, PowerOff, ShieldAlert, Zap, FileText, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PadRowProps {
  key?: string | number;
  pad: LeachPadNode;
  onUpdate: (updated: LeachPadNode) => void;
  errorMin?: string;
  errorMax?: string;
  errorStatus?: string;
  errorTotalizer?: string;
}

export default function PadRowItem({ pad, onUpdate, errorMin, errorMax, errorStatus, errorTotalizer }: PadRowProps) {
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(pad.notes || "");

  // Sync state if pad prop updates externally (e.g. historical recall)
  useEffect(() => {
    setNoteText(pad.notes || "");
  }, [pad.notes]);

  // Track previous values for subtle pulsing commitment feedback on change
  const [prevMin, setPrevMin] = useState<number | undefined>(pad.min);
  const [prevMax, setPrevMax] = useState<number | undefined>(pad.max);
  const [prevTotalizer, setPrevTotalizer] = useState<number | undefined>(pad.totalizer);

  const [pulseMin, setPulseMin] = useState(false);
  const [pulseMax, setPulseMax] = useState(false);
  const [pulseTotalizer, setPulseTotalizer] = useState(false);

  useEffect(() => {
    if (pad.min !== prevMin) {
      setPulseMin(true);
      const timer = setTimeout(() => setPulseMin(false), 900);
      setPrevMin(pad.min);
      return () => clearTimeout(timer);
    }
  }, [pad.min, prevMin]);

  useEffect(() => {
    if (pad.max !== prevMax) {
      setPulseMax(true);
      const timer = setTimeout(() => setPulseMax(false), 900);
      setPrevMax(pad.max);
      return () => clearTimeout(timer);
    }
  }, [pad.max, prevMax]);

  useEffect(() => {
    if (pad.totalizer !== prevTotalizer) {
      setPulseTotalizer(true);
      const timer = setTimeout(() => setPulseTotalizer(false), 900);
      setPrevTotalizer(pad.totalizer);
      return () => clearTimeout(timer);
    }
  }, [pad.totalizer, prevTotalizer]);

  const handleSaveNote = () => {
    onUpdate({ ...pad, notes: noteText.trim() || undefined });
    setIsNoteOpen(false);
  };

  const handleClearNote = () => {
    setNoteText("");
    onUpdate({ ...pad, notes: undefined });
    setIsNoteOpen(false);
  };

  // Styles based on status
  const getStatusBg = (status: PadStatus) => {
    switch (status) {
      case "Off":
        return "bg-amber-100/90 hover:bg-amber-100 border-amber-300 text-amber-900";
      case "Offline":
        return "bg-rose-100/90 hover:bg-rose-100 border-rose-300 text-rose-900";
      default:
        return "bg-white hover:bg-slate-50 border-slate-200 text-slate-900";
    }
  };

  const getStatusBadge = (status: PadStatus) => {
    switch (status) {
      case "Off":
        return "bg-amber-500 text-white font-semibold";
      case "Offline":
        return "bg-rose-500 text-white font-semibold";
      default:
        return "bg-sky-600 text-white font-semibold animate-pulse";
    }
  };

  const handleMinChange = (valStr: string) => {
    const val = valStr === "" ? 0 : parseFloat(valStr);
    onUpdate({ ...pad, min: isNaN(val) ? 0 : val });
  };

  const handleMaxChange = (valStr: string) => {
    const val = valStr === "" ? 0 : parseFloat(valStr);
    onUpdate({ ...pad, max: isNaN(val) ? 0 : val });
  };

  const toggleStatus = () => {
    let nextStatus: PadStatus = "Active";
    if (pad.status === "Active") nextStatus = "Off";
    else if (pad.status === "Off") nextStatus = "Offline";
    
    // Automatically set values to 0 if we move away from Active
    const resets = nextStatus !== "Active" ? { min: 0, max: 0 } : {};
    onUpdate({ ...pad, status: nextStatus, ...resets });
  };

  const hasErrors = !!(errorMin || errorMax || errorStatus || errorTotalizer);

  return (
    <tr
      id={`row-${pad.id}`}
      className={`border-b transition-all duration-200 ${
        hasErrors ? "bg-red-50/70 border-l-4 border-l-rose-500" : "even:bg-slate-50/40"
      }`}
    >
      {/* Node ID Column with Quick Notes overlay capability */}
      <td className="px-2 py-2 text-center font-mono font-bold text-slate-800 border-r bg-slate-100/50 w-16 min-w-[70px] relative align-middle">
        <div className="flex flex-col items-center justify-center gap-1">
          <span className="text-slate-900 font-bold text-xs">{pad.id}</span>
          
          <button
            id={`btn-note-toggle-${pad.id}`}
            type="button"
            onClick={() => setIsNoteOpen(!isNoteOpen)}
            className={`px-1 py-0.5 rounded text-[9px] font-sans font-semibold flex items-center gap-0.5 transition-all shadow-sm active:scale-95 border cursor-pointer ${
              pad.notes
                ? "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200"
                : "bg-slate-100/80 border-slate-200 hover:bg-slate-200 text-slate-500 hover:text-slate-700"
            }`}
            title={pad.notes ? `Operational Note: ${pad.notes}` : "Add loop operational note"}
          >
            <FileText size={9} className={pad.notes ? "text-amber-600 animate-pulse" : "text-slate-450"} />
            <span>{pad.notes ? "Note" : "Add"}</span>
          </button>
        </div>

        {/* Floating Mini Overlay */}
        <AnimatePresence>
          {isNoteOpen && (
            <>
              {/* Backing layer to catch clicks and close */}
              <div 
                className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[0.5px] cursor-default" 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsNoteOpen(false);
                }} 
              />
              
              {/* Floating window */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute left-[82px] top-1/2 -translate-y-1/2 w-80 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 p-3.5 text-left font-sans normal-case"
              >
                {/* Arrow pointing left */}
                <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-l border-b border-slate-300 rotate-45" />

                <div className="relative z-10 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-1.5 text-slate-800">
                      <FileText size={13} className="text-indigo-500" />
                      <span className="text-[11px] font-bold tracking-wider uppercase text-slate-700 font-mono">Loop {pad.id} Operational Note</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsNoteOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {/* Textarea */}
                  <div className="space-y-1">
                    <textarea
                      id={`textarea-note-${pad.id}`}
                      value={noteText}
                      maxLength={150}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Enter specific line maintenance, valve adjustments, pressure observations..."
                      className="w-full h-20 px-2.5 py-1.5 text-xs text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-sans bg-slate-50"
                    />
                    <div className="flex justify-between items-center text-[9px] text-slate-400">
                      <span>Max 150 characters</span>
                      <span className="font-mono">{noteText.length}/150</span>
                    </div>
                  </div>

                  {/* Preset quick phrase tagging system */}
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider select-none">Quick-Add Phrases</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Line Clogged",
                        "Adjusted Valve",
                        "Drip Leak",
                        "Nozzle Check",
                        "Inspected/Normal",
                        "Crashed Segment"
                      ].map((phrase) => (
                        <button
                          key={phrase}
                          type="button"
                          onClick={() => {
                            const trimmed = noteText.trim();
                            const separator = trimmed ? ", " : "";
                            const nextText = `${trimmed}${separator}${phrase}`.slice(0, 150);
                            setNoteText(nextText);
                          }}
                          className="px-2 py-0.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-[9.5px] font-medium text-slate-600 transition-colors cursor-pointer active:scale-95"
                        >
                          + {phrase}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Form actions */}
                  <div className="flex justify-between gap-2 border-t border-slate-150 pt-2.5">
                    {pad.notes ? (
                      <button
                        type="button"
                        onClick={handleClearNote}
                        className="px-2.5 py-1 text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 rounded-lg transition-all cursor-pointer"
                      >
                        Clear Note
                      </button>
                    ) : (
                      <div />
                    )}
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsNoteOpen(false)}
                        className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveNote}
                        className="px-2.5 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 rounded-lg transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <Check size={11} />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </td>

      {/* Feed Source Selector Column */}
      <td className="px-3 py-1.5 border-r w-28 min-w-[105px]">
        <div className="flex rounded-md shadow-sm border border-slate-200 overflow-hidden text-[11px] font-mono font-bold h-7">
          <button
            type="button"
            onClick={() => onUpdate({ ...pad, feedType: "RAF" })}
            className={`flex-1 py-1 text-center transition-all duration-150 font-bold ${
              (pad.feedType || "RAF") === "RAF"
                ? "bg-sky-600 text-white shadow-inner"
                : "bg-white text-slate-400 hover:bg-slate-55 hover:text-slate-600"
            }`}
            title="Set Feed Source to RAF (Raffinate)"
          >
            RAF
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ ...pad, feedType: "ILS" })}
            className={`flex-1 py-1 text-center transition-all duration-150 font-bold border-l border-slate-200 ${
              (pad.feedType || "RAF") === "ILS"
                ? "bg-indigo-600 text-white shadow-inner"
                : "bg-white text-slate-400 hover:bg-slate-55 hover:text-slate-600"
            }`}
            title="Set Feed Source to ILS (Intermediate Leach Solution)"
          >
            ILS
          </button>
        </div>
      </td>

      {/* Discharge Target (PLS / ILS %) Column */}
      <td className="px-3 py-1.5 border-r w-44 min-w-[160px]">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-1">
            {/* PLS Input */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono font-extrabold text-emerald-600 uppercase">PLS</span>
              <input
                id={`input-pls-pct-${pad.id}`}
                type="number"
                min="0"
                max="100"
                value={(pad.dischargePlsPercent ?? 100).toFixed(0)}
                onChange={(e) => {
                  let pls = e.target.value === "" ? 0 : parseFloat(e.target.value);
                  if (isNaN(pls)) pls = 0;
                  if (pls < 0) pls = 0;
                  if (pls > 100) pls = 100;
                  onUpdate({
                    ...pad,
                    dischargePlsPercent: pls,
                    dischargeIlsPercent: 100 - pls
                  });
                }}
                className="w-11 text-center py-0.5 px-1 text-xs font-mono font-bold border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition-all"
              />
              <span className="text-[9px] text-slate-400 font-mono">%</span>
            </div>

            <div className="text-slate-300 font-mono text-[9px]">/</div>

            {/* ILS Input */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono font-extrabold text-indigo-600 uppercase">ILS</span>
              <input
                id={`input-ils-pct-${pad.id}`}
                type="number"
                min="0"
                max="100"
                value={(pad.dischargeIlsPercent ?? 0).toFixed(0)}
                onChange={(e) => {
                  let ils = e.target.value === "" ? 0 : parseFloat(e.target.value);
                  if (isNaN(ils)) ils = 0;
                  if (ils < 0) ils = 0;
                  if (ils > 100) ils = 100;
                  onUpdate({
                    ...pad,
                    dischargePlsPercent: 100 - ils,
                    dischargeIlsPercent: ils
                  });
                }}
                className="w-11 text-center py-0.5 px-1 text-xs font-mono font-bold border border-slate-300 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 transition-all"
              />
              <span className="text-[9px] text-slate-400 font-mono">%</span>
            </div>
          </div>

          {/* Combined complementary bar */}
          <div className="h-1.5 w-full bg-slate-100 rounded-full flex overflow-hidden border border-slate-200/50">
            <div
              style={{ width: `${pad.dischargePlsPercent ?? 100}%` }}
              className="bg-emerald-500 transition-all duration-150"
              title={`Discharge to PLS Pond: ${pad.dischargePlsPercent ?? 100}%`}
            />
            <div
              style={{ width: `${pad.dischargeIlsPercent ?? 0}%` }}
              className="bg-indigo-500 transition-all duration-150 border-l border-white/20"
              title={`Discharge to ILS Pond: ${pad.dischargeIlsPercent ?? 0}%`}
            />
          </div>
        </div>
      </td>

      {/* Minimum Flow Rate Input Column */}
      <td className="px-4 py-1.5 border-r relative w-32 min-w-[110px]">
        <div className="flex items-center gap-1.5">
          <input
            id={`input-min-${pad.id}`}
            type="number"
            step="0.01"
            min="0"
            disabled={pad.status !== "Active"}
            value={pad.min === 0 && pad.status !== "Active" ? "0.00" : pad.min}
            onChange={(e) => handleMinChange(e.target.value)}
            placeholder="0.00"
            className={`w-full text-right px-2 py-1 rounded font-mono border focus:outline-none focus:ring-1 transition-all duration-350 ${
              pulseMin
                ? "border-violet-600 ring-2 ring-violet-400 bg-violet-50/50 scale-[1.04] shadow-md z-10 font-bold"
                : pad.status !== "Active"
                ? "bg-slate-100/60 text-slate-500 border-slate-200 cursor-not-allowed"
                : errorMin
                ? "border-rose-500 ring-rose-300 focus:ring-rose-500 focus:border-rose-500 text-rose-900 bg-rose-50"
                : "border-slate-300 focus:ring-slate-400 focus:border-slate-400 text-slate-900 bg-white"
            }`}
          />
          <span className="text-[10px] font-mono font-medium text-slate-400">m³/h</span>
        </div>
        {errorMin && (
          <span className="absolute left-4 bottom-[-1px] text-[9px] text-rose-600 bg-white px-1 leading-none rounded shadow-sm flex items-center gap-0.5 border border-rose-100">
            <ShieldAlert size={8} /> {errorMin}
          </span>
        )}
      </td>

      {/* Hydraulic Separator indicator */}
      <td className="px-2 py-2 text-center text-slate-400 font-mono text-sm font-light select-none w-6">
        -
      </td>

      {/* Maximum Flow Rate Input Column */}
      <td className="px-4 py-1.5 border-r relative w-32 min-w-[110px]">
        <div className="flex items-center gap-1.5">
          <input
            id={`input-max-${pad.id}`}
            type="number"
            step="0.01"
            min="0"
            disabled={pad.status !== "Active"}
            value={pad.max === 0 && pad.status !== "Active" ? "0.00" : pad.max}
            onChange={(e) => handleMaxChange(e.target.value)}
            placeholder="0.00"
            className={`w-full text-right px-2 py-1 rounded font-mono border focus:outline-none focus:ring-1 transition-all duration-350 ${
              pulseMax
                ? "border-violet-600 ring-2 ring-violet-400 bg-violet-50/50 scale-[1.04] shadow-md z-10 font-bold"
                : pad.status !== "Active"
                ? "bg-slate-100/60 text-slate-500 border-slate-200 cursor-not-allowed"
                : errorMax
                ? "border-rose-500 ring-rose-300 focus:ring-rose-500 focus:border-rose-500 text-rose-900 bg-rose-50"
                : "border-slate-300 focus:ring-slate-400 focus:border-slate-400 text-slate-900 bg-white"
            }`}
          />
          <span className="text-[10px] font-mono font-medium text-slate-400">m³/h</span>
        </div>
        {errorMax && (
          <span className="absolute left-4 bottom-[-1px] text-[9px] text-rose-600 bg-white px-1 leading-none rounded shadow-sm flex items-center gap-0.5 border border-rose-100">
            <ShieldAlert size={8} /> {errorMax}
          </span>
        )}
      </td>

      {/* Totalizer Volume Input Column */}
      <td className="px-2.5 py-1.5 border-r relative w-44 min-w-[165px]">
        <div className="flex items-center gap-1.5">
          <input
            id={`input-totalizer-${pad.id}`}
            type="number"
            step="0.01"
            min="0"
            disabled={pad.status === "Offline"}
            value={pad.totalizer === undefined ? "" : pad.totalizer}
            onChange={(e) => {
              const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
              onUpdate({ ...pad, totalizer: val === undefined || isNaN(val) ? undefined : val });
            }}
            placeholder="0.00"
            className={`w-full text-right px-2 py-1 rounded font-mono border focus:outline-none focus:ring-1 transition-all duration-350 ${
              pulseTotalizer
                ? "border-violet-600 ring-2 ring-violet-400 bg-violet-50/50 scale-[1.04] shadow-md z-10 font-bold"
                : pad.status === "Offline"
                ? "bg-slate-100/60 text-slate-500 border-slate-200 cursor-not-allowed"
                : errorTotalizer
                ? "border-rose-500 ring-rose-300 focus:ring-rose-500 focus:border-rose-500 text-rose-900 bg-rose-50"
                : "border-slate-300 focus:ring-slate-400 focus:border-slate-400 text-slate-900 bg-white"
            }`}
          />
          <span className="text-[10px] font-mono font-medium text-slate-400">m³</span>
        </div>
        {errorTotalizer && (
          <span className="absolute left-4 bottom-[-1px] text-[9px] text-rose-600 bg-white px-1 leading-none rounded shadow-sm flex items-center gap-0.5 border border-rose-100">
            <ShieldAlert size={8} /> {errorTotalizer}
          </span>
        )}
      </td>

      {/* Status Mode Column */}
      <td className={`px-4 py-1.5 text-center transition-all ${getStatusBg(pad.status)} w-32 min-w-[115px]`}>
        <button
          id={`btn-status-${pad.id}`}
          type="button"
          onClick={toggleStatus}
          className={`px-3 h-7 min-w-[96px] rounded text-[10px] tracking-wider uppercase font-mono shadow-sm border border-black/10 transition-transform active:scale-95 flex items-center justify-center mx-auto overflow-hidden relative ${getStatusBadge(
            pad.status
          )}`}
          title="Click to cycle status: Active ➔ Off ➔ Offline"
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={pad.status}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.12, ease: "easeInOut" }}
              className="flex items-center justify-center gap-1.5 w-full h-full whitespace-nowrap"
            >
              {pad.status === "Active" && <Zap size={11} className="fill-current" />}
              {pad.status === "Off" && <PowerOff size={11} />}
              {pad.status === "Offline" && <AlertTriangle size={11} />}
              <span>{pad.status === "Active" ? "Active" : pad.status}</span>
            </motion.span>
          </AnimatePresence>
        </button>
        {errorStatus && (
          <div className="text-[8px] text-rose-600 font-medium font-mono mt-0.5 text-center select-none">
            {errorStatus}
          </div>
        )}
      </td>
    </tr>
  );
}
