import React, { useMemo, useState } from "react";
import { 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  TrendingDown, 
  Activity, 
  CheckCircle2, 
  HelpCircle, 
  RotateCcw,
  Sparkles,
  Layers,
  ThermometerSnowflake
} from "lucide-react";
import { ShiftTelemetryData, ExtraProcessTelemetry } from "../types";

interface AcidTankAlarmSystemProps {
  history: ShiftTelemetryData[];
  extraTelemetry: ExtraProcessTelemetry;
  onUpdateExtraTelemetry: (val: ExtraProcessTelemetry) => void;
  onSetHistory: (history: ShiftTelemetryData[]) => void;
  onTriggerToast: (message: string, type: "success" | "error" | "info") => void;
}

interface ConsecutiveViolation {
  tankKey: string;
  tankLabel: string;
  durationHours: number;
  levelsHistory: { timeStr: string; level: number }[];
  startTimeStr: string;
  endTimeStr: string;
}

interface HighSurgeViolation {
  tankKey: string;
  tankLabel: string;
  level: number;
  timeStr: string;
  isHistorical: boolean;
}

export default function AcidTankAlarmSystem({
  history,
  extraTelemetry,
  onUpdateExtraTelemetry,
  onSetHistory,
  onTriggerToast
}: AcidTankAlarmSystemProps) {
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  // Map of Tank Keys to human labels
  const TANK_LABELS: Record<string, string> = {
    acidTank1Level: "Bulk Reservoir Tank 1",
    acidTank2Level: "Bulk Reservoir Tank 2",
    acidTank3Level: "Small Dosing Tank 3",
    gyroCrusherAcidTankLevel: "Gyro Crusher Acid Tank",
    jawCrusherAcidTankLevel: "Jaw Crusher Acid Tank"
  };

  const tankKeys = Object.keys(TANK_LABELS);

  const getTimestamp = (dStr: string, tStr: string): number => {
    try {
      const formattedDate = dStr.includes("-") ? dStr : dStr.replace(/\//g, "-");
      const combined = `${formattedDate}T${tStr || "00:00"}`;
      const parsed = Date.parse(combined);
      return isNaN(parsed) ? Date.now() : parsed;
    } catch {
      return Date.now();
    }
  };

  // Analyze historical data + current values to find consecutive low alarms and 95% overages
  const analysis = useMemo(() => {
    // 1. Sort history chronologically
    const sortedHistory = [...history].sort((a, b) => {
      const tA = getTimestamp(a.date, a.time);
      const tB = getTimestamp(b.date, b.time);
      return tA - tB;
    });

    const lowConsecutiveViolations: ConsecutiveViolation[] = [];
    const highSurgeViolations: HighSurgeViolation[] = [];

    // Analyze each tank separately
    tankKeys.forEach((key) => {
      const label = TANK_LABELS[key];

      // Extract state logs for this particular tank
      const logs = sortedHistory.map(item => {
        const val = item.extraTelemetry?.[key as keyof ExtraProcessTelemetry];
        return {
          timeStr: `${item.date} ${item.time}`,
          timestamp: getTimestamp(item.date, item.time),
          level: typeof val === "number" ? val : 0
        };
      });

      // Include current live telemetry if it's not already covered
      const currentValFromLive = extraTelemetry[key as keyof ExtraProcessTelemetry];
      const liveLevel = typeof currentValFromLive === "number" ? currentValFromLive : 0;
      
      const liveTime = new Date();
      const liveTimeStr = `${liveTime.getFullYear()}-${String(liveTime.getMonth() + 1).padStart(2, '0')}-${String(liveTime.getDate()).padStart(2, '0')} ${String(liveTime.getHours()).padStart(2, '0')}:${String(liveTime.getMinutes()).padStart(2, '0')}`;
      
      // If no logs or live is newer, append live
      const liveTimestamp = Date.now();
      const lastLog = logs[logs.length - 1];
      if (!lastLog || liveTimestamp - lastLog.timestamp > 300000) { // older than 5 mins
        logs.push({
          timeStr: "Current (Draft)",
          timestamp: liveTimestamp,
          level: liveLevel
        });
      }

      // Check for High level surge > 95%
      logs.forEach(log => {
        if (log.level > 95) {
          const alreadyAdded = highSurgeViolations.some(v => v.tankKey === key && v.level === log.level && v.timeStr === log.timeStr);
          if (!alreadyAdded) {
            highSurgeViolations.push({
              tankKey: key,
              tankLabel: label,
              level: log.level,
              timeStr: log.timeStr,
              isHistorical: log.timeStr !== "Current (Draft)"
            });
          }
        }
      });

      // Find periods where level drops < 10% for > 4 consecutive hours
      let currentLowStreak: typeof logs = [];
      
      logs.forEach((log) => {
        if (log.level < 10) {
          currentLowStreak.push(log);
        } else {
          // Check if previous low streak had duration > 4 hours
          if (currentLowStreak.length >= 2) {
            const first = currentLowStreak[0];
            const last = currentLowStreak[currentLowStreak.length - 1];
            const durationMs = last.timestamp - first.timestamp;
            const durationHours = durationMs / (1000 * 60 * 60);

            if (durationHours >= 4.0) {
              lowConsecutiveViolations.push({
                tankKey: key,
                tankLabel: label,
                durationHours: Math.round(durationHours * 10) / 10,
                startTimeStr: first.timeStr,
                endTimeStr: last.timeStr,
                levelsHistory: currentLowStreak.map(c => ({ timeStr: c.timeStr, level: c.level }))
              });
            }
          }
          currentLowStreak = [];
        }
      });

      // Check left-over streak at the very end (which extends to current time)
      if (currentLowStreak.length >= 2) {
        const first = currentLowStreak[0];
        const last = currentLowStreak[currentLowStreak.length - 1];
        const durationMs = last.timestamp - first.timestamp;
        const durationHours = durationMs / (1000 * 60 * 60);

        if (durationHours >= 4.0) {
          lowConsecutiveViolations.push({
            tankKey: key,
            tankLabel: label,
            durationHours: Math.round(durationHours * 10) / 10,
            startTimeStr: first.timeStr,
            endTimeStr: last.timeStr,
            levelsHistory: currentLowStreak.map(c => ({ timeStr: c.timeStr, level: c.level }))
          });
        }
      }
    });

    return {
      lowConsecutiveViolations,
      highSurgeViolations,
      isTriggered: lowConsecutiveViolations.length > 0 || highSurgeViolations.length > 0
    };
  }, [history, extraTelemetry]);

  // Simulation handlers to let users easily test the requirement scenarios
  const handleSimulateLowAcid = () => {
    // Generate consecutive shift logs spaced out over 4.5 hours with Tank 1 under 10%
    const nowTime = Date.now();
    const mockShifts: ShiftTelemetryData[] = [];
    const timesOffset = [4.5, 3.0, 1.5, 0]; // 4.5 hrs ago, 3 hrs ago, 1.5 hrs ago, now

    timesOffset.forEach((hoursOffset, idx) => {
      const shiftTime = new Date(nowTime - hoursOffset * 60 * 60 * 1000);
      const hStr = String(shiftTime.getHours()).padStart(2, '0');
      const mStr = String(shiftTime.getMinutes()).padStart(2, '0');
      const dStr = `${shiftTime.getFullYear()}-${String(shiftTime.getMonth() + 1).padStart(2, '0')}-${String(shiftTime.getDate()).padStart(2, '0')}`;

      // Drop level gradually to trigger low consecutive
      const levelValues = [9.5, 8.2, 7.5, 6.8];

      mockShifts.push({
        id: `MOCK-LOW-SHIFT-${idx}`,
        date: dStr,
        time: `${hStr}:${mStr}`,
        operatorEmail: "simulator.operator@mimbula.com",
        operatorName: "Automated Simulator",
        pads: [],
        ponds: {
          raf: { id: "raf", name: "RAF Pond Acid:", totalizer: 1205.5, flow: 125.00 },
          ils: { id: "ils", name: "ILS Pond:", totalizer: 850.2, flow: 90.00 },
          crasher: { id: "crasher", name: "Crasher Acid Bypass:", totalizer: 610.1, flow: 40.00 },
          mainLine: { id: "mainLine", name: "PLS Pond Acid:", totalizer: 2665.8, flow: 255.00 }
        },
        extraTelemetry: {
          ...extraTelemetry,
          acidTank1Level: levelValues[idx], // UNDER 10%
          acidTank2Level: 55.0,
          acidTank3Level: 30.0,
          gyroCrusherAcidTankLevel: 45.0,
          jawCrusherAcidTankLevel: 50.0
        },
        notes: `Simulated backup session for acidity safety audit.`
      });
    });

    onSetHistory([...mockShifts, ...history.filter(h => !h.id.startsWith("MOCK-"))].slice(0, 40));
    
    // Also update dynamic state
    onUpdateExtraTelemetry({
      ...extraTelemetry,
      acidTank1Level: 6.8
    });

    onTriggerToast("Simulated 4+ Hour low acidity levels. Watch the predictive warning report pop up!", "info");
  };

  const handleSimulateHighAcid = () => {
    // Set level to 98% (Exceeds 95%) in active telemetry
    onUpdateExtraTelemetry({
      ...extraTelemetry,
      acidTank2Level: 98.4
    });
    onTriggerToast("Bulk Tank 2 increased to 98.4% (Surge threshold >95%). Visual Alarm online!", "error");
  };

  const handleResetSimulation = () => {
    // Remove mock entries from history and reset levels to standard base
    const cleanedHistory = history.filter(h => !h.id.startsWith("MOCK-"));
    onSetHistory(cleanedHistory);

    onUpdateExtraTelemetry({
      ...extraTelemetry,
      acidTank1Level: 42.5,
      acidTank2Level: 68.0,
      acidTank3Level: 25.0,
      gyroCrusherAcidTankLevel: 55.0,
      jawCrusherAcidTankLevel: 62.0
    });

    onTriggerToast("Simulation data reset. All systems returning to nominal operational buffers.", "success");
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col no-print transition-all">
      {/* Title bar */}
      <div className="bg-slate-900 border-b border-slate-850 px-4.5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`text-red-400 ${analysis.isTriggered ? "animate-bounce" : "animate-pulse"}`} size={16} />
          <div>
            <span className="font-sans font-bold text-xs uppercase tracking-wide text-white">
              Predictive Acidity Intelligence Desk
            </span>
            <p className="text-[10px] text-slate-400 font-mono">Real-time Tank Out-of-Spec & Safe Buffer Triggers</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="text-[9.5px] font-mono hover:text-white font-bold text-blue-400 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded px-2.5 py-1 tracking-wider flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle size={11} />
            {showExplanation ? "CLOSE HELP" : "LEARN LOGIC"}
          </button>
        </div>
      </div>

      {showExplanation && (
        <div className="p-4 bg-blue-50/50 border-b border-slate-100 text-[11px] text-blue-900 space-y-2 font-sans">
          <div className="flex items-center gap-1.5 font-bold">
            <Sparkles size={13} className="text-blue-600" />
            <span>How Predictive Notifications Work:</span>
          </div>
          <p className="leading-relaxed">
            The metallurgy division requires high-tolerance monitoring of concentrated Sulfuric Acid inventories. This automated module actively scans historical logs and real-time telemetry datasets under two key paradigms:
          </p>
          <ul className="list-disc pl-5 space-y-1 font-mono text-[10.5px]">
            <li>
              <strong className="text-rose-700">10% Low Alert:</strong> If any tank registers continuously under 10.00% capacity for <span className="bg-rose-100 text-rose-800 px-1 py-0.2 rounded font-black">more than 4 consecutive hours</span> based on sequential shift logs.
            </li>
            <li>
              <strong className="text-amber-700">95% Overfill Risk:</strong> If any tank surpasses 95.00% of physical capacity, presenting an environmental hazard and lining integrity risk.
            </li>
          </ul>
        </div>
      )}

      {/* Main Alert Body */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Alerts status display (Left) */}
        <div className="md:col-span-8 flex flex-col justify-center min-h-[140px]">
          {analysis.isTriggered ? (
            <div className="space-y-3">
              {/* low hours violations list */}
              {analysis.lowConsecutiveViolations.map((v, idx) => (
                <div 
                  key={`low-${idx}`}
                  className="bg-red-50 border border-red-200/80 rounded-xl p-3.5 flex items-start gap-3 shadow-xxs animate-fadeIn"
                >
                  <div className="p-2 bg-red-500 text-white rounded-lg animate-pulse flex-none self-center">
                    <Clock size={16} />
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="font-sans font-bold text-xs text-red-900 uppercase tracking-wide">
                        CRITICAL DROPOUT: {v.tankLabel}
                      </span>
                      <span className="font-mono bg-red-100 border border-red-300 text-red-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                        {v.durationHours} hrs continuous
                      </span>
                    </div>
                    <p className="text-[11.5px] text-red-800 leading-normal">
                      The tank levels registered below 10.0% limits consecutively from <span className="font-mono font-bold">{v.startTimeStr}</span> to <span className="font-mono font-bold">{v.endTimeStr}</span>. Automated dosing lines face imminent cavitation!
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {v.levelsHistory.map((pt, pIdx) => (
                        <span key={pIdx} className="text-[9.5px] font-mono text-red-650 bg-white/60 border border-red-100 px-1.5 py-0.5 rounded" title={pt.timeStr}>
                          {pt.level.toFixed(1)}%
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* high surge violations list */}
              {analysis.highSurgeViolations.map((v, idx) => (
                <div 
                  key={`high-${idx}`}
                  className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3 shadow-xxs animate-fadeIn"
                >
                  <div className="p-2 bg-amber-500 text-white rounded-lg animate-pulse flex-none self-center">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="font-sans font-bold text-xs text-amber-900 uppercase tracking-wide">
                        HIGH RESERVOIR PRESSURE: {v.tankLabel}
                      </span>
                      <span className="font-mono bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                        SURGE RISK
                      </span>
                    </div>
                    <p className="text-[11.5px] text-amber-800 leading-normal">
                      The tank capacity has reached <span className="font-mono font-black text-rose-700">{v.level.toFixed(1)}%</span> (Threshold: 95.0%) noted at <span className="font-mono font-bold">{v.timeStr}</span>. Halt bulk inlet pump lines to prevent containment failures.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-emerald-100 bg-emerald-50/40 rounded-2xl p-6 text-center flex flex-col items-center justify-center space-y-2 h-full">
              <CheckCircle2 className="text-emerald-500 animate-pulse" size={24} />
              <h4 className="font-sans font-bold text-emerald-900 text-xs uppercase tracking-wide">
                No Predictive Warnings
              </h4>
              <p className="text-[11.5px] text-emerald-800 leading-relaxed max-w-lg">
                Acid inventory telemetry records are stable. Consecutive low events (&lt;10% for &gt;4 hours) and surge states (&gt;95%) are fully clear across the entire historical session dataset.
              </p>
            </div>
          )}
        </div>

        {/* Diagnostic Simulator Controller (Right) */}
        <div className="md:col-span-4 border border-slate-200 bg-white rounded-xl p-3.5 flex flex-col justify-between space-y-3 shadow-xxs">
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity size={11} className="text-teal-500" />
              Acidity Simulation Desk
            </span>
            <p className="text-[10.5px] text-slate-500 leading-normal font-sans">
              Test safety triggers & compliance criteria under the direct oversight of plant chemical engineering audits.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={handleSimulateLowAcid}
              className="w-full py-1.5 px-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xxs font-mono font-bold rounded-lg transition-all active:scale-98 cursor-pointer flex items-center justify-between"
              title="Add 4 low-acid shift reports spaced 1.5 hours apart to trigger alert"
            >
              <span>1. SIMULATE 4-HOUR LOW (&lt;10%)</span>
              <TrendingDown size={11} className="rotate-45" />
            </button>

            <button
              type="button"
              onClick={handleSimulateHighAcid}
              className="w-full py-1.5 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xxs font-mono font-bold rounded-lg transition-all active:scale-98 cursor-pointer flex items-center justify-between"
              title="Set active reservoir levels to 98% capacity to trigger alarm"
            >
              <span>2. SIMULATE SPILL SURGE (&gt;95%)</span>
              <ThermometerSnowflake size={11} className="animate-spin duration-3000" />
            </button>

            <button
              type="button"
              onClick={handleResetSimulation}
              className="w-full py-1.5 px-2.5 bg-slate-900 hover:bg-slate-950 text-white text-xxs font-mono font-bold rounded-lg transition-all active:scale-98 cursor-pointer flex items-center justify-between"
              title="Purge mockup shift items and restore safe reservoirs levels"
            >
              <span>3. CLEANDOWN SIMULATORS</span>
              <RotateCcw size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
