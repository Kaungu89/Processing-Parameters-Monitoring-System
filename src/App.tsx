import React, { useState, useEffect } from "react";
import { 
  LeachPadNode, 
  PondTelemetry, 
  ValidationError, 
  ShiftTelemetryData, 
  SystemMetrics,
  ExtraProcessTelemetry
} from "./types";
import { 
  getInitialLeachPads, 
  getInitialPonds, 
  validateTelemetry, 
  getShiftHistory, 
  saveShiftToHistory, 
  deleteShiftFromHistory,
  IMAGE_PRESET_PADS,
  IMAGE_PRESET_PONDS,
  DEFAULT_EXTRA_TELEMETRY
} from "./data";

// Extracted Subcomponents
import PadRowItem from "./components/PadRowItem";
import PondCard from "./components/PondCard";
import TelemetryChart from "./components/TelemetryChart";
import TotalizerTrendChart from "./components/TotalizerTrendChart";
import PHTrendChart from "./components/PHTrendChart";
import AcidTankAlarmSystem from "./components/AcidTankAlarmSystem";
import InsightsPanel from "./components/InsightsPanel";
import LivePipelineSVG from "./components/LivePipelineSVG";
import MobileFieldSimulator from "./components/MobileFieldSimulator";
import GoogleDriveSaveModal from "./components/GoogleDriveSaveModal";
import GmailModal from "./components/GmailModal";
import GoogleFormsModal from "./components/GoogleFormsModal";
import { initAuth, getCurrentUser, getAccessToken } from "./services/googleAuthService";
import { 
  saveShiftToFirestore, 
  deleteShiftFromFirestore, 
  subscribeToUserShifts, 
  testFirestoreConnection, 
  syncUserProfile 
} from "./services/firebaseService";
import type { User as FirebaseUser } from "firebase/auth";

// Utility Icons
import { 
  Activity,
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Cloud,
  Database, 
  Download, 
  FileCheck,
  FileSpreadsheet, 
  Flame,
  HelpCircle, 
  History, 
  Layers, 
  LayoutGrid, 
  Mail, 
  RefreshCw, 
  Save, 
  ShieldAlert, 
  ShieldCheck,
  Upload, 
  User, 
  Wrench, 
  Check,
  Power,
  Printer,
  Sliders,
  Sparkles,
  Trash2,
  FileDown,
  Camera,
  Plus,
  Minus,
  Beaker,
  TrendingUp,
  Gauge,
  CloudDownload,
  HardDrive
} from "lucide-react";

export default function App() {
  const leachPadSheetRef = React.useRef<HTMLDivElement>(null);

  // Current Form States pre-populated with last draft or default preset
  const [pads, setPads] = useState<LeachPadNode[]>(() => {
    if (typeof window !== "undefined") {
      const draft = localStorage.getItem("leach_pad_active_session_draft_v2");
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.pads) return parsed.pads;
        } catch (e) {}
      }
    }
    return getInitialLeachPads();
  });

  const [ponds, setPonds] = useState<{
    raf: PondTelemetry;
    ils: PondTelemetry;
    crasher: PondTelemetry;
    mainLine: PondTelemetry;
  }>(() => {
    if (typeof window !== "undefined") {
      const draft = localStorage.getItem("leach_pad_active_session_draft_v2");
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.ponds) return parsed.ponds;
        } catch (e) {}
      }
    }
    return getInitialPonds();
  });

  const [extraTelemetry, setExtraTelemetry] = useState<ExtraProcessTelemetry>(() => {
    if (typeof window !== "undefined") {
      const draft = localStorage.getItem("leach_pad_active_session_draft_v2");
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.extraTelemetry) return { ...DEFAULT_EXTRA_TELEMETRY, ...parsed.extraTelemetry };
        } catch (e) {}
      }
    }
    return { ...DEFAULT_EXTRA_TELEMETRY };
  });

  // Date and Time initialized precisely using live Central Africa Time (CAT, UTC+2) or draft
  const [date, setDate] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const draft = localStorage.getItem("leach_pad_active_session_draft_v2");
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.date) return parsed.date;
        } catch (e) {}
      }
    }
    const now = new Date();
    const utcEpoch = now.getTime();
    const catDate = new Date(utcEpoch + 2 * 3600 * 1000);
    const y = catDate.getUTCFullYear();
    const m = String(catDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(catDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [time, setTime] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const draft = localStorage.getItem("leach_pad_active_session_draft_v2");
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.time) return parsed.time;
        } catch (e) {}
      }
    }
    const now = new Date();
    const utcEpoch = now.getTime();
    const catDate = new Date(utcEpoch + 2 * 3600 * 1000);
    const hh = String(catDate.getUTCHours()).padStart(2, '0');
    const mm = String(catDate.getUTCMinutes()).padStart(2, '0');
    return `${hh}-${mm}`;
  });

  // Real-time Central Africa Time (CAT) Live Clock State
  const [liveCat, setLiveCat] = useState<string>(() => {
    const now = new Date();
    const utcEpoch = now.getTime();
    const catDateObj = new Date(utcEpoch + 2 * 3600 * 1000);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const d = catDateObj.getUTCDate();
    const m = months[catDateObj.getUTCMonth()];
    const y = catDateObj.getUTCFullYear();
    const hh = String(catDateObj.getUTCHours()).padStart(2, '0');
    const mm = String(catDateObj.getUTCMinutes()).padStart(2, '0');
    const ss = String(catDateObj.getUTCSeconds()).padStart(2, '0');
    return `${d}-${m}-${y} ${hh}:${mm}:${ss} CAT`;
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utcEpoch = now.getTime();
      const catDateObj = new Date(utcEpoch + 2 * 3600 * 1000);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const d = catDateObj.getUTCDate();
      const m = months[catDateObj.getUTCMonth()];
      const y = catDateObj.getUTCFullYear();
      const hh = String(catDateObj.getUTCHours()).padStart(2, '0');
      const mm = String(catDateObj.getUTCMinutes()).padStart(2, '0');
      const ss = String(catDateObj.getUTCSeconds()).padStart(2, '0');
      setLiveCat(`${d}-${m}-${y} ${hh}:${mm}:${ss} CAT`);
    };

    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const [operatorEmail, setOperatorEmail] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const draft = localStorage.getItem("leach_pad_active_session_draft_v2");
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.operatorEmail) return parsed.operatorEmail;
        } catch (e) {}
      }
    }
    return "kaungu89@gmail.com";
  });

  const [operatorName, setOperatorName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const draft = localStorage.getItem("leach_pad_active_session_draft_v2");
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.operatorName) return parsed.operatorName;
        } catch (e) {}
      }
    }
    return "Miguel Kaungu";
  });

  const [employmentNumber, setEmploymentNumber] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const draft = localStorage.getItem("leach_pad_active_session_draft_v2");
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.employmentNumber) return parsed.employmentNumber;
        } catch (e) {}
      }
    }
    return "EMP-8274";
  });

  const [notes, setNotes] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const draft = localStorage.getItem("leach_pad_active_session_draft_v2");
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.notes !== undefined) return parsed.notes;
        } catch (e) {}
      }
    }
    return "";
  });

  const [currentShiftId, setCurrentShiftId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const draft = localStorage.getItem("leach_pad_active_session_draft_v2");
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.currentShiftId) return parsed.currentShiftId;
        } catch (e) {}
      }
    }
    return "SHIFT-ACTIVE-SESSION";
  });

  // History & active log state
  const [history, setHistory] = useState<ShiftTelemetryData[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<"all" | "error" | "warning">("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [activeProcessTab, setActiveProcessTab] = useState<"pond_pump" | "acid_tanks" | "ew_advance" | "organic_sx" | "calculators">("pond_pump");

  // Custom expandable operator states: Real-time Leach Pad Wetting Areas key-value store in m²
  const [padAreas, setPadAreas] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("leach_pad_custom_pad_areas");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {}
      }
    }
    return {
      LP1: 4500,
      LP2: 5000,
      LP3: 6000,
      LP4: 12500,
      LP5: 15000,
      LP6: 18000,
      LP7: 16500,
      LP8: 9500,
      LP9: 16000,
      LP10: 12000,
      LP11: 14500,
      LP12: 13500,
    };
  });

  // Save padAreas state dynamically
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("leach_pad_custom_pad_areas", JSON.stringify(padAreas));
    }
  }, [padAreas]);

  // Acid dosing target state in kg/m³ or g/L (sulfuric acid density target)
  const [acidDosingConc, setAcidDosingConc] = useState<number>(5.5);

  // Metal yield estimates
  const [plsCopperGrade, setPlsCopperGrade] = useState<number>(3.8);
  const [sxRecoveryRate, setSxRecoveryRate] = useState<number>(94.5);

  // Auto-save feedback indicators
  const [lastSavedTime, setLastSavedTime] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("leach_pad_last_saved_time");
      return saved || "";
    }
    return "";
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState<boolean>(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState<boolean>(false);
  const [isGmailModalOpen, setIsGmailModalOpen] = useState<boolean>(false);
  const [isFormsModalOpen, setIsFormsModalOpen] = useState<boolean>(false);
  const [gmailInitialTab, setGmailInitialTab] = useState<"handover" | "inbox" | "compose">("handover");
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);

  // Probe Firestore connectivity on mount
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setIsFirestoreConnected(connected);
    });
  }, []);

  // Synchronize Google user state & Real-time Firestore shifts subscription
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
        if (user) {
          setIsCloudSyncing(true);
          // Sync profile to Firestore
          syncUserProfile(
            user.uid, 
            user.email || "", 
            operatorName || undefined, 
            employmentNumber || undefined
          ).catch((e) => console.warn("[Firestore] User profile sync:", e));

          // Attach real-time Firestore listener for shifts
          unsubscribeFirestore = subscribeToUserShifts(
            user.uid,
            (cloudShifts) => {
              setIsCloudSyncing(false);
              setIsFirestoreConnected(true);
              if (cloudShifts.length > 0) {
                // Merge cloud shifts with local records
                setHistory((prev) => {
                  const cloudIds = new Set(cloudShifts.map((s) => s.id));
                  const localOnly = prev.filter((p) => !cloudIds.has(p.id));
                  const combined = [...cloudShifts, ...localOnly];
                  combined.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
                  return combined;
                });
              }
            },
            (err) => {
              setIsCloudSyncing(false);
              console.warn("[Firestore] Shift sync notice:", err);
            }
          );
        }
      },
      () => {
        setGoogleUser(getCurrentUser());
      }
    );
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [operatorName, employmentNumber]);
  const [isSchematicOpen, setIsSchematicOpen] = useState<boolean>(true);
  const [isLeachPadSheetOpen, setIsLeachPadSheetOpen] = useState<boolean>(true);
  const [isPondSectionOpen, setIsPondSectionOpen] = useState<boolean>(true);
  const [isChemicalBalanceOpen, setIsChemicalBalanceOpen] = useState<boolean>(true);
  const [isAdvancedProcessOpen, setIsAdvancedProcessOpen] = useState<boolean>(true);
  const [isTelemetryCompassOpen, setIsTelemetryCompassOpen] = useState<boolean>(true);
  const [isOperatorLogsOpen, setIsOperatorLogsOpen] = useState<boolean>(true);
  const [isHistoricalSubmissionsOpen, setIsHistoricalSubmissionsOpen] = useState<boolean>(true);
  const [isDcsSimulatorOpen, setIsDcsSimulatorOpen] = useState<boolean>(true);
  const [isTotalizerTrendOpen, setIsTotalizerTrendOpen] = useState<boolean>(true);
  const [isPhTrendOpen, setIsPhTrendOpen] = useState<boolean>(true);

  // Load history on startup
  useEffect(() => {
    setHistory(getShiftHistory());
  }, []);

  // Recalculate validation in real-time based on state alterations
  useEffect(() => {
    const computedErrors = validateTelemetry(pads, ponds, extraTelemetry);
    setErrors(computedErrors);
  }, [pads, ponds, extraTelemetry]);

  // AUTO-SAVE EFFECT: Automatically save/update telemetry snapshot records whenever any figure/field changes
  useEffect(() => {
    // Save draft state to avoid progress loss if tab is refreshed
    const draftData = { pads, ponds, extraTelemetry, date, time, operatorEmail, operatorName, employmentNumber, notes, currentShiftId };
    localStorage.setItem("leach_pad_active_session_draft_v2", JSON.stringify(draftData));

    // Compile active snapshot
    const activeSnapshot: ShiftTelemetryData = {
      id: currentShiftId,
      date,
      time,
      operatorEmail,
      operatorName,
      employmentNumber,
      pads,
      ponds,
      extraTelemetry,
      notes: notes || "Telemetry values auto-saved in real-time."
    };

    // Save/update this snapshot inside history
    saveShiftToHistory(activeSnapshot);

    // Silently update history list view
    setHistory(getShiftHistory());

    // Update real-time auto-saved indicators
    setIsSaving(true);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${hh}:${mm}:${ss}`;
    setLastSavedTime(timeStr);
    
    if (typeof window !== "undefined") {
      localStorage.setItem("leach_pad_last_saved_time", timeStr);
    }

    const timer = setTimeout(() => {
      setIsSaving(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [pads, ponds, date, time, operatorEmail, operatorName, employmentNumber, notes, currentShiftId]);

  // Show status toasts
  const triggerToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // High-resolution PNG Capture of the physical Leach Pad Flow Sheet table
  const captureLeachPadSheet = async () => {
    const element = leachPadSheetRef.current;
    if (!element) return;

    // Helper to replace OKLCH & OKLAB color notations with RGB equivalents to prevent html2canvas parsing errors
    const oklabToRgbString = (L: number, a: number, b: number, A: number): string => {
      const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

      const l = Math.pow(Math.max(0, l_), 3);
      const m = Math.pow(Math.max(0, m_), 3);
      const s = Math.pow(Math.max(0, s_), 3);

      let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
      let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
      let b_rgb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

      const fn = (c: number) => {
        const abs = Math.abs(c);
        const corrected = abs > 0.0031308 ? 1.055 * Math.pow(abs, 1 / 2.4) - 0.055 : 12.92 * abs;
        return Math.sign(c) * corrected;
      };

      const R = Math.max(0, Math.min(255, Math.round(fn(r) * 255)));
      const G = Math.max(0, Math.min(255, Math.round(fn(g) * 255)));
      const B = Math.max(0, Math.min(255, Math.round(fn(b_rgb) * 255)));

      return A === 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${A})`;
    };

    const replaceModernColorsWithRgb = (str: string): string => {
      if (!str || typeof str !== "string") return str;
      
      let res = str;

      // Handle OKLCH: oklch(L C H [/ A]) or oklch(L, C, H, A)
      if (res.toLowerCase().includes("oklch")) {
        const oklchRegex = /oklch\(([^)]+)\)/gi;
        res = res.replace(oklchRegex, (match, inner) => {
          const parts = inner.trim().split(/[\s,\/]+/);
          if (parts.length < 3) return match;
          
          let p1 = parts[0];
          let p2 = parts[1];
          let p3 = parts[2];
          let p4 = parts[3];

          let L = p1.endsWith("%") ? parseFloat(p1) / 100 : parseFloat(p1);
          let C = p2 === "none" ? 0 : (p2.endsWith("%") ? parseFloat(p2) / 100 : parseFloat(p2));
          let H = p3 === "none" ? 0 : parseFloat(p3.replace(/deg|rad|grad|turn/gi, ""));
          
          if (isNaN(L)) L = 0;
          if (isNaN(C)) C = 0;
          if (isNaN(H)) H = 0;

          let A = 1;
          if (p4) {
            A = p4.endsWith("%") ? parseFloat(p4) / 100 : parseFloat(p4);
            if (isNaN(A)) A = 1;
          }

          const hRad = (H * Math.PI) / 180;
          const a = C * Math.cos(hRad);
          const b = C * Math.sin(hRad);

          return oklabToRgbString(L, a, b, A);
        });
      }

      // Handle OKLAB: oklab(L a b [/ A]) or oklab(L, a, b, A)
      if (res.toLowerCase().includes("oklab")) {
        const oklabRegex = /oklab\(([^)]+)\)/gi;
        res = res.replace(oklabRegex, (match, inner) => {
          const parts = inner.trim().split(/[\s,\/]+/);
          if (parts.length < 3) return match;
          
          let p1 = parts[0];
          let p2 = parts[1];
          let p3 = parts[2];
          let p4 = parts[3];

          let L = p1.endsWith("%") ? parseFloat(p1) / 100 : parseFloat(p1);
          let a = p2 === "none" ? 0 : (p2.endsWith("%") ? parseFloat(p2) / 100 : parseFloat(p2));
          let b = p3 === "none" ? 0 : (p3.endsWith("%") ? parseFloat(p3) / 100 : parseFloat(p3));
          
          if (isNaN(L)) L = 0;
          if (isNaN(a)) a = 0;
          if (isNaN(b)) b = 0;

          let A = 1;
          if (p4) {
            A = p4.endsWith("%") ? parseFloat(p4) / 100 : parseFloat(p4);
            if (isNaN(A)) A = 1;
          }

          return oklabToRgbString(L, a, b, A);
        });
      }

      return res;
    };

    const colorProperties = ["color", "backgroundColor", "borderColor", "borderTopColor", "borderBottomColor", "borderLeftColor", "borderRightColor", "outlineColor", "stroke", "fill"];
    
    // Abstract patch applier to run overrides inside both the main context and the html2canvas iframe context
    const patchWindowObjects = (win: any) => {
      if (!win) return;
      
      const origGetComputedStyle = win.getComputedStyle;
      if (origGetComputedStyle) {
        win.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
          const style = origGetComputedStyle.call(win, elt, pseudoElt);
          return new Proxy(style, {
            get(target, prop, receiver) {
              if (prop === "getPropertyValue") {
                return function (propertyName: string) {
                  const val = target.getPropertyValue.call(target, propertyName);
                  return replaceModernColorsWithRgb(val);
                };
              }
              const val = target[prop as any];
              if (typeof val === "function") {
                return val.bind(target);
              }
              if (typeof val === "string") {
                return replaceModernColorsWithRgb(val);
              }
              return val;
            }
          });
        };
      }

      const cssStyleProto = win.CSSStyleDeclaration ? win.CSSStyleDeclaration.prototype : null;
      if (cssStyleProto) {
        const origGetPropertyValue = cssStyleProto.getPropertyValue;
        if (origGetPropertyValue) {
          cssStyleProto.getPropertyValue = function (propertyName: string) {
            const val = origGetPropertyValue.call(this, propertyName);
            return replaceModernColorsWithRgb(val);
          };
        }

        const origDeclCssTextDesc = Object.getOwnPropertyDescriptor(cssStyleProto, "cssText");
        if (origDeclCssTextDesc && origDeclCssTextDesc.get) {
          Object.defineProperty(cssStyleProto, "cssText", {
            get() {
              const val = origDeclCssTextDesc.get!.call(this);
              return replaceModernColorsWithRgb(val);
            },
            set(newVal) {
              if (origDeclCssTextDesc.set) {
                origDeclCssTextDesc.set.call(this, newVal);
              }
            },
            configurable: true
          });
        }

        colorProperties.forEach((prop) => {
          const desc = Object.getOwnPropertyDescriptor(cssStyleProto, prop);
          if (desc) {
            Object.defineProperty(cssStyleProto, prop, {
              get() {
                const val = desc.get ? desc.get.call(this) : (this as any)[`_${prop}`];
                return replaceModernColorsWithRgb(val);
              },
              set(newVal) {
                if (desc.set) {
                  desc.set.call(this, newVal);
                } else {
                  (this as any)[`_${prop}`] = newVal;
                }
              },
              configurable: true,
              enumerable: true
            });
          }
        });
      }

      const cssRuleProto = win.CSSRule ? win.CSSRule.prototype : null;
      if (cssRuleProto) {
        const origCssRuleCssTextDesc = Object.getOwnPropertyDescriptor(cssRuleProto, "cssText");
        if (origCssRuleCssTextDesc && origCssRuleCssTextDesc.get) {
          Object.defineProperty(cssRuleProto, "cssText", {
            get() {
              const val = origCssRuleCssTextDesc.get!.call(this);
              return replaceModernColorsWithRgb(val);
            },
            configurable: true
          });
        }
      }
    };

    const originalGetComputedStyle = window.getComputedStyle;
    const originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
    const originalDeclCssTextDesc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, "cssText");
    
    const cssRuleProto = typeof CSSRule !== "undefined" ? CSSRule.prototype : undefined;
    const originalCssRuleCssTextDesc = cssRuleProto ? Object.getOwnPropertyDescriptor(cssRuleProto, "cssText") : undefined;

    const originalDescriptors: Record<string, PropertyDescriptor | undefined> = {};
    colorProperties.forEach((prop) => {
      originalDescriptors[prop] = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, prop);
    });

    // Patch the main window context
    patchWindowObjects(window);

    try {
      const html2canvasModule = await import("html2canvas");
      const html2canvas = html2canvasModule.default;
      
      const canvas = await html2canvas(element, {
        scale: 2, // 2x Retina scaling for high-resolution clarity
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        onclone: (clonedDoc) => {
          // Hide button overlay/legends if needed during capture
          const clonedBtn = clonedDoc.getElementById("btn-lp-capture");
          if (clonedBtn) {
            clonedBtn.style.display = "none";
          }

          // Force copy the real-time values of all input, select, and textarea elements to the cloned DOM
          try {
            const originalInputs = element.querySelectorAll("input, select, textarea");
            const clonedInputs = clonedDoc.querySelectorAll("input, select, textarea");
            originalInputs.forEach((origInput, idx) => {
              const clonedInput = clonedInputs[idx] as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
              if (clonedInput && origInput) {
                clonedInput.value = (origInput as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
                // Also copy checked states just in case checkboxes are present
                if ('checked' in clonedInput && 'checked' in origInput) {
                  (clonedInput as HTMLInputElement).checked = (origInput as HTMLInputElement).checked;
                }
              }
            });
          } catch (e) {
            console.error("Error copying live input values into html2canvas clone:", e);
          }

          // Fully sanitize all oklch values from style tags within the cloned document!
          try {
            const styleTags = clonedDoc.querySelectorAll("style");
            styleTags.forEach((styleEl) => {
              if (styleEl.textContent) {
                styleEl.textContent = replaceModernColorsWithRgb(styleEl.textContent);
              }
            });
          } catch (e) {
            console.error("Error sanitizing style element textContent in clone:", e);
          }

          // Apply matching overrides to the iframe window context
          const iframeWin = clonedDoc.defaultView;
          if (iframeWin) {
            try {
              patchWindowObjects(iframeWin);
            } catch (err) {
              console.error("Error applying oklch overrides inside the html2canvas clone context:", err);
            }
          }
        }
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          const dateStr = new Date().toISOString().split("T")[0];
          link.download = `LeachPad_FlowSheet_Snapshot_${dateStr}.png`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          triggerToast("Successfully captured Leach Pad Flow Sheet snapshot!", "success");
        }
      }, "image/png");
    } catch (error) {
      console.error("Failed to capture Leach Pad Flow Sheet: ", error);
      triggerToast("Error capturing Leach Pad Flow Sheet PNG snapshot.", "error");
    } finally {
      // Restore original computed styles
      window.getComputedStyle = originalGetComputedStyle;
      CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;
      
      // Restore original descriptors
      Object.keys(originalDescriptors).forEach((prop) => {
        const desc = originalDescriptors[prop];
        if (desc) {
          Object.defineProperty(CSSStyleDeclaration.prototype, prop, desc);
        } else {
          // If no descriptor previously, delete patch to restore default prototype behavior
          delete (CSSStyleDeclaration.prototype as any)[prop];
        }
      });

      if (originalDeclCssTextDesc) {
        Object.defineProperty(CSSStyleDeclaration.prototype, "cssText", originalDeclCssTextDesc);
      } else {
        delete (CSSStyleDeclaration.prototype as any).cssText;
      }

      if (cssRuleProto && originalCssRuleCssTextDesc) {
        Object.defineProperty(cssRuleProto, "cssText", originalCssRuleCssTextDesc);
      } else if (cssRuleProto) {
        delete (cssRuleProto as any).cssText;
      }
    }
  };

  // Preset Handler: Restore screenshot baseline default
  const handleLoadBaselinePreset = () => {
    setPads(getInitialLeachPads());
    setPonds(getInitialPonds());
    setDate("2026-05-28");
    setTime("05:43");
    setNotes("Screenshot default calibration preloaded successfully.");
    setCurrentShiftId("SHIFT-ACTIVE-SESSION");
    triggerToast("Loaded 28-May-2026 baseline calibration data preset.", "success");
  };

  // Preset Handler: Empty form values for clean input session
  const handleClearAllInputs = () => {
    const emptyPads = pads.map(p => ({ ...p, min: 0, max: 0, status: "Off" as const }));
    const emptyPonds = {
      raf: { ...ponds.raf, totalizer: 0, flow: 0 },
      ils: { ...ponds.ils, totalizer: 0, flow: 0 },
      crasher: { ...ponds.crasher, totalizer: 0, flow: 0 },
      mainLine: { ...ponds.mainLine, totalizer: 0, flow: 0 },
    };
    setPads(emptyPads);
    setPonds(emptyPonds);
    setNotes("");
    setCurrentShiftId("SHIFT-ACTIVE-SESSION"); // Back to default session channel
    triggerToast("Cleared all inputs. Operators may write clean flows.", "info");
  };

  // Preset Handler: Load Storm Runoff Surge Scenario
  const handleLoadStormSurgeScenario = () => {
    const stormPads = getInitialLeachPads().map(p => {
      if (p.status === "Active") {
        return {
          ...p,
          min: Number((p.min * 1.3).toFixed(1)),
          max: Number((p.max * 1.35).toFixed(1))
        };
      }
      return p;
    });
    const stormPonds = {
      raf: { id: "raf", name: "RAF Pond Acid", totalizer: 5122.33, flow: 120.00 },
      ils: { id: "ils", name: "ILS Pond Acid", totalizer: 9945.12, flow: 140.00 },
      crasher: { id: "crasher", name: "Acid to Crasher", totalizer: 41220.50, flow: 147.00 },
      mainLine: { id: "mainLine", name: "Main Line", totalizer: 8940.00, flow: 1450.00 },
    };
    setPads(stormPads);
    setPonds(stormPonds);
    setExtraTelemetry({
      ...extraTelemetry,
      plsPondLevel: 92.4, // ultra-high level alert
      rafPondLevel: 95.8, // ultra-high level alert
      ilsPondLevel: 91.1, // ultra-high level alert
      stormWaterPondLevel: 88.5, // high alert
      plsFlowToSx: 745.0, // close to limit
      totalRaffinateFlow: 920.00,
      totalIlsFlow: 890.00,
      plsPumpSpeed: 95.2,
      ilsPumpSpeed: 91.4,
      rafPumpSpeed: 96.0,
    });
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    setTime("14:30");
    setNotes("SAFETY COMPLIANCE: Heavy storm front has precipitated 45mm rainfall. System under high hydration containment. Recirculating emergency storm runoff and storm surge water to buffers.");
    setCurrentShiftId("SHIFT-SCENARIO-STORM");
    triggerToast("Scenario Preloaded: Heavy Storm Runoff Surge active. Check alarms!", "info");
  };

  // Preset Handler: Load Acid Inventory Supply Outage Scenario
  const handleLoadAcidCrisisScenario = () => {
    setPads(getInitialLeachPads());
    setPonds(getInitialPonds());
    setExtraTelemetry({
      ...extraTelemetry,
      acidTank1Level: 6.8, // critical alarm triggered (< 15%)
      acidTank2Level: 11.2, // warning alert (< 15%)
      acidTank3Level: 3.5, // critical alarm
      gyroCrusherAcidTankLevel: 14.2,
      jawCrusherAcidTankLevel: 12.0,
    });
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    setTime("02:15");
    setNotes("CRITICAL: Raw acid supply delivery delayed at the railhead terminus. Initiated rationing of heap irrigation systems. Re-routing low pH flows and recirculating to avoid dry chokes.");
    setCurrentShiftId("SHIFT-SCENARIO-ACID");
    triggerToast("Scenario Preloaded: Acid Reservoir Exhaustion Active!", "error");
  };

  // Preset Handler: Load Localized Line Blockage Scenario
  const handleLoadBlockageScenario = () => {
    const blockedPads = getInitialLeachPads().map(p => {
      if (p.id === "LP4" || p.id === "LP5") {
        return { ...p, min: 0.00, max: 0.00, status: "Active" as const };
      }
      return p;
    });
    setPads(blockedPads);
    setPonds(getInitialPonds());
    setExtraTelemetry({
      ...extraTelemetry,
      plsPumpSpeed: 84.5, // actively pumping
      plsFlowToSx: 0, // BUT zero output flow -> Cavitation/blockage alert!
      plsPondLevel: 75.2,
    });
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    setTime("18:45");
    setNotes("OPERATIONAL FAULT: Indicated hydraulic blockages or valve lockups on active pads LP4 and LP5 (flow rate shows 0 m³/h despite ACTIVE status). Main PLS discharge pump speed is elevated at 84.5% but yielding zero flow.");
    setCurrentShiftId("SHIFT-SCENARIO-BLOCKAGE");
    triggerToast("Scenario Preloaded: Mechanical blockages & cavitation active!", "info");
  };

  // Save telemetry submission to Local Storage database & Firebase Firestore
  const handleSaveShift = async () => {
    // Block saving if there are fatal errors
    const fatalErrors = errors.filter(e => e.type === "error");
    if (fatalErrors.length > 0) {
      triggerToast(`Could not record entry. Please resolve ${fatalErrors.length} validation errors first.`, "error");
      return;
    }

    const freshId = "SHIFT-" + Date.now();
    const newSnapshot: ShiftTelemetryData = {
      id: freshId,
      date,
      time,
      operatorEmail,
      operatorName,
      employmentNumber,
      pads,
      ponds,
      extraTelemetry,
      notes: notes || "Telemetry values verified on site & certified active."
    };

    saveShiftToHistory(newSnapshot);
    setHistory(getShiftHistory());
    setCurrentShiftId(freshId); // Make subsequent edits sync inside this frozen record

    if (googleUser) {
      try {
        setIsCloudSyncing(true);
        await saveShiftToFirestore(newSnapshot, googleUser.uid);
        setIsCloudSyncing(false);
        setIsFirestoreConnected(true);
        triggerToast("Telemetry shift log successfully recorded to Firebase Firestore!", "success");
      } catch (err) {
        setIsCloudSyncing(false);
        console.error("Firestore save error:", err);
        triggerToast("Saved locally. Cloud sync will retry when online.", "info");
      }
    } else {
      triggerToast("Telemetry shift log successfully recorded to local process storage.", "success");
    }
  };

  // Reload an historical report back into main active states
  const handleReloadHistory = (record: ShiftTelemetryData) => {
    setPads(record.pads);
    setPonds(record.ponds);
    setDate(record.date);
    setTime(record.time);
    setOperatorEmail(record.operatorEmail);
    if (record.operatorName) {
      setOperatorName(record.operatorName);
    }
    if (record.employmentNumber) {
      setEmploymentNumber(record.employmentNumber);
    }
    setNotes(record.notes || "");
    setExtraTelemetry({ ...DEFAULT_EXTRA_TELEMETRY, ...(record.extraTelemetry || {}) });
    triggerToast(`Reloaded Telemetry log from shift at: ${record.date} ${record.time}`, "info");
  };

  // Delete log from history list (locally and from Firestore if logged in)
  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering card reload
    deleteShiftFromHistory(id);
    setHistory(getShiftHistory());

    if (googleUser) {
      try {
        await deleteShiftFromFirestore(id);
        triggerToast("Telemetry log successfully purged from Firebase & local storage.", "info");
      } catch (err) {
        console.warn("Firestore delete notice:", err);
        triggerToast("Telemetry log purged from local storage.", "info");
      }
    } else {
      triggerToast("Telemetry log successfully purged.", "info");
    }
  };

  // Import shift telemetry data directly from Google Forms response
  const handleImportShiftFromForm = (importedData: {
    operatorName?: string;
    employmentNumber?: string;
    notes?: string;
    rafLevel?: number;
    ilsLevel?: number;
    crasherLevel?: number;
    mainLineFlow?: number;
    cuGrade?: number;
    acidLevel?: number;
  }) => {
    if (importedData.operatorName) setOperatorName(importedData.operatorName);
    if (importedData.employmentNumber) setEmploymentNumber(importedData.employmentNumber);
    if (importedData.notes) setNotes((prev) => (prev ? `${prev}\n\n${importedData.notes}` : importedData.notes || ""));
    
    if (importedData.rafLevel !== undefined) {
      setPonds((prev) => ({
        ...prev,
        raf: { ...prev.raf, level: importedData.rafLevel! }
      }));
    }
    if (importedData.ilsLevel !== undefined) {
      setPonds((prev) => ({
        ...prev,
        ils: { ...prev.ils, level: importedData.ilsLevel! }
      }));
    }
    if (importedData.crasherLevel !== undefined) {
      setPonds((prev) => ({
        ...prev,
        crasher: { ...prev.crasher, level: importedData.crasherLevel! }
      }));
    }
    if (importedData.mainLineFlow !== undefined || importedData.cuGrade !== undefined || importedData.acidLevel !== undefined) {
      setExtraTelemetry((prev) => ({
        ...prev,
        ...(importedData.mainLineFlow !== undefined ? { mainLineHeaderFlow: importedData.mainLineFlow } : {}),
        ...(importedData.cuGrade !== undefined ? { cuHeadGrade: importedData.cuGrade } : {}),
        ...(importedData.acidLevel !== undefined ? { acidTankLevel: importedData.acidLevel } : {}),
      }));
    }
  };

  // Real-time calculation parameters for plant operators
  const activePads = pads.filter(p => p.status === "Active");
  const totalActiveFlowMinSum = activePads.reduce((sum, p) => sum + p.min, 0);
  const totalActiveFlowMaxSum = activePads.reduce((sum, p) => sum + p.max, 0);
  
  // Feed source totals
  const totalRafFeedMin = activePads.filter(p => (p.feedType || "RAF") === "RAF").reduce((sum, p) => sum + p.min, 0);
  const totalRafFeedMax = activePads.filter(p => (p.feedType || "RAF") === "RAF").reduce((sum, p) => sum + p.max, 0);
  const totalIlsFeedMin = activePads.filter(p => (p.feedType || "RAF") === "ILS").reduce((sum, p) => sum + p.min, 0);
  const totalIlsFeedMax = activePads.filter(p => (p.feedType || "RAF") === "ILS").reduce((sum, p) => sum + p.max, 0);

  // Discharge target totals
  const totalPlsDischargeMin = activePads.reduce((sum, p) => sum + (p.min * (p.dischargePlsPercent ?? 100)) / 100, 0);
  const totalPlsDischargeMax = activePads.reduce((sum, p) => sum + (p.max * (p.dischargePlsPercent ?? 100)) / 100, 0);
  const totalIlsDischargeMin = activePads.reduce((sum, p) => sum + (p.min * (p.dischargeIlsPercent ?? 0)) / 100, 0);
  const totalIlsDischargeMax = activePads.reduce((sum, p) => sum + (p.max * (p.dischargeIlsPercent ?? 0)) / 100, 0);

  const padAverageFlow = activePads.length > 0
    ? activePads.reduce((sum, p) => sum + (p.min + p.max) / 2, 0) / activePads.length
    : 0;
  
  // Imbalance computation (spread spread across active ones)
  const activeFlowRates = activePads.map(p => (p.min + p.max) / 2);
  const flowSpread = activeFlowRates.length > 0 
    ? Math.max(...activeFlowRates) - Math.min(...activeFlowRates)
    : 0;

  // Mass Balance Indicator (RAF flow + ILS flow compared to CRASHER flow or Main line)
  const pondWaterOutSum = ponds.raf.flow + ponds.ils.flow + ponds.crasher.flow;

  // Chemical balance calculations (RAF to ILS flow ratio across all pads based on averages)
  const avgRafFeed = (totalRafFeedMin + totalRafFeedMax) / 2;
  const avgIlsFeed = (totalIlsFeedMin + totalIlsFeedMax) / 2;
  const activeRafPadsCount = activePads.filter(p => (p.feedType || "RAF") === "RAF").length;
  const activeIlsPadsCount = activePads.filter(p => (p.feedType || "RAF") === "ILS").length;
  
  const padRatio = avgIlsFeed > 0 ? (avgRafFeed / avgIlsFeed) : null;
  const targetMin = 0.5;
  const targetMax = 2.0;
  
  let padBalanceStatus: "optimal" | "warning" | "error" | "neutral" = "optimal";
  let padBalanceMsg = "";
  
  if (activePads.length === 0) {
    padBalanceStatus = "neutral";
    padBalanceMsg = "Leach pad loop operations currently set to Offline.";
  } else if (avgRafFeed === 0 && avgIlsFeed === 0) {
    padBalanceStatus = "neutral";
    padBalanceMsg = "Leach pad feed lines active, but irrigation flows are zero.";
  } else if (avgIlsFeed === 0) {
    padBalanceStatus = "warning";
    padBalanceMsg = "Raffinate-Only Mode: Pads are running 100% on raw Acid RAF solution. Co-recirculation is disabled.";
  } else if (padRatio !== null) {
    if (padRatio < targetMin) {
      padBalanceStatus = "error";
      padBalanceMsg = `Under-acidified Shift Drift Alert: Current ratio (${padRatio.toFixed(2)}) is below minimal safe limit (${targetMin}). Increase Raffinate acidic flow to protect recovery.`;
    } else if (padRatio > targetMax) {
      padBalanceStatus = "error";
      padBalanceMsg = `Over-acidified Shift Drift Alert: Current ratio (${padRatio.toFixed(2)}) is above maximal safe limit (${targetMax}). Reduce Raffinate acidic flow to prevent clay blinding.`;
    } else {
      padBalanceStatus = "optimal";
      padBalanceMsg = `Optimal Blending: Current ratio of ${padRatio.toFixed(2)} is balanced correctly within safe operational parameters (0.50 - 2.00).`;
    }
  }

  // Real-time Auto-Fix telemetry handler
  const handleApplyAutoFix = (error: ValidationError) => {
    if (error.id.includes("_min_greater_max")) {
      // Swapping values
      const padId = error.field.split("_")[0];
      const targetPad = pads.find(p => p.id === padId);
      if (targetPad) {
        setPads(pads.map(p => p.id === padId ? { ...p, min: targetPad.max, max: targetPad.min } : p));
        triggerToast(`Auto-corrected: Swapped Min & Max flows on ${padId}`, "success");
      }
    } else if (error.id.includes("_active_zero")) {
      // Toggle status to Off
      const padId = error.field.split("_")[0];
      setPads(pads.map(p => p.id === padId ? { ...p, status: "Off" as const } : p));
      triggerToast(`Auto-corrected: Set status of inactive flow ${padId} to Off`, "success");
    } else if (error.id.includes("_inactive_non_zero")) {
      // Enable Active status
      const padId = error.field.split("_")[0];
      setPads(pads.map(p => p.id === padId ? { ...p, status: "Active" as const } : p));
      triggerToast(`Auto-corrected: Enabled 'Active' on flowing line ${padId}`, "success");
    } else if (error.id.includes("_neg_")) {
      // Convert negative inputs to absolute positive values
      const prefix = error.field.split("_")[0];
      if (prefix.startsWith("LP")) {
        setPads(pads.map(p => p.id === prefix 
          ? { ...p, min: Math.abs(p.min), max: Math.abs(p.max) } 
          : p
        ));
      } else {
        const pondKey = prefix as "raf" | "ils" | "crasher" | "mainLine";
        setPonds({
          ...ponds,
          [pondKey]: {
            ...ponds[pondKey],
            totalizer: Math.abs(ponds[pondKey].totalizer),
            flow: Math.abs(ponds[pondKey].flow)
          }
        });
      }
      triggerToast("Auto-corrected: Reverted absolute positive value.", "success");
    }
  };

  // Save raw data to JSON file
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify({ date, time, pads, ponds, notes, operatorEmail, operatorName, employmentNumber }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `LeachPad_Telemetry_${date}_${time}.json`;
    link.click();
    triggerToast("Telemetry JSON log downloaded successfully.", "success");
  };

  // Save current table report into formatted comma-separated CSV format
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Leach Pad Telemetry Report\r\n";
    csvContent += `Generated,${date} ${time}\r\n`;
    csvContent += `Operator Name,${operatorName}\r\n`;
    csvContent += `Employment Number,${employmentNumber}\r\n`;
    csvContent += `Operator Email,${operatorEmail}\r\n\r\n`;
    csvContent += "Pad ID,Feed Source,Min Flow (m3/h),Max Flow (m3/h),Totalizer (m3),PLS Split %,ILS Split %,Status\r\n";
    pads.forEach(p => {
      csvContent += `${p.id},${p.feedType || "RAF"},${p.min},${p.max},${p.totalizer ?? ""},${p.dischargePlsPercent ?? 100},${p.dischargeIlsPercent ?? 0},${p.status}\r\n`;
    });
    csvContent += "\r\n";
    csvContent += "Pond System,Totalizer (m3),Flow Rate (m3/h)\r\n";
    (Object.values(ponds) as PondTelemetry[]).forEach(p => {
      csvContent += `${p.name},${p.totalizer},${p.flow}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `LeachPad_Report_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast("Telemetry CSV spreadsheet exported successfully.", "success");
  };

  // Generate programmatic, formatted printable PDF Shift Report via jsPDF
  const handleExportPDF = async () => {
    try {
      triggerToast("Preparing printable shift handover report PDF...", "info");
      
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // ~210mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // ~297mm
      
      // Let's first capture the telemetry SVG chart if it exists
      const svgElement = document.getElementById("telemetry-chart-svg");
      let chartImgData: string | null = null;

      if (svgElement) {
        try {
          const width = 800;
          const height = 240;
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
            .text-\\[9px\\] { font-size: 9px; }
            .text-\\[8px\\] { font-size: 8px; }
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

          await new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const scale = 2.0;
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
                chartImgData = canvas.toDataURL("image/jpeg", 0.9);
              }
              URL.revokeObjectURL(blobUrl);
              resolve();
            };
            img.onerror = () => {
              console.error("Failed to load SVG into image for PDF shift report.");
              URL.revokeObjectURL(blobUrl);
              resolve(); 
            };
            img.src = blobUrl;
          });
        } catch (svgErr) {
          console.error("Error capturing telemetry chart for report:", svgErr);
        }
      }

      // Build out A4 Portrait PDF
      const drawHeader = (pageNum: number, totalPages: number) => {
        pdf.setFillColor(79, 70, 229); 
        pdf.rect(15, 12, 4, 14, "F");

        pdf.setTextColor(15, 23, 42); 
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.text("HEAP LEACH PROCESS ENGINEERING", 24, 18);
        
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139); 
        pdf.text("SHIFT PERFORMANCE SUMMARY & PROCESS SAFETY TELEMETRY REPORT", 24, 23);

        pdf.setDrawColor(226, 232, 240); 
        pdf.setLineWidth(0.4);
        pdf.line(15, 27, pageWidth - 15, 27);
      };

      const drawFooter = (pageNum: number, totalPages: number) => {
        pdf.setDrawColor(226, 232, 240); 
        pdf.setLineWidth(0.4);
        pdf.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

        pdf.setTextColor(148, 163, 184); 
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.text("RESTRICTED REPORT - DISPATCH OPERATIONS & METALLURGICAL ENGINEERING", 15, pageHeight - 10);
        pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 15, pageHeight - 10, { align: "right" });
      };

      // PAGE 1: MANAGEMENT OVERVIEW, METRICS GRID, & TELEMETRY CHART
      drawHeader(1, 2);

      const metaY = 33;
      pdf.setFillColor(248, 250, 252); 
      pdf.setDrawColor(226, 232, 240); 
      pdf.rect(15, metaY, pageWidth - 30, 36, "FD");

      pdf.setFillColor(236, 242, 254); 
      pdf.rect(15, metaY, pageWidth - 30, 8, "F");
      pdf.setTextColor(30, 41, 59); 
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.text("SHIFT HANDOVER METADATA & FIELD IDENTIFICATION", 19, metaY + 5.5);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85); 
      const paddingX = 19;

      pdf.text(`Shift Date:`, paddingX, metaY + 14);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${date}`, paddingX + 17, metaY + 14);
      pdf.setFont("helvetica", "normal");

      pdf.text(`Shift Time:`, paddingX, metaY + 20);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${time}`, paddingX + 17, metaY + 20);
      pdf.setFont("helvetica", "normal");

      pdf.text(`Shift ID:`, paddingX, metaY + 26);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${currentShiftId || "N/A"}`, paddingX + 13, metaY + 26);
      pdf.setFont("helvetica", "normal");

      // Column 2: Operator Coordinates
      const col2X = 80;
      pdf.text(`Operator:`, col2X, metaY + 14);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${operatorName || "Miguel Kaungu"}`, col2X + 15, metaY + 14);
      pdf.setFont("helvetica", "normal");

      pdf.text(`Emp No:`, col2X, metaY + 20);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${employmentNumber || "EMP-8274"}`, col2X + 14, metaY + 20);
      pdf.setFont("helvetica", "normal");

      pdf.text(`Email:`, col2X, metaY + 26);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${operatorEmail || "kaungu89@gmail.com"}`, col2X + 11, metaY + 26);
      pdf.setFont("helvetica", "normal");

      // Column 3: Telemetry Benchmarks
      const col3X = 144;
      pdf.text(`Active Loops:`, col3X, metaY + 14);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${activePads.length} of ${pads.length}`, col3X + 21, metaY + 14);
      pdf.setFont("helvetica", "normal");

      pdf.text(`Avg Flow:`, col3X, metaY + 20);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${padAverageFlow.toFixed(1)} m³/h`, col3X + 16, metaY + 20);
      pdf.setFont("helvetica", "normal");

      pdf.text(`Drift Ratio:`, col3X, metaY + 26);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${padRatio === null ? "Raw RAF" : padRatio.toFixed(2)}`, col3X + 17, metaY + 26);
      pdf.setFont("helvetica", "normal");

      const cbY = 74;
      let r = 100, g = 116, b = 139; // Default: slate-500
      let cbBgR = 248, cbBgG = 250, cbBgB = 252; // slate-50
      let cbTitle = "NEUTRAL / OFFLINE OR METALLURGICAL NEUTRAL";
      let cbBadgeText = "NEUTRAL";
      let severityLabel = "SEVERITY: NORMAL / INFO";

      if (padBalanceStatus === "optimal") {
        r = 16; g = 185; b = 129; // emerald-500
        cbBgR = 240; cbBgG = 253; cbBgB = 250; // emerald-50
        cbTitle = "OPTIMAL METALLURGICAL BLENDING";
        cbBadgeText = "OPTIMAL";
        severityLabel = "SEVERITY: OPTIMAL (SAFE)";
      } else if (padBalanceStatus === "warning") {
        r = 217; g = 119; b = 6; // amber-600
        cbBgR = 255; cbBgG = 251; cbBgB = 235; // amber-50
        cbTitle = "OPERATIONAL DRIFT WARNED";
        cbBadgeText = "WARNING";
        severityLabel = "SEVERITY: WARNING (MEDIUM)";
      } else if (padBalanceStatus === "error") {
        r = 220; g = 38; b = 38; // red-600
        cbBgR = 254; cbBgG = 242; cbBgB = 242; // red-50
        cbTitle = "SHIFT DRIFT METALLURGICAL ERROR ALERT";
        cbBadgeText = "CRITICAL";
        severityLabel = "SEVERITY: CRITICAL (HIGH RISK)";
      }

      // Draw Main Container Card with slightly thicker border and colored background
      pdf.setFillColor(cbBgR, cbBgG, cbBgB);
      pdf.setDrawColor(r, g, b);
      pdf.setLineWidth(0.4);
      pdf.rect(15, cbY, pageWidth - 30, 22, "FD");

      // Draw Left Highlight Strip (solid vertical color bar - 4.5mm wide)
      pdf.setFillColor(r, g, b);
      pdf.rect(15, cbY, 4.5, 22, "F");

      // Draw circular status indicator lamp inside the card (radius 1.25mm)
      pdf.circle(24, cbY + 5.5, 1.25, "F");

      // Draw Section Title
      pdf.setTextColor(15, 23, 42); // deep slate-900 for modern look & legibility
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.text(`CHEMICAL BALANCE: ${cbTitle}`, 27, cbY + 6.5);

      // Draw Color-coded severity badge pill dynamically aligned on the far right
      const badgeW = 28;
      const badgeH = 5.5;
      const badgeX = pageWidth - 15 - badgeW - 3; // 3mm safety margin from right edge
      const badgeY = cbY + 3.2;

      // Draw pill background
      pdf.setFillColor(r, g, b);
      pdf.rect(badgeX, badgeY, badgeW, badgeH, "F");

      // Draw pill bold text (centered white text)
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      pdf.text(cbBadgeText, badgeX + (badgeW / 2), badgeY + 3.9, { align: "center" });

      // Draw the subtext description & severity details
      pdf.setTextColor(71, 85, 105); // slate-600 for safe reading contrast
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      
      const wrappedBalanceMsg = pdf.splitTextToSize(`${padBalanceMsg} [${severityLabel}]`, pageWidth - 42);
      pdf.text(wrappedBalanceMsg, 24, cbY + 12.5);

      const chartY = 101;
      pdf.setTextColor(15, 23, 42); 
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("REAL-TIME FLOW DISTRIBUTION PROFILE CHART", 15, chartY);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139); 
      pdf.text("Heap leach active solution distribution overlay calibrated in m3/h compared to site baselines.", 15, chartY + 4.5);

      const chartBoxY = chartY + 7;
      const chartBoxHeight = 58;

      pdf.setFillColor(252, 252, 253);
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(15, chartBoxY, pageWidth - 30, chartBoxHeight, "FD");

      if (chartImgData) {
        const imageW = pageWidth - 36;
        const imageH = imageW / 3.33;
        const imageX = 18;
        const imageY = chartBoxY + (chartBoxHeight - imageH) / 2;
        pdf.addImage(chartImgData, "JPEG", imageX, imageY, imageW, imageH);
      } else {
        pdf.setTextColor(148, 163, 184); 
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text("Process Profile Chart Unavailable or Loading.", pageWidth / 2, chartBoxY + (chartBoxHeight / 2) + 2, { align: "center" });
      }

      const notesY = 171;
      pdf.setTextColor(15, 23, 42);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("OPERATOR HANDOVER REMARKS & MEMOS", 15, notesY);

      const notesBoxY = notesY + 5;
      const notesBoxHeight = 50;
      pdf.setFillColor(254, 254, 255);
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(15, notesBoxY, pageWidth - 30, notesBoxHeight, "FD");

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
      const wrappedNotes = pdf.splitTextToSize(notes || "No standard operational memos or chemical anomalies registered for this duty shift. All irrigation systems, solvent recovery tracks, and ponds recorded within nominal, stable parameters.", pageWidth - 38);
      pdf.text(wrappedNotes, 19, notesBoxY + 6.5);

      drawFooter(1, 2);

      // ==========================================
      // PAGE 2: LEACH PAD PROCESS AND POND LOGS DETAIL
      pdf.addPage();
      drawHeader(2, 2);

      const padTableY = 33;
      pdf.setTextColor(15, 23, 42);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.text("LEACH PAD DISTRIBUTION DETAIL - FLOW DATA SUMMARY", 15, padTableY);

      const thY = padTableY + 4.5;
      pdf.setFillColor(15, 23, 42); 
      pdf.rect(15, thY, pageWidth - 30, 8, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("PAD ID", 19, thY + 5.5);
      pdf.text("STATUS", 35, thY + 5.5);
      pdf.text("FEED SOURCE", 55, thY + 5.5);
      pdf.text("MIN FLOW (m³/h)", 77, thY + 5.5);
      pdf.text("MAX FLOW (m³/h)", 105, thY + 5.5);
      pdf.text("TOTALIZER (m³)", 132, thY + 5.5);
      pdf.text("PLS / ILS SPLITS", 163, thY + 5.5);

      let rowY = thY + 8;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      
      pads.forEach((pad, i) => {
        if (i % 2 === 0) {
          pdf.setFillColor(248, 250, 252); 
          pdf.rect(15, rowY, pageWidth - 30, 6.5, "F");
        }
        
        if (pad.status === "Active") {
          pdf.setTextColor(4, 120, 87); 
        } else if (pad.status === "Off") {
          pdf.setTextColor(180, 83, 9); 
        } else {
          pdf.setTextColor(190, 24, 74); 
        }
        
        pdf.setFont("helvetica", "bold");
        pdf.text(pad.id, 19, rowY + 4.5);
        pdf.text(pad.status, 35, rowY + 4.5);
        
        pdf.setTextColor(51, 65, 85); 
        pdf.setFont("helvetica", "normal");
        pdf.text(pad.feedType || "RAF", 55, rowY + 4.5);
        pdf.text(`${pad.min.toFixed(1)}`, 77, rowY + 4.5);
        pdf.text(`${pad.max.toFixed(1)}`, 105, rowY + 4.5);
        pdf.text(`${pad.totalizer !== undefined ? pad.totalizer.toString() : "-"}`, 132, rowY + 4.5);
        
        const plsSplit = pad.dischargePlsPercent ?? 100;
        const ilsSplit = pad.dischargeIlsPercent ?? 0;
        pdf.text(`${plsSplit}% / ${ilsSplit}%`, 163, rowY + 4.5);

        pdf.setDrawColor(241, 245, 249); 
        pdf.setLineWidth(0.3);
        pdf.line(15, rowY + 6.5, pageWidth - 15, rowY + 6.5);
        
        rowY += 6.5;
      });

      const pondTableY = rowY + 6;
      pdf.setTextColor(15, 23, 42);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.text("CENTRAL POND SYSTEM & BUFFER INVENTORY SUMMARY", 15, pondTableY);

      const pthY = pondTableY + 4.5;
      pdf.setFillColor(30, 41, 59); 
      pdf.rect(15, pthY, pageWidth - 30, 8, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("POND RESERVOIR SYSTEM NAME", 19, pthY + 5.5);
      pdf.text("TOTALIZER FLOW OUT (m³)", 85, pthY + 5.5);
      pdf.text("AVERAGE DISCHARGE RANGE (m³/h)", 135, pthY + 5.5);

      let pondRowY = pthY + 8;
      pdf.setFont("helvetica", "normal");
      
      const pondKeys: ("raf" | "ils" | "crasher" | "mainLine")[] = ["raf", "ils", "crasher", "mainLine"];
      pondKeys.forEach((key, idx) => {
        const pond = ponds[key];
        if (idx % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(15, pondRowY, pageWidth - 30, 6.5, "F");
        }

        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 41, 59);
        pdf.text(pond.name.replace(":", ""), 19, pondRowY + 4.5);

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(51, 65, 85);
        pdf.text(`${pond.totalizer.toString()}`, 85, pondRowY + 4.5);
        pdf.text(`${pond.flow.toFixed(1)} m³/h`, 135, pondRowY + 4.5);

        pdf.setDrawColor(241, 245, 249);
        pdf.setLineWidth(0.3);
        pdf.line(15, pondRowY + 6.5, pageWidth - 15, pondRowY + 6.5);

        pondRowY += 6.5;
      });

      const extraY = pondRowY + 5;
      if (extraY < pageHeight - 35 && extraTelemetry) { 
        pdf.setFillColor(250, 250, 251);
        pdf.setDrawColor(226, 232, 240);
        pdf.rect(15, extraY, pageWidth - 30, 18, "FD");

        pdf.setTextColor(71, 85, 105);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.text("AUXILIARY HYDRAULIC RESERVOIRS & CHEMICAL LOOP METRICS", 19, extraY + 5);

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 116, 139);
        
        pdf.text(`PLS Pond Lvl: ${(extraTelemetry.plsPondLevel || 0).toFixed(1)}%`, 19, extraY + 9);
        pdf.text(`ILS Pond Lvl: ${(extraTelemetry.ilsPondLevel || 0).toFixed(1)}%`, 59, extraY + 9);
        pdf.text(`RAF Pond Lvl: ${(extraTelemetry.rafPondLevel || 0).toFixed(1)}%`, 99, extraY + 9);
        pdf.text(`E.W. Direct Curr: ${((extraTelemetry as any).ewRectifierCurrent || (extraTelemetry as any).ewCurrent || 0).toFixed(1)} KA`, 139, extraY + 9);

        pdf.text(`Acid Tank-1: ${(extraTelemetry.acidTank1Level || 0).toFixed(1)}%`, 19, extraY + 13.5);
        pdf.text(`Acid Tank-2: ${(extraTelemetry.acidTank2Level || 0).toFixed(1)}%`, 59, extraY + 13.5);
        pdf.text(`Surge Reservoir: ${(extraTelemetry.advanceTankLevel || 0).toFixed(1)}%`, 99, extraY + 13.5);
        pdf.text(`Organic Loop: ${(extraTelemetry.organicFlow || 0).toFixed(1)} m³/h`, 139, extraY + 13.5);
      }

      drawFooter(2, 2);

      pdf.save(`LeachPad_Shift_Report_${date}_${time.replace(":", "-")}.pdf`);
      triggerToast("Optimized formatted Shift Handover report PDF saved successfully!", "success");
    } catch (err) {
      console.error("Shift report PDF compilation failed: ", err);
      triggerToast("Error compiling PDF Shift Report. Utilizing secondary spreadsheet exports.", "error");
    }
  };
  const processCSVText = (text: string): { success: boolean; data?: LeachPadNode[]; error?: string } => {
    if (!text || !text.trim()) {
      return { success: false, error: "The CSV file is empty." };
    }

    const lines = text.split(/\r?\n/);
    const importedPads: LeachPadNode[] = [];
    let parsedCount = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Handle quote characters safely
      const fields = trimmedLine.split(',').map(f => f.trim().replace(/^["']|["']$/g, ""));

      const padId = fields[0];
      // Check if first column starts with LP (e.g. LP1, LP12, LP10)
      if (padId && /^LP\d+$/i.test(padId)) {
        const upperId = padId.toUpperCase();
        
        // Feed type: RAF / ILS
        let feedType: "RAF" | "ILS" = "RAF";
        if (fields[1] && (fields[1].toUpperCase() === "RAF" || fields[1].toUpperCase() === "ILS")) {
          feedType = fields[1].toUpperCase() as "RAF" | "ILS";
        }

        // Flow rates
        const min = parseFloat(fields[2]) || 0;
        const max = parseFloat(fields[3]) || 0;

        let totalizer: number | undefined = undefined;
        let plsPercent = 100;
        let ilsPercent = 0;
        let status: "Active" | "Off" | "Offline" = "Off";
        let note: string | undefined = undefined;

        // Check if the CSV has the Totalizer column (8+ fields, with index 4, 5, 6 as numeric fields)
        if (fields.length >= 8 && !isNaN(parseFloat(fields[4])) && !isNaN(parseFloat(fields[5])) && !isNaN(parseFloat(fields[6]))) {
          const totVal = parseFloat(fields[4]);
          totalizer = isNaN(totVal) ? undefined : totVal;

          plsPercent = parseFloat(fields[5]);
          ilsPercent = parseFloat(fields[6]);

          if (fields[7]) {
            const lowerStatus = fields[7].trim().toLowerCase();
            if (lowerStatus === "active") status = "Active";
            else if (lowerStatus === "offline") status = "Offline";
            else status = "Off";
          } else {
            status = (min > 0 || max > 0) ? "Active" : "Off";
          }

          note = fields[8] ? fields[8].trim() : undefined;
        } else {
          // Legacy format (no totalizer column)
          if (fields[4] !== undefined && !isNaN(parseFloat(fields[4]))) {
            plsPercent = parseFloat(fields[4]);
          }
          if (fields[5] !== undefined && !isNaN(parseFloat(fields[5]))) {
            ilsPercent = parseFloat(fields[5]);
          }

          if (fields[6]) {
            const lowerStatus = fields[6].trim().toLowerCase();
            if (lowerStatus === "active") status = "Active";
            else if (lowerStatus === "offline") status = "Offline";
            else status = "Off";
          } else {
            status = (min > 0 || max > 0) ? "Active" : "Off";
          }

          note = fields[7] ? fields[7].trim() : undefined;
        }

        importedPads.push({
          id: upperId,
          min,
          max,
          status,
          feedType,
          dischargePlsPercent: plsPercent,
          dischargeIlsPercent: ilsPercent,
          totalizer,
          notes: note
        });
        parsedCount++;
      }
    }

    if (parsedCount === 0) {
      return { success: false, error: "No valid Leach Pad rows (e.g. LP1, LP2, ...) identified in the CSV file layout." };
    }

    return { success: true, data: importedPads };
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = processCSVText(text);
      if (result.success && result.data) {
        setPads(result.data);
        triggerToast(`Successfully bulk-populated ${result.data.length} Leach Pad loops from CSV file!`, "success");
      } else {
        triggerToast(result.error || "Failed to parse CSV file standard.", "error");
      }
    };
    reader.onerror = () => {
      triggerToast("Failed to read the selected file.", "error");
    };
    reader.readAsText(file);
    event.target.value = ""; // clear so we can re-import same file
  };

  const handleSyncServerCSV = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/pads-csv");
      if (!response.ok) {
        throw new Error(`Server returned status code: ${response.status}`);
      }
      const text = await response.text();
      const result = processCSVText(text);
      if (result.success && result.data) {
        setPads(result.data);
        triggerToast(`Successfully synced ${result.data.length} Leach Pad loops in real-time from server CSV configuration!`, "success");
      } else {
        triggerToast(result.error || "Failed to parse CSV configuration served by the main system.", "error");
      }
    } catch (err: any) {
      console.error("Failed to sync server CSV, performing offline fallback:", err);
      
      // Resilient layout fail-over
      const fallbackCSV = `Pad ID,Feed Source,Min Flow (m3/h),Max Flow (m3/h),Totalizer (m3),PLS Split %,ILS Split %,Status,Notes
LP1,RAF,45.5,45.5,4480.20,100,0,Active,Offline local fallback configuration
LP2,RAF,0.00,0.00,0.00,100,0,Off,Standby
LP3,ILS,0.00,0.00,0.00,0,100,Off,Offline maintenance
LP4,RAF,125.00,125.00,20500.25,100,0,Active,Dosing adjusted offline
LP5,RAF,158.00,158.00,32100.80,80,20,Active,Active irrigation
LP6,ILS,180.00,180.00,45900.50,55,45,Active,Optimal blending
LP7,RAF,162.00,162.00,28450.10,100,0,Active,Active irrigation
LP8,RAF,96.50,96.50,11180.40,70,30,Active,Active irrigation
LP9,ILS,165.00,165.00,30220.15,100,0,Active,Active irrigation
LP10,RAF,0.00,0.00,0.00,60,40,Off,Standby
LP11,RAF,150.00,150.00,24100.30,100,0,Active,Active irrigation
LP12,ILS,135.20,135.20,22980.60,0,100,Active,Active irrigation
`;
      const result = processCSVText(fallbackCSV);
      if (result.success && result.data) {
        setPads(result.data);
        triggerToast("Server unreachable (offline mode). Loaded latest backup dataset successfully!", "info");
      } else {
        triggerToast("Connection failure and backup restoration failed.", "error");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      triggerToast("Invalid format. Please drag and drop a .csv file.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const result = processCSVText(text);
      if (result.success && result.data) {
        setPads(result.data);
        triggerToast(`Successfully bulk-populated ${result.data.length} Leach Pad loops via drag-and-drop CSV!`, "success");
      } else {
        triggerToast(result.error || "Failed to parse CSV file standard.", "error");
      }
    };
    reader.onerror = () => {
      triggerToast("Failed to read the dropped file.", "error");
    };
    reader.readAsText(file);
  };

  // Pre-format and share the current shift telemetry summary via Email
  const handleEmailShiftSummary = () => {
    const subject = `HEAP LEACH PROCESS SUMMARY - Shift ${currentShiftId || "N/A"} - ${date}`;
    
    let body = `HEAP LEACH PROCESS TELEMETRY REPORT\n`;
    body += `=====================================\n\n`;
    body += `SHIFT INFORMATION:\n`;
    body += `------------------\n`;
    body += `Shift ID: ${currentShiftId || "N/A"}\n`;
    body += `Date: ${date}\n`;
    body += `Time: ${time}\n`;
    body += `Operator Name: ${operatorName || "Not specified"}\n`;
    body += `Employment Number: ${employmentNumber || "Not specified"}\n`;
    body += `Operator Duty Email: ${operatorEmail || "Not specified"}\n\n`;
    
    body += `LEACH PAD STATUS SUMMARY:\n`;
    body += `-------------------------\n`;
    body += `Active Irrigator Loops: ${pads.filter(p => p.status === "Active").length} / ${pads.length}\n`;
    body += `Off Loops: ${pads.filter(p => p.status === "Off").length}\n`;
    body += `Offline Loops: ${pads.filter(p => p.status === "Offline").length}\n`;
    body += `Total Active Flow Min Sum: ${totalActiveFlowMinSum.toFixed(1)} m³/h\n`;
    body += `Total Active Flow Max Sum: ${totalActiveFlowMaxSum.toFixed(1)} m³/h\n`;
    body += `Tuning Flow Spread Variance: ${flowSpread.toFixed(1)} m³/h\n\n`;
    
    body += `FEED & DISCHARGE PARTITIONS:\n`;
    body += `----------------------------\n`;
    body += `Total RAF Feed: ${totalRafFeedMin.toFixed(1)} - ${totalRafFeedMax.toFixed(1)} m³/h\n`;
    body += `Total ILS Feed: ${totalIlsFeedMin.toFixed(1)} - ${totalIlsFeedMax.toFixed(1)} m³/h\n`;
    body += `Total PLS Discharge: ${totalPlsDischargeMin.toFixed(1)} - ${totalPlsDischargeMax.toFixed(1)} m³/h\n`;
    body += `Total ILS Discharge: ${totalIlsDischargeMin.toFixed(1)} - ${totalIlsDischargeMax.toFixed(1)} m³/h\n\n`;

    body += `POND TELEMETRY DECK:\n`;
    body += `--------------------\n`;
    Object.values(ponds).forEach((p: PondTelemetry) => {
      body += `${p.name}: Flow ${p.flow.toFixed(1)} m³/h | Totalizer ${p.totalizer.toFixed(1)} m³\n`;
    });
    body += `Total Combined Pond Outflow: ${pondWaterOutSum.toFixed(1)} m³/h\n\n`;

    body += `LEACH PAD LOOP LIST DETAILED:\n`;
    body += `-----------------------------\n`;
    pads.forEach(p => {
      const feedType = p.feedType || "RAF";
      const plsPct = p.dischargePlsPercent ?? 100;
      const ilsPct = p.dischargeIlsPercent ?? 0;
      body += `${p.id}: Status=${p.status} | Flow Range=${p.min}-${p.max} m³/h | Feed=${feedType} | PLS/ILS Split=${plsPct}%/${ilsPct}%\n`;
    });
    body += `\n`;

    if (notes) {
      body += `OPERATOR SHIFT NOTES:\n`;
      body += `---------------------\n`;
      body += `${notes}\n\n`;
    }

    body += `SYSTEM VALIDITY INTEGRITY:\n`;
    body += `--------------------------\n`;
    if (errors.length === 0) {
      body += `✓ All active loop and pond validations passed cleanly.\n`;
    } else {
      body += `⚠ Telemetry Validation Warnings Present:\n`;
      errors.forEach((err) => {
        body += `- [${err.type.toUpperCase()}] ${err.message}\n`;
      });
    }
    body += `\nReport generated by Heap Leach Telemetry System on ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC.\n`;

    // Copy to clipboard to verify and allow fallback pasta
    try {
      navigator.clipboard.writeText(body);
      triggerToast("Summary copied to clipboard & launching email composer!", "success");
    } catch (e) {
      triggerToast("Launching default email composer...", "success");
    }

    // Direct redirection
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-850 selection:bg-teal-150 flex flex-col font-sans transition-colors duration-200">
      
      {/* Toast Notification Indicator */}
      {toast && (
        <div 
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-mono flex items-center gap-2.5 transition-all duration-300 animate-slide-in ${
            toast.type === "success" 
              ? "bg-teal-50 border-teal-200 text-teal-900" 
              : toast.type === "error" 
              ? "bg-rose-50 border-rose-200 text-rose-900" 
              : "bg-indigo-50 border-indigo-200 text-indigo-900"
          }`}
        >
          {toast.type === "success" && <CheckCircle2 size={14} className="text-teal-600 flex-none" />}
          {toast.type === "error" && <ShieldAlert size={14} className="text-rose-600 flex-none" />}
          {toast.type === "info" && <HelpCircle size={14} className="text-indigo-600 flex-none" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Operating Header */}
      <header className="bg-slate-950 text-white shadow-md border-b border-slate-800 no-print">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3.5">
          {/* Logo & title */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-teal-600 to-cyan-500 p-2 rounded-xl text-white shadow-md">
              <Layers size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping"></span>
                <span className="text-[10px] font-mono tracking-widest text-teal-400 font-bold uppercase">
                  MIMBULA MINERALS LIMITED (Processing Department)
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold font-mono tracking-tight leading-tight flex items-center gap-1.5">
                Heap Leach Pad Flows & Acid Distribution Center
              </h1>
              <p className="text-[9px] font-mono text-slate-400 mt-0.5">Developed by Miguel Kaungu</p>
            </div>
          </div>

          {/* Operator and dynamic time context */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 font-mono text-xs">
            {/* Operator Duty Card */}
            <div 
              onClick={() => setIsOperatorModalOpen(true)}
              title="Click to edit or update current Operator credentials"
              className="bg-slate-900 hover:bg-slate-850 hover:border-teal-500 rounded-lg px-3 py-1.5 border border-slate-800 flex items-center gap-2 text-slate-350 cursor-pointer transition-all duration-200 group active:scale-95"
            >
              <User size={14} className="text-teal-400 group-hover:text-teal-300 shrink-0 transition-colors" />
              <div className="text-left leading-tight">
                <div className="flex items-center gap-1.5 justify-between">
                  <span className="text-[8.5px] text-slate-500 font-semibold uppercase tracking-wider select-none">DUTY OPERATOR</span>
                  <span className="text-[7.5px] px-1 py-0.2 bg-teal-950 text-teal-400 border border-teal-900 rounded font-bold uppercase scale-90 group-hover:bg-teal-900 group-hover:text-teal-200 transition-all">EDIT</span>
                </div>
                <p className="text-[10px] font-bold text-slate-100 group-hover:text-white transition-colors">{operatorName || "Miguel Kaungu"} <span className="text-teal-400">({employmentNumber || "EMP-8274"})</span></p>
                <p className="text-[8.5px] text-slate-400 font-medium group-hover:text-slate-300 transition-colors">{operatorEmail}</p>
              </div>
            </div>

            {/* Google / Gmail Shift Communication Header Badge */}
            <button
              type="button"
              onClick={() => {
                setGmailInitialTab("handover");
                setIsGmailModalOpen(true);
              }}
              title={
                googleUser
                  ? `Google Account: ${googleUser.email}. Click to launch Gmail Shift Communications.`
                  : "Connect Gmail to send shift handovers and process alerts"
              }
              className={`rounded-lg px-3 py-1.5 border flex items-center gap-2 cursor-pointer transition-all duration-200 active:scale-95 group ${
                googleUser
                  ? "bg-slate-900 hover:bg-slate-850 border-red-500/30 hover:border-red-500/60"
                  : "bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="w-5 h-5 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20 group-hover:scale-105 transition-transform">
                <Mail size={12} />
              </div>
              <div className="text-left leading-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8.5px] text-red-400 font-bold uppercase tracking-wider select-none">
                    GMAIL
                  </span>
                  {googleUser && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </div>
                <p className="text-[10px] font-bold text-slate-200 group-hover:text-white transition-colors truncate max-w-[110px]">
                  {googleUser ? googleUser.email?.split("@")[0] : "Shift Mail"}
                </p>
              </div>
            </button>

            {/* Auto-Save Status Card */}
            <div className={`rounded-lg px-3 py-1.5 border flex items-center gap-2 transition-all duration-300 ${
              isSaving 
                ? "bg-indigo-950/40 border-indigo-500/30 text-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.2)]" 
                : "bg-slate-900 border-slate-800 text-slate-300"
            }`}>
              <Database size={13} className={isSaving ? "text-indigo-400 animate-bounce" : lastSavedTime ? "text-emerald-400 animate-pulse" : "text-emerald-500"} />
              <div className="text-left leading-none">
                <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider select-none">
                  {isSaving ? "SYNCING..." : "PERSISTENCE"}
                </p>
                <p className={`text-[10.5px] font-bold ${isSaving ? "text-indigo-300" : lastSavedTime ? `Autosaved ${lastSavedTime}` : "Database Live"}`}>
                  {isSaving ? "Saving..." : lastSavedTime ? `Autosaved ${lastSavedTime}` : "Database Live"}
                </p>
              </div>
            </div>

            {/* Firebase Firestore Cloud Sync Badge */}
            <div 
              onClick={async () => {
                setIsCloudSyncing(true);
                const connected = await testFirestoreConnection();
                setIsFirestoreConnected(connected);
                setIsCloudSyncing(false);
                triggerToast(
                  connected 
                    ? "Firebase Firestore connected: lulamba-creatives (europe-west2)" 
                    : "Firebase Firestore probe: check network or credentials", 
                  connected ? "success" : "info"
                );
              }}
              title="Firebase Firestore Cloud Database: lulamba-creatives (europe-west2). Click to test connection."
              className={`rounded-lg px-3 py-1.5 border flex items-center gap-2 cursor-pointer transition-all duration-200 active:scale-95 group ${
                isFirestoreConnected
                  ? "bg-slate-900 hover:bg-slate-850 border-amber-500/30 hover:border-amber-500/60"
                  : "bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-transform">
                <Flame size={12} className={isCloudSyncing ? "animate-spin" : ""} />
              </div>
              <div className="text-left leading-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8.5px] text-amber-400 font-bold uppercase tracking-wider select-none">
                    FIRESTORE
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${isFirestoreConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                </div>
                <p className="text-[10px] font-bold text-slate-200 group-hover:text-white transition-colors truncate max-w-[110px]">
                  {isCloudSyncing ? "Syncing..." : isFirestoreConnected ? "Cloud Active" : "Online DB"}
                </p>
              </div>
            </div>

             {/* Local Metadata Time Box with real-time Central Africa Time */}
             <div className="bg-slate-900 rounded-lg px-3 py-1.5 border border-slate-800 flex items-center gap-2 text-slate-300">
               <Clock size={13} className="text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
               <div className="text-left leading-none">
                 <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider select-none">SHIFT CLOCK</p>
                 <p className="text-[10.5px] font-bold text-amber-300">{liveCat}</p>
               </div>
             </div>

             {/* Dynamic Layout Mode Selector Pill Segment Control */}
             <div className="bg-slate-900 border border-slate-800 rounded-lg p-0.5 flex">
               <button
                 type="button"
                 onClick={() => setViewMode("desktop")}
                 className={`px-3 py-1 bg-slate-950 rounded text-[9.5px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                   viewMode === "desktop"
                     ? "bg-gradient-to-tr from-teal-500 to-cyan-500 text-slate-950 font-black shadow-sm"
                     : "text-slate-400 hover:text-white hover:bg-slate-900"
                 }`}
                 title="Open comprehensive mine controller desk dashboard view"
               >
                 <span>🖥️ Desktop</span>
               </button>
               <button
                 type="button"
                 onClick={() => setViewMode("mobile")}
                 className={`px-3 py-1 bg-slate-950 rounded text-[9.5px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                   viewMode === "mobile"
                     ? "bg-gradient-to-tr from-teal-500 to-cyan-500 text-slate-950 font-black shadow-sm"
                     : "text-slate-400 hover:text-white hover:bg-slate-900"
                 }`}
                 title="Launch simulated Play Store-ready mobile field application"
               >
                 <span>📱 Mobile</span>
               </button>
             </div>
           </div>
        </div>
      </header>

      {/* Main Container Wrapper */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex-1 w-full space-y-6">
        
        {viewMode === "mobile" ? (
          <MobileFieldSimulator
            pads={pads}
            ponds={ponds}
            extraTelemetry={extraTelemetry}
            onUpdatePads={setPads}
            onUpdatePonds={setPonds}
            onUpdateExtraTelemetry={setExtraTelemetry}
            liveCat={liveCat}
          />
        ) : (
          <>
            {/* Predictive inventory/acidity alarm and warning systems desk */}
            <AcidTankAlarmSystem
              history={history}
              extraTelemetry={extraTelemetry}
              onUpdateExtraTelemetry={setExtraTelemetry}
              onSetHistory={setHistory}
              onTriggerToast={triggerToast}
            />

            {/* Presets and Controls deck */}
            <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative bg-white rounded-2xl border p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print transition-all duration-300 ${
            isDraggingFile 
              ? "border-teal-400 bg-teal-50/55 ring-2 ring-teal-400 ring-offset-1" 
              : "border-slate-200"
          }`}
        >
          {isDraggingFile && (
            <div className="absolute inset-0 bg-teal-600/90 rounded-2xl flex items-center justify-center gap-2.5 z-30 pointer-events-none text-white font-sans font-bold text-xs tracking-wider uppercase">
              <Upload size={16} className="animate-bounce" />
              <span>Drop CSV file here to bulk-populate Leach Pad Flow Sheet</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Sliders size={15} className="text-indigo-500" />
            <h3 className="font-sans font-bold text-slate-800 text-xs tracking-wider uppercase">Calibrations & Workspace presets</h3>
            <span className={`px-1.5 py-0.5 text-[9px] font-mono font-extrabold rounded border flex items-center gap-1 transition-all duration-300 ${
              isSaving 
                ? "text-indigo-600 bg-indigo-50 border-indigo-200/50 scale-102 shadow-sm"
                : "text-emerald-600 bg-emerald-50 border-emerald-200/50"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                isSaving ? "bg-indigo-500 animate-ping" : "bg-emerald-500 animate-pulse"
              }`}></span>
              {isSaving ? "SAVING..." : "AUTOSAVE ACTIVE"}
              {lastSavedTime && (
                <span className={`text-[8.5px] border-l pl-1 ml-1 ${isSaving ? 'border-indigo-200 text-indigo-400' : 'border-emerald-200 text-emerald-500'}`}>
                  Saved {lastSavedTime}
                </span>
              )}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-restore-img"
              type="button"
              onClick={handleLoadBaselinePreset}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-200 shadow-sm transition-all"
            >
              <RefreshCw size={11} />
              Preload Screenshot Values
            </button>
            <button
              id="btn-clear"
              type="button"
              onClick={handleClearAllInputs}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-200 shadow-sm transition-all"
            >
              Clear Values
            </button>
            <button
              id="btn-workspace-save-top"
              type="button"
              onClick={handleSaveShift}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 border border-emerald-600 shadow-sm transition-all"
              title="Save current telemetry dataset as a recorded snapshot report"
            >
              <Save size={11} />
              Save Shift Snapshot
            </button>
            <button
              id="btn-google-drive-sync"
              type="button"
              title="Save entire project, source code, telemetry datasets, PWA bundle, and assets to Google Drive"
              onClick={() => setIsDriveModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-teal-600 via-indigo-600 to-indigo-700 hover:from-teal-500 hover:to-indigo-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 border border-indigo-500/40 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Cloud size={13} className="text-teal-200" />
              <span>Save to Google Drive</span>
            </button>
            <button
              id="btn-gmail-dispatch-toolbar"
              type="button"
              onClick={() => {
                setGmailInitialTab("handover");
                setIsGmailModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 border border-red-500/40 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Open Gmail Shift Communications to dispatch formatted handover report or review inbox"
            >
              <Mail size={13} className="text-red-100" />
              <span>Gmail Dispatch</span>
            </button>
            <button
              id="btn-google-forms-modal"
              type="button"
              onClick={() => setIsFormsModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 border border-purple-500/40 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Open Google Forms: manage plant inspection questionnaires, dispatch mobile field forms, and import responses"
            >
              <FileCheck size={13} className="text-purple-200" />
              <span>Google Forms</span>
            </button>
            <button
              id="btn-email-summary-top"
              type="button"
              onClick={handleEmailShiftSummary}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 border border-indigo-600/50 shadow-sm transition-all active:scale-95"
              title="Compose list, notes, and pond values to direct share to engineering managers via email"
            >
              <Mail size={12} className="text-indigo-200" />
              <span>Email Shift Summary</span>
            </button>
            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>
            {/* Hidden file input for importing CSV files to bulk populate the Leach Pad Flow Sheet */}
            <input
              type="file"
              id="csv-import-file-input"
              accept=".csv"
              className="hidden"
              onChange={handleImportCSV}
            />
            <button
              id="btn-sync-server-csv"
              type="button"
              title="Sync with Server CSV: Fetch latest Leach Pad state values from the predefined server API endpoint in real-time"
              onClick={handleSyncServerCSV}
              disabled={isSyncing}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 border shadow-sm transition-all active:scale-95 cursor-pointer ${
                isSyncing 
                  ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" 
                  : "bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200/60"
              }`}
            >
              <CloudDownload size={12} className={isSyncing ? "animate-spin text-amber-600" : "text-teal-600"} />
              <span>{isSyncing ? "Syncing..." : "Sync Server CSV"}</span>
            </button>
            <button
              id="btn-import-csv"
              type="button"
              title="Upload a compatible CSV spreadsheet to bulk populate the Leach Pad Flow Sheet"
              onClick={() => document.getElementById("csv-import-file-input")?.click()}
              className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg flex items-center gap-1.5 border border-indigo-200/60 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Upload size={12} className="text-indigo-600" />
              <span>Import CSV</span>
            </button>
            <button
              id="btn-export-csv"
              type="button"
              title="Download Excel CSV Spreadsheet"
              onClick={handleExportCSV}
              className="p-1.5 text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-all shadow-sm"
            >
              <FileSpreadsheet size={14} />
            </button>
            <button
              id="btn-export-json"
              type="button"
              title="Download JSON Telemetry dump"
              onClick={handleExportJSON}
              className="p-1.5 text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-all shadow-sm"
            >
              <Download size={14} />
            </button>
            
            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>
            
            <button
              id="btn-pdf"
              type="button"
              title="Generate optimized portrait PDF Shift Handover document"
              onClick={handleExportPDF}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0 border border-indigo-550/20"
            >
              <FileDown size={13} className="text-indigo-200" />
              <span>Save as PDF</span>
            </button>

            <button
              id="btn-print"
              type="button"
              title="Print Report / Hardcopy (Ctrl+P)"
              onClick={() => window.print()}
              className="p-1.5 text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-all shadow-sm active:scale-95 shrink-0"
            >
              <Printer size={14} />
            </button>
          </div>
        </div>

        {/* Print-Only Header */}
        <div className="hidden print:block border-b-2 border-slate-900 pb-5 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold font-mono text-slate-900 tracking-tight">MIMBULA MINERALS LIMITED - HEAP LEACH TELEMETRY</h1>
              <p className="text-[10px] text-slate-500 font-mono mt-1">Processing Department | Held Line Telemetry DCS-2000 | Developer: Miguel Kaungu</p>
            </div>
            <div className="text-right text-[10px] font-mono text-slate-600">
              <p><strong>REPORT DATE:</strong> {date}</p>
              <p><strong>REPORT TIME:</strong> {time}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 mt-4 pt-4 border-t border-slate-200 text-[11px] font-mono text-slate-800">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Duty Operator</p>
              <p className="font-bold text-slate-900">{operatorName || "Miguel Kaungu"}</p>
              <p className="text-[10px] text-slate-700 font-semibold">{employmentNumber || "EMP-8274"}</p>
              <p className="text-[10px] text-slate-500">{operatorEmail}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Shift Identifier</p>
              <p className="font-bold text-slate-900">{currentShiftId}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Verification Integrity</p>
              <p className="font-bold text-emerald-700">VERIFIED PROCESS SNAPSHOT</p>
            </div>
          </div>
        </div>

        {/* Row 1: LP loops first (Full Width) */}
        <div className="space-y-6">
          
          {/* Leach Pad Status Summary Counter Chips */}
          <div className="bg-white print:bg-slate-50 rounded-2xl border border-slate-200 p-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 font-sans tracking-wide uppercase">Leach Pad Status Summary</span>
                <p className="text-[10px] text-slate-550 font-mono">Real-time status metrics of active looping units</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div 
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-100 text-sky-850 text-xs font-bold font-mono transition-all"
                  title={`${pads.filter(p => p.status === "Active").length} Active Loops`}
                >
                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
                  <span>Active:</span>
                  <span className="bg-sky-200/60 px-1.5 py-0.5 rounded text-[10px] font-black">{pads.filter(p => p.status === "Active").length}</span>
                </div>
                <div 
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-850 text-xs font-bold font-mono transition-all"
                  title={`${pads.filter(p => p.status === "Off").length} Loops Powered Off`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Off:</span>
                  <span className="bg-amber-200/60 px-1.5 py-0.5 rounded text-[10px] font-black">{pads.filter(p => p.status === "Off").length}</span>
                </div>
                <div 
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-rose-850 text-xs font-bold font-mono transition-all"
                  title={`${pads.filter(p => p.status === "Offline").length} Loops Offline (Maintenance)`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>Offline:</span>
                  <span className="bg-rose-200/60 px-1.5 py-0.5 rounded text-[10px] font-black">{pads.filter(p => p.status === "Offline").length}</span>
                </div>
              </div>
            </div>

            {/* Real-time Circuit Schematic card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col no-print transition-all">
              <div 
                className="bg-slate-900 border-b border-slate-850 px-4.5 py-2.5 flex items-center justify-between cursor-pointer select-none"
                onClick={() => setIsSchematicOpen(!isSchematicOpen)}
              >
                <div className="flex items-center gap-2">
                  <Activity size={15} className="text-teal-400 animate-pulse" />
                  <span className="font-sans font-bold text-xs uppercase tracking-wide text-white">
                    1A. Mimbula Circuit Animated Piping Schematic
                  </span>
                </div>
                <button
                  type="button"
                  className="text-[10px] font-mono hover:text-white font-bold text-teal-400 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded px-2.5 py-1 tracking-wider"
                >
                  {isSchematicOpen ? "COLLAPSE PANEL -" : "EXPAND SCHEMATIC +"}
                </button>
              </div>

              {isSchematicOpen && (
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                  <LivePipelineSVG
                    pads={pads}
                    ponds={ponds}
                    onSelectPad={(padId) => {
                      const rowIdInput = document.getElementById(`input-min-${padId}`);
                      rowIdInput?.focus();
                      rowIdInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    onSelectPond={(pondId) => {
                      setActiveProcessTab("pond_pump");
                      const pondSectionEl = document.getElementById("pipeline-diagram-card");
                      pondSectionEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  />
                </div>
              )}
            </div>

            <div ref={leachPadSheetRef} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
              
              {/* Header Box */}
              <div 
                className="bg-slate-900 print:bg-white text-white print:text-black px-4.5 py-3 flex items-center justify-between border-b pb-3.5 shadow-sm cursor-pointer select-none"
                onClick={() => setIsLeachPadSheetOpen(!isLeachPadSheetOpen)}
              >
                <div>
                  <h2 className="font-sans font-bold text-sm tracking-wide uppercase flex items-center gap-2">
                    <Database size={15} className="text-teal-400 print:hidden" />
                    1. LEACH PAD FLOW SHEET
                  </h2>
                  <p className="text-[10px] text-slate-400 print:text-slate-500 font-mono mt-0.5">
                    Physical irrigation loop controls LP1 - LP{pads.length}
                  </p>
                </div>
                
                {/* Status legend indicators */}
                <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="hidden sm:flex items-center gap-2 text-[9px] font-mono font-medium opacity-90 border-r border-slate-700 pr-3.5">
                    <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-850">Active m³/h</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-850">Off</span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-850 font-normal">Offline</span>
                  </div>

                  <button
                    id="btn-lp-capture"
                    type="button"
                    onClick={captureLeachPadSheet}
                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 border border-amber-600 text-slate-950 text-[10px] font-bold transition-all rounded-lg cursor-pointer shadow-sm active:scale-95 print:hidden select-none font-sans"
                    title="Download high-resolution spreadsheet snapshot as a PNG image"
                  >
                    <Camera size={11} className="text-slate-950" />
                    <span>Capture PNG</span>
                  </button>

                  <button
                    type="button"
                    className="text-[10px] font-mono hover:text-white font-bold text-teal-400 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded px-2.5 py-1 tracking-wider"
                    onClick={() => setIsLeachPadSheetOpen(!isLeachPadSheetOpen)}
                  >
                    {isLeachPadSheetOpen ? "COLLAPSE PANEL -" : "EXPAND PANEL +"}
                  </button>
                </div>
              </div>

              {isLeachPadSheetOpen && (
                <>
                  {/* SpreadSheet Area */}
                  <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider">
                      <th className="px-3 py-2 text-center border-r w-16 min-w-[70px]">LOOP</th>
                      <th className="px-3 py-2 text-center border-r w-28 min-w-[105px]">FEED</th>
                      <th className="px-3 py-2 text-center border-r w-44 min-w-[160px]">DISCHARGE</th>
                      <th className="px-4 py-2 text-center border-r w-32 min-w-[110px]">MIN RATE</th>
                      <th className="px-2 py-2 text-center w-6 select-none">-</th>
                      <th className="px-4 py-2 text-center border-r w-32 min-w-[110px]">MAX RATE</th>
                      <th className="px-4 py-2 text-center border-r w-44 min-w-[165px]">TOTALIZER</th>
                      <th className="px-4 py-2 text-center w-32 min-w-[115px]">FLOW STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pads.map((pad) => {
                      const errMin = errors.find(e => e.field === `${pad.id}_min`);
                      const errMax = errors.find(e => e.field === `${pad.id}_max`);
                      const errStat = errors.find(e => e.field === `${pad.id}_status`);
                      const errTotalizer = errors.find(e => e.field === `${pad.id}_totalizer`);
                      return (
                        <PadRowItem
                          key={pad.id}
                          pad={pad}
                          onUpdate={(updated) => {
                            setPads(pads.map((p) => (p.id === pad.id ? updated : p)));
                          }}
                          errorMin={errMin?.message}
                          errorMax={errMax?.message}
                          errorStatus={errStat?.message}
                          errorTotalizer={errTotalizer?.message}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pad Management Growth Toolbar */}
              <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div className="text-[11px] text-slate-500 font-medium">
                  Configured Loops: <span className="font-mono font-extrabold text-slate-700 bg-slate-200/60 px-1.5 py-0.5 rounded border border-slate-300/40">{pads.length} Leach Pad Loops</span>
                </div>
                <div className="flex gap-2">
                  {pads.length > 12 && (
                    <button
                      id="btn-remove-last-lp"
                      type="button"
                      onClick={() => {
                        const lastPad = pads[pads.length - 1];
                        setPads(pads.slice(0, -1));
                        triggerToast(`Successfully removed Leach Pad ${lastPad.id}.`, "info");
                      }}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 hover:border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                      title="Remove the last appended leach pad loop"
                    >
                      <Trash2 size={12} />
                      <span>Remove Last LP ({pads[pads.length - 1].id})</span>
                    </button>
                  )}
                  <button
                    id="btn-add-another-lp"
                    type="button"
                    onClick={() => {
                      const lastPad = pads[pads.length - 1];
                      let nextNum = pads.length + 1;
                      if (lastPad && lastPad.id.startsWith("LP")) {
                        const parsed = parseInt(lastPad.id.replace("LP", ""), 10);
                        if (!isNaN(parsed)) {
                          nextNum = parsed + 1;
                        }
                      }
                      const newId = `LP${nextNum}`;
                      const newPad: LeachPadNode = {
                        id: newId,
                        min: 0.00,
                        max: 0.00,
                        status: "Off",
                        feedType: "RAF",
                        dischargePlsPercent: 100,
                        dischargeIlsPercent: 0,
                      };
                      setPads([...pads, newPad]);
                      triggerToast(`Leach Pad ${newId} configured and appended cleanly after ${lastPad?.id || 'last pad'}.`, "success");
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white border border-teal-600 text-[11px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Extend plant configuration by appending another irrigation loop after the last active pad"
                  >
                    <Plus size={12} />
                    <span>Add another LP after the last one ({
                      (() => {
                        const lastPad = pads[pads.length - 1];
                        let nextNum = pads.length + 1;
                        if (lastPad && lastPad.id.startsWith("LP")) {
                          const parsed = parseInt(lastPad.id.replace("LP", ""), 10);
                          if (!isNaN(parsed)) {
                            nextNum = parsed + 1;
                          }
                        }
                        return `LP${nextNum}`;
                      })()
                    })</span>
                  </button>
                </div>
              </div>

              {/* Quick Math Summary deck at base */}
              <div className="bg-slate-150 p-5 border-t border-slate-200 space-y-4">
                {/* Row 1: Primary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-mono text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Active Irrigators</p>
                    <p className="text-lg font-bold font-mono text-teal-700">
                      {activePads.length} <span className="text-xs text-slate-400 font-normal">/ {pads.length}</span>
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-mono text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Total Loop Flow (Min)</p>
                    <p className="text-lg font-bold font-mono text-slate-800">
                      {totalActiveFlowMinSum.toFixed(1)} <span className="text-[9px] text-slate-400">m³/h</span>
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-mono text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Total Loop Flow (Max)</p>
                    <p className="text-lg font-bold font-mono text-slate-800">
                      {totalActiveFlowMaxSum.toFixed(1)} <span className="text-[9px] text-slate-400">m³/h</span>
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-mono text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Tuning Variance</p>
                    <p className="text-lg font-bold font-mono text-indigo-700">
                      {flowSpread.toFixed(1)} <span className="text-[9px] text-indigo-400">m³/h</span>
                    </p>
                  </div>

                </div>

                {/* Row 2: Flow Partitions (Feed vs Discharge Split Rates) */}
                <div className="pt-2.5 border-t border-slate-200/60">
                  <h4 className="text-[10px] font-sans font-bold uppercase text-slate-500 tracking-wider mb-2 text-left px-1">
                    Feed & Discharge Partitions Breakdown
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    
                    {/* RAF Feed Total */}
                    <div className="bg-teal-50/50 p-2.5 rounded-xl border border-teal-100/80 text-left">
                      <p className="text-[9px] font-mono text-teal-600 font-extrabold uppercase tracking-wide">Total RAF Feed</p>
                      <p className="text-base font-extrabold font-mono text-teal-800 mt-0.5">
                        {totalRafFeedMin.toFixed(1)} - {totalRafFeedMax.toFixed(1)}
                      </p>
                      <span className="text-[9px] text-teal-600 font-medium font-mono">m³/h</span>
                    </div>

                    {/* ILS Feed Total */}
                    <div className="bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/80 text-left">
                      <p className="text-[9px] font-mono text-indigo-600 font-extrabold uppercase tracking-wide">Total ILS Feed</p>
                      <p className="text-base font-extrabold font-mono text-indigo-800 mt-0.5">
                        {totalIlsFeedMin.toFixed(1)} - {totalIlsFeedMax.toFixed(1)}
                      </p>
                      <span className="text-[9px] text-indigo-600 font-medium font-mono">m³/h</span>
                    </div>

                    {/* PLS Discharge Total */}
                    <div className="bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100/80 text-left">
                      <p className="text-[9px] font-mono text-emerald-600 font-extrabold uppercase tracking-wide">Total PLS Discharge</p>
                      <p className="text-base font-extrabold font-mono text-emerald-800 mt-0.5">
                        {totalPlsDischargeMin.toFixed(1)} - {totalPlsDischargeMax.toFixed(1)}
                      </p>
                      <span className="text-[9px] text-emerald-600 font-medium font-mono">m³/h (Est)</span>
                    </div>

                    {/* ILS Discharge Total */}
                    <div className="bg-violet-50/40 p-2.5 rounded-xl border border-violet-100/80 text-left">
                      <p className="text-[9px] font-mono text-violet-600 font-extrabold uppercase tracking-wide">Total ILS Discharge</p>
                      <p className="text-base font-extrabold font-mono text-violet-800 mt-0.5">
                        {totalIlsDischargeMin.toFixed(1)} - {totalIlsDischargeMax.toFixed(1)}
                      </p>
                      <span className="text-[9px] text-violet-600 font-medium font-mono">m³/h (Est)</span>
                    </div>
                  </div>
                </div>
              </div>
              </>
              )}
            </div>

          </div>

          {/* Row 2: Acid Totalizers and flows (Full Width row, split into 2 columns on large screens) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Box 2. Pond Telemetry Readings */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
              <div 
                className="flex items-center justify-between gap-2 border-b pb-2.5 mb-3 cursor-pointer select-none"
                onClick={() => setIsPondSectionOpen(!isPondSectionOpen)}
              >
                <div className="flex items-center gap-2">
                  <Wrench size={16} className="text-slate-700" />
                  <h3 className="font-sans font-bold text-slate-800 text-sm tracking-wide uppercase">
                    2. ACID PONDS & OUTGOING FLOWS
                  </h3>
                </div>
                <button
                  type="button"
                  className="text-[10px] font-mono hover:text-slate-700 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-2 py-0.5 tracking-wider"
                  onClick={() => setIsPondSectionOpen(!isPondSectionOpen)}
                >
                  {isPondSectionOpen ? "COLLAPSE -" : "EXPAND +"}
                </button>
              </div>

              {isPondSectionOpen && (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  {/* Grid of 4 cards inside a compact view */}
                  <div className="grid grid-cols-2 gap-3.5">
                {/* RAF Pond Card */}
                <PondCard
                  pond={ponds.raf}
                  onUpdate={(up) => setPonds({ ...ponds, raf: up })}
                  errorTotalizer={errors.find(e => e.field === "raf_totalizer")?.message}
                  errorFlow={errors.find(e => e.field === "raf_flow")?.message}
                  history={history}
                />
                {/* ILS Pond Card */}
                <PondCard
                  pond={ponds.ils}
                  onUpdate={(up) => setPonds({ ...ponds, ils: up })}
                  errorTotalizer={errors.find(e => e.field === "ils_totalizer")?.message}
                  errorFlow={errors.find(e => e.field === "ils_flow")?.message}
                  history={history}
                />
                {/* Acid to Crasher */}
                <PondCard
                  pond={ponds.crasher}
                  onUpdate={(up) => setPonds({ ...ponds, crasher: up })}
                  errorTotalizer={errors.find(e => e.field === "crasher_totalizer")?.message}
                  errorFlow={errors.find(e => e.field === "crasher_flow")?.message}
                  history={history}
                />
                {/* Main Line */}
                <PondCard
                  pond={ponds.mainLine}
                  onUpdate={(up) => setPonds({ ...ponds, mainLine: up })}
                  errorTotalizer={errors.find(e => e.field === "mainLine_totalizer")?.message}
                  errorFlow={errors.find(e => e.field === "mainLine_flow")?.message}
                  history={history}
                />
              </div>

              {/* Pond totals analysis block */}
              <div className="text-center p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 font-mono text-xs flex justify-between items-center text-slate-600">
                <span className="font-bold uppercase tracking-wider text-[10px]">Net Plant Water Draw Rate:</span>
                <span className="font-extrabold text-sm text-slate-800">
                  {pondWaterOutSum.toFixed(2)} m³/h
                </span>
              </div>
              </div>
              )}
            </div>

            {/* 'Chemical Balance' Summary Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div 
                className="flex items-center justify-between border-b pb-2.5 cursor-pointer select-none"
                onClick={() => setIsChemicalBalanceOpen(!isChemicalBalanceOpen)}
              >
                <div className="flex items-center gap-2">
                  <Beaker size={16} className="text-indigo-650" />
                  <h3 className="font-sans font-bold text-slate-800 text-sm tracking-wide uppercase">
                    'Chemical Balance' Summary Panel
                  </h3>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {padBalanceStatus === "optimal" && (
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider uppercase rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Optimal
                    </span>
                  )}
                  {padBalanceStatus === "warning" && (
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider uppercase rounded bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                      Warning
                    </span>
                  )}
                  {padBalanceStatus === "error" && (
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider uppercase rounded bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                      Imbalanced
                    </span>
                  )}
                  {padBalanceStatus === "neutral" && (
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider uppercase rounded bg-slate-100 text-slate-600 border border-slate-200">
                      Offline
                    </span>
                  )}
                  <button
                    type="button"
                    className="text-[10px] font-mono hover:text-indigo-700 font-bold text-indigo-500 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded px-2 py-0.5 tracking-wider"
                    onClick={() => setIsChemicalBalanceOpen(!isChemicalBalanceOpen)}
                  >
                    {isChemicalBalanceOpen ? "COLLAPSE -" : "EXPAND +"}
                  </button>
                </div>
              </div>

              {isChemicalBalanceOpen && (
                <>

              {/* Grid of Feed Source Rates on Pads */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-3 bg-teal-50/40 rounded-xl border border-teal-100/60 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase text-teal-600">Total RAF Feed</span>
                    <span className="text-[9px] font-mono font-semibold text-teal-500 bg-teal-100/50 px-1 py-0.2 rounded">
                      {activeRafPadsCount} Pad{activeRafPadsCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-lg font-bold font-mono text-teal-950 mt-1">
                    {avgRafFeed.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">m³/h</span>
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                    Range: {totalRafFeedMin.toFixed(0)} - {totalRafFeedMax.toFixed(0)}
                  </p>
                </div>

                <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100/60 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase text-indigo-600">Total ILS Feed</span>
                    <span className="text-[9px] font-mono font-semibold text-indigo-500 bg-indigo-100/50 px-1 py-0.2 rounded">
                      {activeIlsPadsCount} Pad{activeIlsPadsCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-lg font-bold font-mono text-indigo-950 mt-1">
                    {avgIlsFeed.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">m³/h</span>
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                    Range: {totalIlsFeedMin.toFixed(0)} - {totalIlsFeedMax.toFixed(0)}
                  </p>
                </div>
              </div>

              {/* Main Current Flow Ratio Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wide flex items-center gap-1.5 font-sans">
                    <TrendingUp size={12} className="text-indigo-500" />
                    Heap Feed Ratio (RAF : ILS)
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">Target Range: 0.5 - 2.0</span>
                </div>
                
                <div className="flex items-baseline gap-1">
                  <p className="text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                    {padRatio !== null ? `${padRatio.toFixed(2)}` : "0.00"}
                  </p>
                  <p className="text-xs font-semibold text-slate-400 font-mono">
                    {padRatio !== null ? ": 1" : ""}
                  </p>
                </div>

                {/* Nice visual slider/bar representing ratio status */}
                <div className="mt-4 space-y-1">
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden flex relative">
                    {/* Pink Under-acidified Zone (0 - 0.5) */}
                    <div className="h-full w-[17%] bg-rose-200 border-r border-white/40" title="Under-acidified Zone" />
                    {/* Optimal Zone (0.5 - 2.0) */}
                    <div className="h-full w-[50%] bg-emerald-400/90 border-r border-white/40" title="Optimal Blending Zone" />
                    {/* Pink Over-acidified Zone (2.0 - 3.0) */}
                    <div className="h-full w-[33%] bg-rose-200" title="Over-acidified Zone" />

                    {/* Cursor position of active ratio */}
                    {padRatio !== null && (
                      <div 
                        className="absolute top-0 bottom-0 w-1 bg-slate-900 border border-white h-full transform -translate-x-1/2 shadow-lg transition-all duration-500"
                        style={{ 
                          left: `${Math.min(Math.max((padRatio / 3.0) * 100, 2), 98)}%` 
                        }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-[8px] font-mono text-slate-400 font-semibold select-none">
                    <span>0.0 (Under)</span>
                    <span className="text-emerald-600 font-bold">0.50 (Target Min)</span>
                    <span className="text-emerald-600 font-bold">2.00 (Target Max)</span>
                    <span>3.00+</span>
                  </div>
                </div>
              </div>

              {/* Dynamic alert box with specialized advice */}
              <div className={`p-3.5 rounded-xl text-xs flex gap-2.5 transition-all duration-300 border text-left ${
                padBalanceStatus === "optimal" 
                  ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                  : padBalanceStatus === "warning"
                  ? "bg-amber-50 text-amber-800 border-amber-200/70"
                  : padBalanceStatus === "error"
                  ? "bg-rose-50 text-rose-800 border-rose-100/60 animate-pulse"
                  : "bg-slate-50 text-slate-500 border-slate-200/50"
              }`}>
                {padBalanceStatus === "optimal" ? (
                  <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                ) : padBalanceStatus === "error" ? (
                  <ShieldAlert size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="font-semibold">{padBalanceMsg}</p>
                  
                  {padBalanceStatus === "optimal" && (
                    <p className="text-[10px] text-emerald-700/80 leading-normal font-sans">
                      The core reaction chemistry is perfectly buffered. Acid dissolution is optimized while keeping metal trace values high.
                    </p>
                  )}
                  {padBalanceStatus === "error" && padRatio !== null && padRatio < targetMin && (
                    <p className="text-[10px] text-rose-700/80 leading-normal font-sans">
                      <strong>Troubleshooting Protocol:</strong> Increase Raffinate flow rates (RAF) across active loops or toggle selected ILS loops to RAF feed type to maintain solvent saturation levels.
                    </p>
                  )}
                  {padBalanceStatus === "error" && padRatio !== null && padRatio > targetMax && (
                    <p className="text-[10px] text-rose-700/80 leading-normal font-sans">
                      <strong>Troubleshooting Protocol:</strong> Reduce Raffinate raw acid dosing, or convert high-rate RAF loops into recurrent ILS leaching mode to balance saturation limits.
                    </p>
                  )}
                  {padBalanceStatus === "warning" && (
                    <p className="text-[10px] text-amber-700/85 leading-normal font-sans">
                      Recirculating intermediate solutions (ILS) reduces net sulfur consumption. Consider introducing dual blending on long-term irrigated heaps.
                    </p>
                  )}
                  {padBalanceStatus === "neutral" && (
                    <p className="text-[10px] text-slate-400 leading-normal font-sans">
                      Averages will reflect automatically as soon as an operator starts any irrigation loops.
                    </p>
                  )}
                </div>
              </div>

              {/* Crosscheck correlation with Ponds */}
              {ponds.raf.flow > 0 && ponds.ils.flow > 0 && (
                <div className="flex border-t border-dashed border-slate-200 pt-3 justify-between items-center text-[10px] font-mono text-slate-550">
                  <span className="flex items-center gap-1">
                    <History size={11} />
                    Core Pond Outflow Ratio Crosscheck:
                  </span>
                  <span className={`font-bold ${
                    (ponds.raf.flow / ponds.ils.flow > 2.0 || ponds.raf.flow / ponds.ils.flow < 0.5) 
                      ? "text-amber-600" 
                      : "text-emerald-600"
                  }`}>
                    {(ponds.raf.flow / ponds.ils.flow).toFixed(2)} : 1
                  </span>
                </div>
              )}
              </>
              )}
            </div>

          </div>

          {/* Row 3: The Rest (Two-column layout below) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT SECTION (Col 1-7): Advanced Metallurgical Process & SX/EW Telemetry and downstream tools */}
            <section className="lg:col-span-7 space-y-4">

              {/* Box 1B: Advanced Metallurgical Process & SX/EW Telemetry Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-left space-y-4">
              
              {/* Header */}
              <div 
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 cursor-pointer select-none"
                onClick={() => setIsAdvancedProcessOpen(!isAdvancedProcessOpen)}
              >
                <div className="flex items-center gap-2">
                  <Sliders size={18} className="text-indigo-600" />
                  <div>
                    <h3 className="font-sans font-bold text-slate-800 text-sm tracking-wide uppercase">
                      ADVANCED PROCESS & SX-EW TELEMETRY
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      16 Secondary Process Signals (Levels, pump speeds, flows & reserves)
                    </p>
                  </div>
                </div>
                
                {/* Visual count indicator */}
                <div className="flex items-center gap-1.5 select-none self-start sm:self-auto" onClick={(e) => e.stopPropagation()}>
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  <span className="font-mono text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/50 px-2 py-0.5 rounded-lg text-xs leading-none">
                    32 Signals Online
                  </span>
                  <button
                    type="button"
                    className="text-[10px] font-mono hover:text-indigo-700 font-bold text-indigo-500 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded px-2 py-0.5 tracking-wider ml-1.5"
                    onClick={() => setIsAdvancedProcessOpen(!isAdvancedProcessOpen)}
                  >
                    {isAdvancedProcessOpen ? "COLLAPSE -" : "EXPAND +"}
                  </button>
                </div>
              </div>

              {isAdvancedProcessOpen && (
                <div className="space-y-4">

              {/* Segmented control tab bar */}
              <div className="flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1 text-[10px] font-mono leading-tight font-bold">
                <button
                  type="button"
                  onClick={() => setActiveProcessTab("pond_pump")}
                  className={`flex-1 min-w-[125px] px-2.5 py-1.5 rounded-lg cursor-pointer text-center transition-all ${
                    activeProcessTab === "pond_pump"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-750"
                  }`}
                >
                  Ponds & Pumps (8)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProcessTab("acid_tanks")}
                  className={`flex-1 min-w-[125px] px-2.5 py-1.5 rounded-lg cursor-pointer text-center transition-all ${
                    activeProcessTab === "acid_tanks"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-550 hover:bg-slate-50 hover:text-slate-750"
                  }`}
                >
                  Acid Reserves (5)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProcessTab("ew_advance")}
                  className={`flex-1 min-w-[125px] px-2.5 py-1.5 rounded-lg cursor-pointer text-center transition-all ${
                    activeProcessTab === "ew_advance"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-550 hover:bg-slate-50 hover:text-slate-750"
                  }`}
                >
                  EW & Buffers (11)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProcessTab("organic_sx")}
                  className={`flex-1 min-w-[125px] px-2.5 py-1.5 rounded-lg cursor-pointer text-center transition-all ${
                    activeProcessTab === "organic_sx"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-550 hover:bg-slate-50 hover:text-slate-750"
                  }`}
                >
                  SX & Extraction (11)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProcessTab("calculators")}
                  className={`flex-1 min-w-[125px] px-2.5 py-1.5 rounded-lg cursor-pointer text-center transition-all ${
                    activeProcessTab === "calculators"
                      ? "bg-indigo-650 text-white shadow-sm font-extrabold"
                      : "text-indigo-650 hover:bg-indigo-50/50 hover:text-indigo-900 bg-indigo-50/10"
                  }`}
                >
                  ⚡ Plant Calculators
                </button>
              </div>

              {/* Active Tab Content renders inputs */}
              <div className="space-y-4 pt-1">
                
                {activeProcessTab === "pond_pump" && (
                  <div className="space-y-4">
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Heap irrigation and Solvent Extraction (SX) circuits rely on precise hydraulic pond levels. Monitor and alter storage depths and active pump transmissions.
                    </p>
                    
                    {/* PLS Flow to SX */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-50/50 p-3.5 rounded-xl border border-slate-200/60">
                      <div className="md:col-span-5 space-y-0.5">
                        <label className="text-xs font-bold text-slate-800 font-sans flex items-center gap-1.5">
                          <Gauge size={13} className="text-teal-600" />
                          1. PLS Flow to SX
                        </label>
                        <p className="text-[10px] text-slate-400 font-mono">SX circuit active intake rate (m³/h)</p>
                      </div>
                      <div className="md:col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={extraTelemetry.plsFlowToSx}
                          onChange={(e) => setExtraTelemetry({ 
                            ...extraTelemetry, 
                            plsFlowToSx: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                          })}
                          className="w-full text-right font-mono bg-white border border-slate-200 rounded-lg text-sm px-2.5 py-1.5 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                      <div className="md:col-span-4 flex items-center gap-2">
                        <div className="h-2 flex-grow rounded-full bg-slate-200 overflow-hidden">
                          <div 
                            className="h-full bg-teal-500 transition-all duration-300"
                            style={{ width: `${Math.min((extraTelemetry.plsFlowToSx / 750) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 font-mono w-14 text-right">
                          {Math.min((extraTelemetry.plsFlowToSx / 750) * 100, 100).toFixed(0)}% safety
                        </span>
                      </div>
                    </div>

                    {/* Primary Process Ponds Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* PLS Loop */}
                      <div className="p-3 bg-teal-50/20 rounded-xl border border-teal-100 space-y-3">
                        <div className="flex justify-between items-center border-b border-teal-100/60 pb-1">
                          <span className="text-[10px] font-mono font-bold text-teal-700 uppercase">PLS Pond</span>
                          <span className="text-[8px] font-mono text-teal-600 bg-teal-100/30 px-1 py-0.2 rounded">Feed A</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10.5px] font-mono text-slate-600">
                            <span>2. PLS Pond level</span>
                            <span className="font-extrabold text-slate-800">{extraTelemetry.plsPondLevel.toFixed(2)} %</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.05"
                            value={extraTelemetry.plsPondLevel}
                            onChange={(e) => setExtraTelemetry({ ...extraTelemetry, plsPondLevel: parseFloat(e.target.value) })}
                            className="w-full accent-teal-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10.5px] font-mono text-slate-600">
                            <span>3. PLS Pump speed</span>
                            <span className="font-extrabold text-slate-800">{extraTelemetry.plsPumpSpeed.toFixed(1)} %</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.5"
                            value={extraTelemetry.plsPumpSpeed}
                            onChange={(e) => setExtraTelemetry({ ...extraTelemetry, plsPumpSpeed: parseFloat(e.target.value) })}
                            className="w-full accent-teal-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* ILS Loop */}
                      <div className="p-3 bg-indigo-50/20 rounded-xl border border-indigo-100 space-y-3">
                        <div className="flex justify-between items-center border-b border-indigo-100/60 pb-1">
                          <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase">ILS Pond</span>
                          <span className="text-[8px] font-mono text-indigo-600 bg-indigo-100/30 px-1 py-0.2 rounded">Feed B</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10.5px] font-mono text-slate-600">
                            <span>4. ILS Pond level</span>
                            <span className="font-extrabold text-slate-800">{extraTelemetry.ilsPondLevel.toFixed(2)} %</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.05"
                            value={extraTelemetry.ilsPondLevel}
                            onChange={(e) => setExtraTelemetry({ ...extraTelemetry, ilsPondLevel: parseFloat(e.target.value) })}
                            className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10.5px] font-mono text-slate-600">
                            <span>5. ILS Pump speed</span>
                            <span className="font-extrabold text-slate-800">{extraTelemetry.ilsPumpSpeed.toFixed(1)} %</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.5"
                            value={extraTelemetry.ilsPumpSpeed}
                            onChange={(e) => setExtraTelemetry({ ...extraTelemetry, ilsPumpSpeed: parseFloat(e.target.value) })}
                            className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* RAF Loop */}
                      <div className="p-3 bg-sky-50/20 rounded-xl border border-sky-100 space-y-3">
                        <div className="flex justify-between items-center border-b border-sky-100/60 pb-1">
                          <span className="text-[10px] font-mono font-bold text-sky-700 uppercase">Raffinate Pond</span>
                          <span className="text-[8px] font-mono text-sky-600 bg-sky-100/30 px-1 py-0.2 rounded">Feed C</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10.5px] font-mono text-slate-600">
                            <span>6. RAF Pond level</span>
                            <span className="font-extrabold text-slate-800">{extraTelemetry.rafPondLevel.toFixed(2)} %</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.05"
                            value={extraTelemetry.rafPondLevel}
                            onChange={(e) => setExtraTelemetry({ ...extraTelemetry, rafPondLevel: parseFloat(e.target.value) })}
                            className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10.5px] font-mono text-slate-600">
                            <span>7. RAF Pump speed</span>
                            <span className="font-extrabold text-slate-800">{extraTelemetry.rafPumpSpeed.toFixed(1)} %</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.5"
                            value={extraTelemetry.rafPumpSpeed}
                            onChange={(e) => setExtraTelemetry({ ...extraTelemetry, rafPumpSpeed: parseFloat(e.target.value) })}
                            className="w-full accent-sky-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Aux Ponds Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Storm Water Pond */}
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                        <div className="flex justify-between items-center border-b border-slate-205 pb-1">
                          <span className="text-[10px] font-mono font-bold text-slate-600 uppercase">Storm Water Pond</span>
                          <span className="text-[8.5px] font-mono text-slate-500 font-semibold">Aux Storage</span>
                        </div>
                        <div className="grid grid-cols-12 gap-3 items-center">
                          <div className="col-span-8">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="0.1"
                              value={extraTelemetry.stormWaterPondLevel}
                              onChange={(e) => setExtraTelemetry({ ...extraTelemetry, stormWaterPondLevel: parseFloat(e.target.value) })}
                              className="w-full accent-slate-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer animate-none"
                            />
                          </div>
                          <div className="col-span-4 text-right">
                            <span className="font-mono text-xs font-extrabold text-slate-800 bg-white px-2 py-1 rounded border">
                              {extraTelemetry.stormWaterPondLevel.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Raw Water Pond */}
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                        <div className="flex justify-between items-center border-b border-slate-205 pb-1">
                          <span className="text-[10px] font-mono font-bold text-slate-600 uppercase">Raw Water Pond</span>
                          <span className="text-[8.5px] font-mono text-slate-500 font-semibold">Make-Up Reserve</span>
                        </div>
                        <div className="grid grid-cols-12 gap-3 items-center">
                          <div className="col-span-8">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="0.1"
                              value={extraTelemetry.rawWaterPondLevel}
                              onChange={(e) => setExtraTelemetry({ ...extraTelemetry, rawWaterPondLevel: parseFloat(e.target.value) })}
                              className="w-full accent-slate-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer animate-none"
                            />
                          </div>
                          <div className="col-span-4 text-right">
                            <span className="font-mono text-xs font-extrabold text-slate-800 bg-white px-2 py-1 rounded border">
                              {extraTelemetry.rawWaterPondLevel.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeProcessTab === "acid_tanks" && (
                  <div className="space-y-4">
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Managing highly concentrated Sulfuric Acid reserves is critical to protect pH and copper recovery matrices. High-capacity monitoring across crushing complexes and heap dosing lines.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                      {/* Tank 1 */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 flex flex-col justify-between">
                        <div className="flex items-center justify-between border-b pb-1">
                          <span className="text-[9.5px] font-mono font-bold text-slate-500 uppercase">Acid Silo 1</span>
                          <span className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded border ${
                            extraTelemetry.acidTank1Level < 15 ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                          }`}>
                            {extraTelemetry.acidTank1Level < 15 ? "Critical" : "Secure"}
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-2 items-center justify-center my-1.5">
                          <div className="w-8 h-16 bg-slate-200 border border-slate-300 rounded-lg overflow-hidden relative flex flex-col justify-end shadow-inner">
                            <div 
                              className={`w-full transition-all duration-300 ${
                                extraTelemetry.acidTank1Level < 15 ? "bg-rose-500" : "bg-indigo-500"
                              }`}
                              style={{ height: `${extraTelemetry.acidTank1Level}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-[10px] font-mono font-black text-slate-900 bg-white/70 px-1 rounded">
                                {extraTelemetry.acidTank1Level.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 text-center">
                          <label className="block text-[10px] text-slate-600 font-bold">8. Tank 1 level</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.acidTank1Level}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              acidTank1Level: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-xs bg-white border border-slate-200 rounded-md py-1 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </div>
                      </div>

                      {/* Tank 2 */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 flex flex-col justify-between">
                        <div className="flex items-center justify-between border-b pb-1">
                          <span className="text-[9.5px] font-mono font-bold text-slate-500 uppercase">Acid Silo 2</span>
                          <span className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded border ${
                            extraTelemetry.acidTank2Level < 15 ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                          }`}>
                            {extraTelemetry.acidTank2Level < 15 ? "Critical" : "Secure"}
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-2 items-center justify-center my-1.5">
                          <div className="w-8 h-16 bg-slate-200 border border-slate-300 rounded-lg overflow-hidden relative flex flex-col justify-end shadow-inner">
                            <div 
                              className={`w-full transition-all duration-300 ${
                                extraTelemetry.acidTank2Level < 15 ? "bg-rose-500" : "bg-indigo-500"
                              }`}
                              style={{ height: `${extraTelemetry.acidTank2Level}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-[10px] font-mono font-black text-slate-900 bg-white/70 px-1 rounded">
                                {extraTelemetry.acidTank2Level.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 text-center">
                          <label className="block text-[10px] text-slate-600 font-bold">9. Tank 2 level</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.acidTank2Level}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              acidTank2Level: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-xs bg-white border border-slate-200 rounded-md py-1 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </div>
                      </div>

                      {/* Tank Small */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 flex flex-col justify-between">
                        <div className="flex items-center justify-between border-b pb-1">
                          <span className="text-[9.5px] font-mono font-bold text-slate-500 uppercase">Acid Small</span>
                          <span className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded border ${
                            extraTelemetry.acidTank3Level < 10 ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" : "bg-sky-50 text-sky-700 border-sky-100"
                          }`}>
                            {extraTelemetry.acidTank3Level < 10 ? "Dosing Risk" : "Active"}
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-2 items-center justify-center my-1.5">
                          <div className="w-8 h-16 bg-slate-200 border border-slate-300 rounded-lg overflow-hidden relative flex flex-col justify-end shadow-inner">
                            <div 
                              className={`w-full transition-all duration-300 ${
                                extraTelemetry.acidTank3Level < 10 ? "bg-rose-500" : "bg-sky-500"
                              }`}
                              style={{ height: `${extraTelemetry.acidTank3Level}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-[10px] font-mono font-black text-slate-900 bg-white/70 px-1 rounded">
                                {extraTelemetry.acidTank3Level.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 text-center">
                          <label className="block text-[10px] text-slate-600 font-bold">10. Acid Tank Small</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.acidTank3Level}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              acidTank3Level: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-xs bg-white border border-slate-200 rounded-md py-1 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </div>
                      </div>

                      {/* Gyro Crusher Acid Tank Level */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 flex flex-col justify-between">
                        <div className="flex items-center justify-between border-b pb-1">
                          <span className="text-[9.5px] font-mono font-bold text-slate-500 uppercase">Gyro Crusher</span>
                          <span className="text-[8px] font-mono font-bold px-1 py-0.2 rounded border bg-slate-100 text-slate-600 border-slate-200">
                            Process
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-2 items-center justify-center my-1.5">
                          <div className="w-8 h-16 bg-slate-200 border border-slate-300 rounded-lg overflow-hidden relative flex flex-col justify-end shadow-inner">
                            <div 
                              className="w-full bg-indigo-500 transition-all duration-300"
                              style={{ height: `${extraTelemetry.gyroCrusherAcidTankLevel}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-[10px] font-mono font-black text-slate-900 bg-white/70 px-1 rounded">
                                {extraTelemetry.gyroCrusherAcidTankLevel?.toFixed(0) || "0"}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 text-center">
                          <label className="block text-[10px] text-slate-605 font-bold">Gyro Acid Level</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.gyroCrusherAcidTankLevel || 0}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              gyroCrusherAcidTankLevel: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-xs bg-white border border-slate-200 rounded-md py-1 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </div>
                      </div>

                      {/* Jaw Crusher Acid Tank Level */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 flex flex-col justify-between">
                        <div className="flex items-center justify-between border-b pb-1">
                          <span className="text-[9.5px] font-mono font-bold text-slate-500 uppercase">Jaw Crusher</span>
                          <span className="text-[8px] font-mono font-bold px-1 py-0.2 rounded border bg-slate-100 text-slate-600 border-slate-200">
                            Process
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-2 items-center justify-center my-1.5">
                          <div className="w-8 h-16 bg-slate-200 border border-slate-300 rounded-lg overflow-hidden relative flex flex-col justify-end shadow-inner">
                            <div 
                              className="w-full bg-indigo-500 transition-all duration-300"
                              style={{ height: `${extraTelemetry.jawCrusherAcidTankLevel}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-[10px] font-mono font-black text-slate-900 bg-white/70 px-1 rounded">
                                {extraTelemetry.jawCrusherAcidTankLevel?.toFixed(0) || "0"}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 text-center">
                          <label className="block text-[10px] text-slate-605 font-bold">Jaw Acid Level</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.jawCrusherAcidTankLevel || 0}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              jawCrusherAcidTankLevel: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-xs bg-white border border-slate-200 rounded-md py-1 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeProcessTab === "ew_advance" && (
                  <div className="space-y-4">
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Electrowinning (EW) extracts pure copper via high-density electrical transmission. Surge reservoirs buffer advance fluid flows and spent recirculation streams.
                    </p>
                    
                    {/* Section 1: EW Transmission Lines & Rectifier Power */}
                    <div className="bg-indigo-50/15 p-3.5 rounded-xl border border-indigo-150/40 space-y-3">
                      <h4 className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-wider border-b border-indigo-100 pb-1.5 flex items-center justify-between">
                        <span>EW Current & Transmission Flows</span>
                        <span className="text-[8.5px] font-sans bg-indigo-100/60 text-indigo-800 px-1.5 rounded font-black">ACTIVE MAIN</span>
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* EW Rectifier Current */}
                        <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm space-y-1.5">
                          <label className="block text-[10.5px] font-bold text-slate-800">
                            EW Rectifier Current
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={extraTelemetry.ewRectifierCurrent || 0}
                              onChange={(e) => setExtraTelemetry({ 
                                ...extraTelemetry, 
                                ewRectifierCurrent: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                              })}
                              className="w-full text-right font-mono text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:bg-white focus:border-indigo-400 focus:outline-none"
                            />
                            <span className="text-[10.5px] font-mono font-bold text-slate-500">KA</span>
                          </div>
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-650 transition-all duration-300"
                              style={{ width: `${Math.min(((extraTelemetry.ewRectifierCurrent || 0) / 40) * 100, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Advance flow to EW */}
                        <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm space-y-1.5">
                          <label className="block text-[10.5px] font-bold text-slate-800 animate-none">
                            11. Advance Flow to EW
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={extraTelemetry.advanceFlowToEw}
                              onChange={(e) => setExtraTelemetry({ 
                                ...extraTelemetry, 
                                advanceFlowToEw: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                              })}
                              className="w-full text-right font-mono text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:bg-white focus:border-indigo-400 focus:outline-none"
                            />
                            <span className="text-[10px] font-mono text-slate-550 w-11">m³/h</span>
                          </div>
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-teal-550 transition-all duration-300"
                              style={{ width: `${Math.min((extraTelemetry.advanceFlowToEw / 400) * 100, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Spent flow to SX */}
                        <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm space-y-1.5">
                          <label className="block text-[10.5px] font-bold text-slate-800">
                            Spent Flow to SX
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={extraTelemetry.spentFlowToSx || 0}
                              onChange={(e) => setExtraTelemetry({ 
                                ...extraTelemetry, 
                                spentFlowToSx: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                              })}
                              className="w-full text-right font-mono text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:bg-white focus:border-indigo-400 focus:outline-none"
                            />
                            <span className="text-[10px] font-mono text-slate-550 w-11">m³/h</span>
                          </div>
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 transition-all duration-300"
                              style={{ width: `${Math.min(((extraTelemetry.spentFlowToSx || 0) / 400) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Surge & Buffer Tank Capacities */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 space-y-3">
                      <h4 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider border-b pb-1.5 flex items-center justify-between">
                        <span>Advance & Recirculation Surge Tanks</span>
                        <span className="text-[8.5px] font-sans bg-slate-200 text-slate-700 px-1.5 rounded font-black">VOLUMES</span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {/* Advance Tank level */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                          <span className="block text-[10px] font-bold text-slate-600">13. Advance Tank</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.advanceTankLevel}
                            onChange={(e) => setExtraTelemetry({ ...extraTelemetry, advanceTankLevel: parseFloat(e.target.value) })}
                            className="w-full accent-indigo-650 h-1 cursor-pointer bg-slate-100 rounded"
                          />
                          <div className="flex justify-between text-[9px] font-mono text-slate-500">
                            <span>Capacity</span>
                            <span className="font-bold text-slate-800">{extraTelemetry.advanceTankLevel.toFixed(1)}%</span>
                          </div>
                        </div>

                        {/* Advance Tank level SX2 */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                          <span className="block text-[10px] font-bold text-slate-600">Advance Tank SX2</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.advanceTankLevelSx2 || 0}
                            onChange={(e) => setExtraTelemetry({ ...extraTelemetry, advanceTankLevelSx2: parseFloat(e.target.value) })}
                            className="w-full accent-indigo-650 h-1 cursor-pointer bg-slate-100 rounded"
                          />
                          <div className="flex justify-between text-[9px] font-mono text-slate-500">
                            <span>Capacity</span>
                            <span className="font-bold text-slate-800">{(extraTelemetry.advanceTankLevelSx2 || 0).toFixed(1)}%</span>
                          </div>
                        </div>

                        {/* Spent Tank level */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                          <span className="block text-[10px] font-bold text-slate-600">Spent Tank Level</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.spentTankLevel || 0}
                            onChange={(e) => setExtraTelemetry({ ...extraTelemetry, spentTankLevel: parseFloat(e.target.value) })}
                            className="w-full accent-indigo-650 h-1 cursor-pointer bg-slate-100 rounded"
                          />
                          <div className="flex justify-between text-[9px] font-mono text-slate-500">
                            <span>Capacity</span>
                            <span className="font-bold text-slate-800">{(extraTelemetry.spentTankLevel || 0).toFixed(1)}%</span>
                          </div>
                        </div>

                        {/* New Spent Tank level */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                          <span className="block text-[10px] font-bold text-slate-600">New Spent Tank</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.newSpentTankLevel || 0}
                            onChange={(e) => setExtraTelemetry({ ...extraTelemetry, newSpentTankLevel: parseFloat(e.target.value) })}
                            className="w-full accent-indigo-650 h-1 cursor-pointer bg-slate-100 rounded"
                          />
                          <div className="flex justify-between text-[9px] font-mono text-slate-500">
                            <span>Capacity</span>
                            <span className="font-bold text-slate-800">{(extraTelemetry.newSpentTankLevel || 0).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Auxiliary Buffer & Reagent Modules */}
                    <div className="bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200/80 space-y-3">
                      <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider border-b pb-1.5 flex items-center justify-between">
                        <span>Auxiliary Controls & Secondary Tanks</span>
                        <span className="text-[8.5px] font-sans bg-slate-100 text-slate-500 px-1.5 rounded font-black">SECONDARY</span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                        {/* HG Raffinate Tank Level SX2 */}
                        <div className="bg-white/80 p-2 rounded-md border border-slate-200 text-center space-y-1">
                          <span className="block text-[9.5px] font-bold text-slate-550 leading-tight">HG Raffinate SX2</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.hgRaffinateTankLevelSx2 || 0}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              hgRaffinateTankLevelSx2: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-[11px] bg-slate-50 border border-slate-200 rounded py-0.5 focus:bg-white focus:outline-none"
                          />
                          <span className="block font-mono text-[9px] text-indigo-650 font-bold">
                            {(extraTelemetry.hgRaffinateTankLevelSx2 || 0).toFixed(1)}% Vol
                          </span>
                        </div>

                        {/* Backwash Tank level */}
                        <div className="bg-white/80 p-2 rounded-md border border-slate-200 text-center space-y-1">
                          <span className="block text-[9.5px] font-bold text-slate-550 leading-tight">Backwash Tank</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={extraTelemetry.backwashTankLevel || 0}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              backwashTankLevel: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-[11px] bg-slate-50 border border-slate-200 rounded py-0.5 focus:bg-white focus:outline-none"
                          />
                          <span className="block font-mono text-[9px] text-indigo-650 font-bold">
                            {(extraTelemetry.backwashTankLevel || 0).toFixed(2)}% Vol
                          </span>
                        </div>

                        {/* Intermediate level */}
                        <div className="bg-white/80 p-2 rounded-md border border-slate-200 text-center space-y-1">
                          <span className="block text-[9.5px] font-bold text-slate-550 leading-tight">Intermediate Tank</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.intermediateLevel || 0}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              intermediateLevel: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-[11px] bg-slate-50 border border-slate-200 rounded py-0.5 focus:bg-white focus:outline-none"
                          />
                          <span className="block font-mono text-[9px] text-indigo-650 font-bold">
                            {(extraTelemetry.intermediateLevel || 0).toFixed(1)}% Vol
                          </span>
                        </div>

                        {/* Diesel Tank Burner */}
                        <div className="bg-white/80 p-2 rounded-md border border-slate-200 text-center space-y-1">
                          <span className="block text-[9.5px] font-bold text-slate-550 leading-tight">Diesel Burner</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.dieselTankBurner || 0}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              dieselTankBurner: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-[11px] bg-slate-50 border border-slate-200 rounded py-0.5 focus:bg-white focus:outline-none"
                          />
                          <span className="block font-mono text-[9px] text-indigo-650 font-bold">
                            {(extraTelemetry.dieselTankBurner || 0).toFixed(1)}% Vol
                          </span>
                        </div>

                        {/* Advance pump speed */}
                        <div className="bg-white/85 p-2 rounded-md border border-slate-205 text-center space-y-1">
                          <span className="block text-[9.5px] font-bold text-slate-550 leading-tight">12. Advance Pump</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.advancePumpSpeed}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              advancePumpSpeed: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-[11px] bg-slate-50 border border-slate-200 rounded py-0.5 focus:bg-white focus:outline-none"
                          />
                          <span className="block font-mono text-[9px] text-teal-650 font-bold">
                            {extraTelemetry.advancePumpSpeed.toFixed(1)}% Speed
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeProcessTab === "organic_sx" && (
                  <div className="space-y-4">
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Solvent Extraction (SX) transports copper molecules from aqueous leach solutions using diluent and organic active carriers. Configure extraction transmission rates and circulation loads.
                    </p>
                    
                    {/* Section 1: Main Circuit Streams */}
                    <div className="bg-fuchsia-50/15 p-3.5 rounded-xl border border-fuchsia-150/40 space-y-3">
                      <h4 className="text-[10px] font-mono font-bold text-fuchsia-700 uppercase tracking-wider border-b border-fuchsia-100 pb-1.5 flex items-center justify-between">
                        <span>Main Circuit Intake & Outgoing Streams</span>
                        <span className="text-[8.5px] font-sans bg-fuchsia-100/60 text-fuchsia-800 px-1.5 rounded font-black">OVERALL</span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Total Raffinate Flow */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                          <span className="block text-[10.5px] font-bold text-slate-800">Total Raffinate Flow</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={extraTelemetry.totalRaffinateFlow || 0}
                              onChange={(e) => setExtraTelemetry({ 
                                ...extraTelemetry, 
                                totalRaffinateFlow: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                              })}
                              className="w-full text-right font-mono text-xs bg-slate-50 border border-slate-200 rounded py-1 px-1.5 focus:bg-white focus:outline-none"
                            />
                            <span className="text-[9.5px] font-mono text-slate-400">m³/h</span>
                          </div>
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                            <div 
                              className="h-full bg-fuchsia-600 transition-all duration-300"
                              style={{ width: `${Math.min(((extraTelemetry.totalRaffinateFlow || 0) / 1200) * 100, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Total ILS Flow */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                          <span className="block text-[10.5px] font-bold text-slate-800">Total ILS Flow</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={extraTelemetry.totalIlsFlow || 0}
                              onChange={(e) => setExtraTelemetry({ 
                                ...extraTelemetry, 
                                totalIlsFlow: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                              })}
                              className="w-full text-right font-mono text-xs bg-slate-50 border border-slate-200 rounded py-1 px-1.5 focus:bg-white focus:outline-none"
                            />
                            <span className="text-[9.5px] font-mono text-slate-400">m³/h</span>
                          </div>
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                            <div 
                              className="h-full bg-fuchsia-650 transition-all duration-300"
                              style={{ width: `${Math.min(((extraTelemetry.totalIlsFlow || 0) / 1000) * 100, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* New Circulation Flow */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                          <span className="block text-[10.5px] font-bold text-slate-800">New Circulation Flow</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={extraTelemetry.newCirculationFlow || 0}
                              onChange={(e) => setExtraTelemetry({ 
                                ...extraTelemetry, 
                                newCirculationFlow: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                              })}
                              className="w-full text-right font-mono text-xs bg-slate-50 border border-slate-200 rounded py-1 px-1.5 focus:bg-white focus:outline-none"
                            />
                            <span className="text-[9.5px] font-mono text-slate-400">m³/h</span>
                          </div>
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                            <div 
                              className="h-full bg-fuchsia-700 transition-all duration-300"
                              style={{ width: `${Math.min(((extraTelemetry.newCirculationFlow || 0) / 1500) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Phase A & B Feeder Streams */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 space-y-3">
                      <h4 className="text-[10px] font-mono font-bold text-slate-505 uppercase tracking-wider border-b pb-1.5 flex items-center justify-between">
                        <span>Settler Phase Inlet Streams</span>
                        <span className="text-[8.5px] font-sans bg-slate-200 text-slate-700 px-1.5 rounded font-black">PHASE FEEDS</span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {/* PLS Flow to SX */}
                        <div className="bg-white p-2 text-center border rounded space-y-1">
                          <span className="block text-[10px] font-bold text-slate-600">PLS Flow SX</span>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={extraTelemetry.plsFlowToSx}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              plsFlowToSx: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-xs bg-slate-50 border rounded py-0.5 focus:bg-white focus:outline-none"
                          />
                          <span className="block text-[8.5px] font-mono text-slate-400">m³/h feed</span>
                        </div>

                        {/* PLS Flow to SX2 */}
                        <div className="bg-white p-2 text-center border rounded space-y-1">
                          <span className="block text-[10px] font-bold text-slate-600">PLS Flow SX2</span>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={extraTelemetry.plsFlowToSx2 || 0}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              plsFlowToSx2: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-xs bg-slate-50 border rounded py-0.5 focus:bg-white focus:outline-none"
                          />
                          <span className="block text-[8.5px] font-mono text-slate-400">m³/h feed</span>
                        </div>

                        {/* ILS Flow to SX2 */}
                        <div className="bg-white p-2 text-center border rounded space-y-1">
                          <span className="block text-[10px] font-bold text-slate-600">ILS Flow SX2</span>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={extraTelemetry.ilsFlowToSx2 || 0}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              ilsFlowToSx2: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-xs bg-slate-50 border rounded py-0.5 focus:bg-white focus:outline-none"
                          />
                          <span className="block text-[8.5px] font-mono text-slate-400">m³/h feed</span>
                        </div>

                        {/* Organic pump speed */}
                        <div className="bg-white p-2 text-center border rounded space-y-1">
                          <span className="block text-[10px] font-bold text-slate-600">15. Organic Pump</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.organicPumpSpeed}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              organicPumpSpeed: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-xs bg-slate-50 border rounded py-0.5 focus:bg-white focus:outline-none"
                          />
                          <span className="block text-[9px] font-mono font-bold text-fuchsia-600">
                            {extraTelemetry.organicPumpSpeed.toFixed(1)}% speed
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Organic Solution Reservoirs */}
                    <div className="bg-slate-50/50 p-3.5 rounded-xl border border-dashed border-slate-200 space-y-3">
                      <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider border-b pb-1.5 flex items-center justify-between">
                        <span>Organic Active Reagent Loop & Storage</span>
                        <span className="text-[8.5px] font-sans bg-slate-100 text-slate-500 px-1.5 rounded font-black">REAGENT CORES</span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {/* Organic tank level */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-150 space-y-1">
                          <span className="block text-[10px] font-bold text-slate-600">14. Organic Tank</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.organicTankLevel}
                            onChange={(e) => setExtraTelemetry({ ...extraTelemetry, organicTankLevel: parseFloat(e.target.value) })}
                            className="w-full accent-fuchsia-600 h-1 cursor-pointer bg-slate-100 rounded animate-none"
                          />
                          <div className="flex justify-between text-[9px] font-mono text-slate-550">
                            <span>Inventory</span>
                            <span className="font-bold text-slate-850">{extraTelemetry.organicTankLevel.toFixed(1)}%</span>
                          </div>
                        </div>

                        {/* Organic tank level SX2 */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-150 space-y-1">
                          <span className="block text-[10px] font-bold text-slate-600">Organic Tank SX2</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.organicTankLevelSx2 || 0}
                            onChange={(e) => setExtraTelemetry({ ...extraTelemetry, organicTankLevelSx2: parseFloat(e.target.value) })}
                            className="w-full accent-fuchsia-600 h-1 cursor-pointer bg-slate-100 rounded"
                          />
                          <div className="flex justify-between text-[9px] font-mono text-slate-550">
                            <span>Inventory</span>
                            <span className="font-bold text-slate-850">{(extraTelemetry.organicTankLevelSx2 || 0).toFixed(1)}%</span>
                          </div>
                        </div>

                        {/* Diluent tank level */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-150 space-y-1">
                          <span className="block text-[10px] font-bold text-slate-600">Diluent Tank</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={extraTelemetry.diluentTankLevel || 0}
                            onChange={(e) => setExtraTelemetry({ ...extraTelemetry, diluentTankLevel: parseFloat(e.target.value) })}
                            className="w-full accent-fuchsia-600 h-1 cursor-pointer bg-slate-100 rounded"
                          />
                          <div className="flex justify-between text-[9px] font-mono text-slate-550">
                            <span>Cargo</span>
                            <span className="font-bold text-slate-850">{(extraTelemetry.diluentTankLevel || 0).toFixed(1)}%</span>
                          </div>
                        </div>

                        {/* Organic flow */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-150 text-center space-y-1 flex flex-col justify-between">
                          <span className="block text-[9.5px] font-bold text-slate-600 leading-tight">16. Organic Flow</span>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={extraTelemetry.organicFlow}
                            onChange={(e) => setExtraTelemetry({ 
                              ...extraTelemetry, 
                              organicFlow: e.target.value === "" ? 0 : parseFloat(e.target.value) 
                            })}
                            className="w-full text-center font-mono text-xs bg-slate-50 border border-slate-200 rounded py-0.5 focus:bg-white focus:outline-none"
                          />
                          <span className="block font-mono text-[9px] text-fuchsia-700 font-bold leading-none mt-1">
                            {extraTelemetry.organicFlow.toFixed(1)} m³/h
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeProcessTab === "calculators" && (
                  <div className="space-y-5 animate-in fade-in duration-300">
                    <p className="text-[11.5px] text-slate-550 leading-relaxed bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/50">
                      ⚡ <strong>Hydrometallurgy Handover Calculators:</strong> Real-time process simulation models correlating flow sheets, surface hydraulics, and chemical reagent burn rates.
                    </p>

                    {/* Tool 1: Heap Saturation & Flux Density Optimizer */}
                    <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 font-sans uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp size={14} className="text-indigo-600" />
                            1. Heap Irrigation Flux Density Optimizer (L/h/m²)
                          </h4>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Industry Standard: 5.0 to 10.0 L/h/m² maintains optimal heap saturation.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const optimized: Record<string, number> = { ...padAreas };
                            pads.forEach((p) => {
                              if (p.status === "Active") {
                                const avgFlow = (p.min + p.max) / 2;
                                if (avgFlow > 0) {
                                  // Set area to land at exactly 7.5 L/h/m2
                                  optimized[p.id] = Math.round((avgFlow * 1000) / 7.5);
                                }
                              }
                            });
                            setPadAreas(optimized);
                            triggerToast("Wetting surface areas auto-balanced for 7.5 L/h/m² optimal flux!", "success");
                          }}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200 rounded text-[10px] font-mono leading-none tracking-tight transition-all active:scale-95 self-start sm:self-auto shrink-0 cursor-pointer"
                        >
                          Auto-Balance Areas
                        </button>
                      </div>

                      {/* Flux Table Grid */}
                      <div className="overflow-x-auto rounded-lg border border-slate-150">
                        <table className="w-full text-left font-mono text-[10.5px]">
                          <thead className="bg-slate-50 text-slate-500 font-sans font-bold">
                            <tr>
                              <th className="px-3 py-1.5 border-b">PAD ID</th>
                              <th className="px-3 py-1.5 border-b text-right">AVG FLOW (m³/h)</th>
                              <th className="px-3 py-1.5 border-b text-center w-40">ACTIVE ORE WETTING AREA (m²)</th>
                              <th className="px-3 py-1.5 border-b text-right">SPRAY FLUX RATE</th>
                              <th className="px-3 py-1.5 border-b text-center">WETTING DIAGNOSIS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {pads.map((pad) => {
                              const avgFlow = (pad.min + pad.max) / 2;
                              const area = padAreas[pad.id] || 15000;
                              const flux = pad.status === "Active" && area > 0 ? (avgFlow * 1000) / area : 0;
                              
                              // Wetting level logic
                              let badgeColor = "bg-slate-100 text-slate-500 border-slate-200";
                              let label = "Inactive";
                              if (pad.status === "Active") {
                                if (flux < 5.0) {
                                  badgeColor = "bg-amber-50 text-amber-700 border-amber-200 font-bold";
                                  label = "Under-irrigated (Poor Wash)";
                                } else if (flux <= 10.0) {
                                  badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold animate-pulse";
                                  label = "Optimal Flux Range";
                                } else {
                                  badgeColor = "bg-rose-50 text-rose-700 border-rose-250 font-black animate-bounce";
                                  label = "Over-saturated (Pooling Risk!)";
                                }
                              }

                              return (
                                <tr key={pad.id} className={`hover:bg-slate-50/50 transition-colors ${pad.status !== "Active" ? "bg-slate-100/30 text-slate-400" : ""}`}>
                                  <td className="px-3 py-2 font-bold font-sans flex items-center gap-1.5 pt-3">
                                    <span className={`w-2 h-2 rounded-full ${pad.status === "Active" ? "bg-indigo-600" : "bg-slate-300"}`} />
                                    {pad.id}
                                    <span className="text-[8px] uppercase tracking-wider text-slate-400 border px-1 rounded bg-slate-50">
                                      {pad.feedType || "RAF"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right font-bold text-slate-700 font-mono">
                                    {pad.status === "Active" ? avgFlow.toFixed(1) : "0.0"} m³/h
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        disabled={pad.status !== "Active"}
                                        onClick={() => {
                                          const prev = padAreas[pad.id] || 15000;
                                          setPadAreas({ ...padAreas, [pad.id]: Math.max(1000, prev - 500) });
                                        }}
                                        className="w-5 h-5 flex items-center justify-center border rounded bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs font-black"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        disabled={pad.status !== "Active"}
                                        min="500"
                                        max="100000"
                                        step="100"
                                        value={area}
                                        onChange={(e) => {
                                          const val = e.target.value === "" ? 15000 : parseInt(e.target.value);
                                          setPadAreas({ ...padAreas, [pad.id]: isNaN(val) ? 1000 : val });
                                        }}
                                        className="w-20 text-center font-mono text-xs font-bold border border-slate-250 rounded px-1.5 py-0.5 bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        disabled={pad.status !== "Active"}
                                        onClick={() => {
                                          const prev = padAreas[pad.id] || 15000;
                                          setPadAreas({ ...padAreas, [pad.id]: Math.min(100000, prev + 500) });
                                        }}
                                        className="w-5 h-5 flex items-center justify-center border rounded bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs font-black"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-right font-black">
                                    {pad.status === "Active" ? `${flux.toFixed(2)} L/h/m²` : "0.00 L/h/m²"}
                                  </td>
                                  <td className="px-3 py-1.5 text-center">
                                    <span className={`inline-block px-2.5 py-0.5 rounded border text-[9px] uppercase tracking-wider ${badgeColor}`}>
                                      {label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Tool 2: Acid Reserve Burn Rate & Inventory Projections */}
                    <div className="bg-slate-900 text-white p-4.5 rounded-xl border border-slate-800 shadow space-y-4">
                      <div>
                        <h4 className="text-xs font-bold font-sans uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                          <Beaker size={14} className="text-teal-400 fill-teal-400/20" />
                          2. Acid Reagent Burn Rate & Supply Exhaustion Projector
                        </h4>
                        <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                          Cross-correlates current pond flows with physical sulfuric acid levels inside active storage tanks.
                        </p>
                      </div>

                      {/* Slider and Stats Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1.5">
                        {/* Interactive Dosing Concentration controller */}
                        <div className="space-y-2 bg-slate-850 p-3 rounded-lg border border-slate-800">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-slate-300">Acid Dosing Target Target:</span>
                            <span className="text-teal-400 font-mono text-xs">{acidDosingConc.toFixed(1)} g/L (kg/m³)</span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="20.0"
                            step="0.1"
                            value={acidDosingConc}
                            onChange={(e) => setAcidDosingConc(parseFloat(e.target.value))}
                            className="w-full accent-teal-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                          />
                          <p className="text-[9px] text-slate-500 font-mono leading-tight">
                            Adjust according to heap copper/gold mineralogy clay count. Standard oxide target is 4-8 g/L.
                          </p>
                        </div>

                        {/* Calculations outputs panel */}
                        <div className="grid grid-cols-2 gap-3 text-center">
                          <div className="p-2.5 bg-slate-850 rounded-lg border border-slate-800 space-y-0.5">
                            <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-sans font-bold">Total Wetting Flow</span>
                            <span className="text-sm font-black text-white font-mono">
                              {pads.filter(p => p.status === "Active").reduce((sum, p) => sum + (p.min + p.max) / 2, 0).toFixed(1)} m³/h
                            </span>
                          </div>
                          <div className="p-2.5 bg-slate-850 rounded-lg border border-slate-800 space-y-0.5">
                            <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-sans font-bold">Daily Acid Used</span>
                            <span className="text-sm font-black text-rose-400 font-mono bg-rose-950/20 px-1.5 rounded">
                              {((pads.filter(p => p.status === "Active").reduce((sum, p) => sum + (p.min + p.max) / 2, 0) * acidDosingConc / 1000) * 24).toFixed(1)} tons
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Cumulative Tank Reserves Summary bar */}
                      <div className="space-y-2 pt-1 border-t border-slate-800">
                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 font-semibold">
                          <span>AGGREGATED ACTIVE BUFFER RESERVES</span>
                          <span className="text-white">
                            {((extraTelemetry.acidTank1Level / 100) * 5000 + (extraTelemetry.acidTank2Level / 100) * 5000 + (extraTelemetry.acidTank3Level / 100) * 1000).toFixed(0)} / 11,000 Tons Stored ({(
                              (((extraTelemetry.acidTank1Level / 100) * 5000 + (extraTelemetry.acidTank2Level / 100) * 5000 + (extraTelemetry.acidTank3Level / 100) * 1000) / 11000) * 100
                            ).toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden flex bg-slate-800">
                          <div
                            className="bg-red-500 h-full border-r border-slate-900"
                            style={{ width: `${Math.min((extraTelemetry.acidTank1Level / 100) * 5000 / 11000 * 100, 100)}%` }}
                            title={`Tank 1 Acid: ${((extraTelemetry.acidTank1Level / 100) * 5000).toFixed(0)} Tons`}
                          />
                          <div
                            className="bg-emerald-500 h-full border-r border-slate-900"
                            style={{ width: `${Math.min((extraTelemetry.acidTank2Level / 100) * 5000 / 11000 * 100, 100)}%` }}
                            title={`Tank 2 Acid: ${((extraTelemetry.acidTank2Level / 100) * 5000).toFixed(0)} Tons`}
                          />
                          <div
                            className="bg-sky-500 h-full"
                            style={{ width: `${Math.min((extraTelemetry.acidTank3Level / 100) * 1000 / 11000 * 100, 100)}%` }}
                            title={`Tank 3 Small Acid: ${((extraTelemetry.acidTank3Level / 100) * 1000).toFixed(0)} Tons`}
                          />
                        </div>
                      </div>

                      {/* Burn-time Projection results callouts */}
                      <div className="pt-1.5">
                        {(() => {
                          const activeFlow = pads.filter(p => p.status === "Active").reduce((sum, p) => sum + (p.min + p.max) / 2, 0);
                          const reserveTons = (extraTelemetry.acidTank1Level / 100) * 5000 + (extraTelemetry.acidTank2Level / 100) * 5000 + (extraTelemetry.acidTank3Level / 100) * 1000;
                          const rateTonsPerHour = (activeFlow * acidDosingConc) / 1000;
                          
                          if (activeFlow === 0) {
                            return (
                              <div className="p-3 rounded bg-blue-950/40 text-blue-300 font-mono text-[10px] border border-blue-900/60 flex items-center gap-2">
                                <span className="text-base">ℹ️</span>
                                <div>
                                  <p className="font-bold uppercase">Irrigation lines are currently inactive</p>
                                  <p className="opacity-80">Acid consumption rate is exactly raw zero. Aggregated warehouse reserves are stable.</p>
                                </div>
                              </div>
                            );
                          }

                          const hoursLeft = reserveTons / rateTonsPerHour;
                          const daysLeft = hoursLeft / 24;

                          if (hoursLeft < 48) {
                            return (
                              <div className="p-3.5 rounded-lg bg-red-950/40 text-rose-300 font-mono text-[10.5px] border border-rose-900/60 space-y-1">
                                <div className="flex items-center gap-2 font-black uppercase text-rose-400">
                                  <span className="text-sm">⚠️</span>
                                  <span>CRITICAL INVENTORY DEPLETION WARNING</span>
                                </div>
                                <p className="opacity-90">
                                  At active heap flows, plant sulfuric acid supply is projected to run fully dry in **{hoursLeft.toFixed(1)} hours** ({daysLeft.toFixed(1)} operating shifts).
                                </p>
                                <p className="text-[9.5px] text-rose-400 font-bold">
                                  Action: Contact chemical dispatch terminal instantly to schedule priority 98% Sulfuric delivery.
                                </p>
                              </div>
                            );
                          } else if (hoursLeft < 168) {
                            return (
                              <div className="p-3.5 rounded-lg bg-amber-950/40 text-amber-300 font-mono text-[10.5px] border border-amber-900/60 space-y-1">
                                <div className="flex items-center gap-2 font-bold uppercase text-amber-400">
                                  <span className="text-sm">🛢️</span>
                                  <span>HEAVY RESERVES BURN EXPIRY</span>
                                </div>
                                <p className="opacity-95 text-slate-200">
                                  Current acid stocks will sustain ongoing leaching operations for **{daysLeft.toFixed(1)} days** ({hoursLeft.toFixed(0)} operating hours).
                                </p>
                                <p className="text-[9.5px] text-amber-450 italic">
                                  Recommendation: Ensure standard bulk routing order conforms to shift dispatch timetables.
                                </p>
                              </div>
                            );
                          } else {
                            return (
                              <div className="p-3.5 rounded-lg bg-emerald-950/40 text-emerald-350 font-mono text-[10.5px] border border-emerald-900/60 space-y-1">
                                <div className="flex items-center gap-2 font-bold uppercase text-emerald-400">
                                  <span className="text-sm">🟢</span>
                                  <span>SUPPLY STATUS SECURE</span>
                                </div>
                                <p className="opacity-95">
                                  Operating acid buffers are highly robust, projected to sustain leaching for **{daysLeft.toFixed(1)} days**.
                                </p>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>

                    {/* Tool 3: SX-EW PLS Metal Recovery & Production Yield Estimator */}
                    <div className="bg-gradient-to-br from-indigo-50/20 to-indigo-150/10 p-4.5 rounded-xl border border-indigo-150 shadow-sm space-y-4">
                      <div>
                        <h4 className="text-xs font-bold font-sans uppercase tracking-wider text-indigo-900 flex items-center gap-1.55">
                          <Sparkles size={14} className="text-indigo-600 animate-pulse" />
                          3. SX-EW PLS Copper Extraction & Cathode Production Yield Estimator
                        </h4>
                        <p className="text-[9.5px] text-slate-500 font-mono mt-0.5">
                          Models real-time pregnant leach solution (PLS) flow sheets with Solvent Extraction (SX) load and Electrowinning (EW) plating rates.
                        </p>
                      </div>

                      {/* Interactive grade / efficiency parameters */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Grade input */}
                        <div className="bg-white p-3 rounded-lg border border-indigo-100 space-y-2">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                            <span>PLS Copper Feed Grade:</span>
                            <span className="text-indigo-600 font-mono">{plsCopperGrade.toFixed(2)} g/L (kg/m³)</span>
                          </div>
                          <input
                            type="range"
                            min="0.50"
                            max="8.00"
                            step="0.05"
                            value={plsCopperGrade}
                            onChange={(e) => setPlsCopperGrade(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-indigo-600"
                          />
                          <p className="text-[8.5px] text-slate-450 font-sans leading-tight">
                            Dissolved metal mass in solution entering SX channels. Normal oxide ores yield 1.5 to 4.5 g/L Cu.
                          </p>
                        </div>

                        {/* Extraction efficiency */}
                        <div className="bg-white p-3 rounded-lg border border-indigo-100 space-y-2">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                            <span>SX Extraction Efficiency:</span>
                            <span className="text-emerald-600 font-mono">{sxRecoveryRate.toFixed(1)} %</span>
                          </div>
                          <input
                            type="range"
                            min="75.0"
                            max="99.5"
                            step="0.1"
                            value={sxRecoveryRate}
                            onChange={(e) => setSxRecoveryRate(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-emerald-500"
                          />
                          <p className="text-[8.5px] text-slate-450 font-sans leading-tight">
                            Organic extractant load selectivity coefficient. Modern LIX organic reagents achieve over 92% recovery.
                          </p>
                        </div>
                      </div>

                      {/* Yield Math Outputs card */}
                      {(() => {
                        const flowRaw = extraTelemetry.plsFlowToSx || 0;
                        const dailyTons = (flowRaw * plsCopperGrade * 24 * (sxRecoveryRate / 100)) / 1000;
                        const lmeValue = dailyTons * 9450; // $9,450 USD LME high purity index
                        
                        return (
                          <div className="bg-slate-900 rounded-xl p-4 text-white border border-slate-800 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-800 text-center">
                                <span className="block text-[8.5px] uppercase text-slate-450 font-sans font-bold tracking-tight">Active SX Feed Rate</span>
                                <span className="text-sm font-black font-mono text-cyan-400">{flowRaw.toFixed(1)} m³/h</span>
                              </div>
                              <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-800 text-center">
                                <span className="block text-[8.5px] uppercase text-slate-450 font-sans font-bold tracking-tight">Daily Plated Copper</span>
                                <span className="text-sm font-black font-mono text-emerald-400">{flowRaw > 0 ? dailyTons.toFixed(2) : "0.00"} Metric Tons</span>
                              </div>
                              <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-800 text-center">
                                <span className="block text-[8.5px] uppercase text-slate-450 font-sans font-bold tracking-tight">Est. Daily Gross Value</span>
                                <span className="text-sm font-black font-mono text-amber-400">
                                  {flowRaw > 0 ? `$${lmeValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "$0"}
                                </span>
                              </div>
                            </div>

                            {/* visual representation of Electrowinning Cells */}
                            <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">⚡</span>
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-200 block uppercase text-[10px]">EW Electrowinning Cells Plating Status</span>
                                  <span className="text-[9px] text-slate-400 block font-mono">Based on current PLS flow, EW requires {Math.max(1, Math.round(flowRaw / 35))} active cell banks.</span>
                                </div>
                              </div>
                              <span className="font-sans font-extrabold text-[9px] px-2 py-0.5 bg-emerald-900/40 text-emerald-400 border border-emerald-800/60 rounded uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                                Plating Equivalent: {flowRaw > 0 ? `${(dailyTons * 41.6).toFixed(0)} Cathodes/day` : "0 Cathodes/day"}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
              </div>
              )}
            </div>

          </section>

          {/* RIGHT SECTION (Col 8-12): Diagnostics Alerts, and Operator submission */}
          <section className="lg:col-span-5 space-y-4">

            {/* Box 3. Real-Time Safety & Calibrations Warnings Dashboard */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 relative">
              <div className="flex items-center justify-between border-b pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={15} className="text-amber-500 animate-pulse" />
                  <h3 className="font-sans font-bold text-slate-800 text-sm tracking-wide uppercase">
                    3. Telemetry Integrity Compass
                  </h3>
                </div>
                <span className="font-mono text-[9px] font-bold text-slate-400">
                  {errors.length} ISSUE{errors.length !== 1 && "S"} ACTIVE
                </span>
              </div>

              {/* Multi severity filter tabs */}
              <div className="flex items-center gap-2 text-[10px] font-mono border-b pb-2.5">
                <span className="text-slate-400 select-none">Filter:</span>
                <button
                  type="button"
                  onClick={() => setFilterSeverity("all")}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    filterSeverity === "all" ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-600"
                  }`}
                >
                  All ({errors.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSeverity("error")}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    filterSeverity === "error" ? "bg-rose-100 text-rose-800" : "hover:bg-rose-50 text-rose-600"
                  }`}
                >
                  Fatal Errors ({errors.filter(e => e.type === "error").length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSeverity("warning")}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    filterSeverity === "warning" ? "bg-amber-100 text-amber-800" : "hover:bg-amber-50 text-amber-600"
                  }`}
                >
                  Process Alerts ({errors.filter(e => e.type === "warning" || e.type === "suggestion").length})
                </button>
              </div>

              {/* Infinite list of real-time alerts */}
              <div className="max-h-[190px] overflow-y-auto space-y-2 pr-1">
                {errors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-6 block">
                    <CheckCircle2 size={32} className="text-teal-600 bg-teal-50 rounded-full p-1 border-4 border-teal-100 mb-2 animate-bounce" />
                    <p className="text-xs text-slate-800 font-semibold font-sans">Full Telemetry Integrity Confirmed</p>
                    <p className="text-[10px] text-slate-400 font-mono">Form meets standard mining process design constraints.</p>
                  </div>
                ) : (
                  errors
                    .filter(e => {
                      if (filterSeverity === "error") return e.type === "error";
                      if (filterSeverity === "warning") return e.type === "warning" || e.type === "suggestion";
                      return true;
                    })
                    .map((err) => (
                      <div
                        key={err.id}
                        className={`p-3 rounded-xl border text-xs leading-normal relative flex flex-col justify-between gap-1.5 transition-all outline-none ${
                          err.type === "error"
                            ? "bg-rose-50/70 border-rose-200 text-rose-950"
                            : err.type === "warning"
                            ? "bg-amber-50/70 border-amber-200 text-amber-950"
                            : "bg-indigo-50/50 border-indigo-200 text-indigo-950"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-sm flex-none mt-0.5">
                            {err.type === "error" ? "❌" : err.type === "warning" ? "⚠️" : "💡"}
                          </span>
                          <span className="font-mono tracking-tight">{err.message}</span>
                        </div>

                        {/* Interactive Auto-fix click */}
                        <div className="flex justify-end border-t border-black/5 pt-1.5 mt-1">
                          <button
                            id={`fix-${err.id}`}
                            type="button"
                            onClick={() => handleApplyAutoFix(err)}
                            className={`px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer transition-transform active:scale-95 ${
                              err.type === "error"
                                ? "bg-rose-100 hover:bg-rose-200 text-rose-950 border border-rose-300/30"
                                : "bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300/30"
                            }`}
                          >
                            <Wrench size={10} />
                            Apply Auto-Correction
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Operator Form Actions Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Save size={16} className="text-indigo-600" />
                <h3 className="font-sans font-bold text-slate-800 text-sm tracking-wide uppercase">
                  Operator Logs & Offline Storage
                </h3>
              </div>

              {/* Controls and Note comments */}
              <div className="space-y-3 font-mono text-xs">
                
                {/* Operator inputs date and time (defaulting to exact date of template) */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold text-slate-500">Shift Timestamp</span>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const utcEpoch = now.getTime();
                        const catDate = new Date(utcEpoch + 2 * 3600 * 1000);
                        const y = catDate.getUTCFullYear();
                        const m = String(catDate.getUTCMonth() + 1).padStart(2, '0');
                        const d = String(catDate.getUTCDate()).padStart(2, '0');
                        const hh = String(catDate.getUTCHours()).padStart(2, '0');
                        const mm = String(catDate.getUTCMinutes()).padStart(2, '0');
                        setDate(`${y}-${m}-${d}`);
                        setTime(`${hh}:${mm}`);
                        triggerToast("Synchronized report timestamp with active Central Africa Time (CAT).", "success");
                      }}
                      className="flex items-center gap-1 text-[9px] text-indigo-600 hover:text-indigo-800 font-extrabold uppercase bg-indigo-50 hover:bg-indigo-100 transition px-2 py-0.5 rounded border border-indigo-150 cursor-pointer"
                      title="Synchronize form fields with current Central Africa Time"
                    >
                      <Clock size={10} className="text-indigo-500 animate-spin" style={{ animationDuration: '6s' }} />
                      <span>Sync with Live CAT</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="log-date" className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Log Date:</label>
                      <input
                        id="log-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-lg p-2 font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor="log-time" className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Log Time:</label>
                      <input
                        id="log-time"
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-lg p-2 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Operator Credentials Fields */}
                <div className="space-y-2 border-t border-b border-slate-100 py-3 my-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    <User size={11} className="text-indigo-500" />
                    <span>Duty Operator Credentials</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="log-operator-name" className="block text-[10px] text-slate-400 font-semibold mb-1">Full Name:</label>
                      <input
                        id="log-operator-name"
                        type="text"
                        placeholder="e.g. Miguel Kaungu"
                        value={operatorName}
                        onChange={(e) => setOperatorName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-lg p-2 font-sans text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="log-operator-emp" className="block text-[10px] text-slate-400 font-semibold mb-1">Employment No:</label>
                      <input
                        id="log-operator-emp"
                        type="text"
                        placeholder="e.g. EMP-8274"
                        value={employmentNumber}
                        onChange={(e) => setEmploymentNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-lg p-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="log-operator-email" className="block text-[10px] text-slate-400 font-semibold mb-1">Duty Email:</label>
                    <input
                      id="log-operator-email"
                      type="email"
                      placeholder="operator@mine.com"
                      value={operatorEmail}
                      onChange={(e) => setOperatorEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-lg p-2 font-sans text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Operator comments */}
                <div className="space-y-1">
                  <label htmlFor="log-comment" className="block text-[10px] text-slate-400 uppercase font-semibold">Shift Notes / Observations:</label>
                  <textarea
                    id="log-comment"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Describe irrigation valve tuning, line replacement, or meter calibration diagnostics..."
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400 font-sans text-xs"
                  />
                </div>

                {/* Main save button */}
                <button
                  id="btn-save"
                  type="button"
                  onClick={handleSaveShift}
                  className="w-full py-2.5 bg-teal-600 border border-teal-600 hover:bg-teal-700 text-white font-bold text-xs tracking-wider rounded-xl uppercase flex items-center justify-center gap-2 shadow hover:shadow-md transition-transform active:scale-95"
                >
                  <Save size={14} />
                  Record Shift Snapshot
                </button>

                {/* Email Shift Summary button */}
                <button
                  id="btn-email-summary-sidebar"
                  type="button"
                  onClick={handleEmailShiftSummary}
                  className="w-full py-2.5 bg-indigo-600 border border-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs tracking-wider rounded-xl uppercase flex items-center justify-center gap-2 shadow hover:shadow-md transition-transform active:scale-95"
                  title="Compose professional shift handover reports and email direct to managers"
                >
                  <Mail size={14} />
                  Email Shift Summary
                </button>

              </div>
            </div>

          </section>

        </div>

        {/* Dynamic Telemetry profile graphs (layout grids side-by-side or stacked bento) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 no-print">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div 
              className="flex items-center justify-between border-b pb-2.5 cursor-pointer select-none"
              onClick={() => setIsTelemetryCompassOpen(!isTelemetryCompassOpen)}
            >
              <h3 className="font-sans font-bold text-slate-800 text-xs tracking-wide uppercase">
                ⚡ Heap Saturation Telemetry Chart
              </h3>
              <button
                type="button"
                className="text-[10px] font-mono text-slate-550 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-2 py-0.5 tracking-wider"
              >
                {isTelemetryCompassOpen ? "COLLAPSE -" : "EXPAND +"}
              </button>
            </div>
            {isTelemetryCompassOpen && (
              <TelemetryChart pads={pads} history={history} currentShiftId={currentShiftId} />
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div 
              className="flex items-center justify-between border-b pb-2.5 cursor-pointer select-none"
              onClick={() => setIsTotalizerTrendOpen(!isTotalizerTrendOpen)}
            >
              <h3 className="font-sans font-bold text-slate-800 text-xs tracking-wide uppercase">
                📈 Totalizer Accumulation Trend
              </h3>
              <button
                type="button"
                className="text-[10px] font-mono text-slate-550 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-2 py-0.5 tracking-wider"
              >
                {isTotalizerTrendOpen ? "COLLAPSE -" : "EXPAND +"}
              </button>
            </div>
            {isTotalizerTrendOpen && (
              <TotalizerTrendChart pads={pads} />
            )}
          </div>
        </div>

        {/* Historical acidity/pH trend visualizer */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 no-print">
          <div 
            className="flex items-center justify-between border-b pb-2.5 cursor-pointer select-none"
            onClick={() => setIsPhTrendOpen(!isPhTrendOpen)}
          >
            <h3 className="font-sans font-bold text-slate-800 text-xs tracking-wide uppercase">
              🧪 Acidity/pH Deviation Trend Chart
            </h3>
            <button
              type="button"
              className="text-[10px] font-mono text-slate-550 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-2 py-0.5 tracking-wider"
            >
              {isPhTrendOpen ? "COLLAPSE -" : "EXPAND +"}
            </button>
          </div>
          {isPhTrendOpen && (
            <PHTrendChart />
          )}
        </div>

        {/* Co-Pilot Block: AI insights & History Log database */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* Smart AI handovers column */}
          <InsightsPanel 
            shiftData={{ id: "active", date, time, operatorEmail, operatorName, employmentNumber, pads, ponds, notes, extraTelemetry }} 
            activeWarnings={errors}
            history={history}
            extraTelemetry={extraTelemetry}
            plsCopperGrade={plsCopperGrade}
            sxRecoveryRate={sxRecoveryRate}
            onOpenGmail={(tab) => {
              setGmailInitialTab(tab || "handover");
              setIsGmailModalOpen(true);
            }}
          />

          {/* Offline Reports historical logger table column */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div 
              className="flex items-center justify-between border-b pb-3.5 cursor-pointer select-none"
              onClick={() => setIsHistoricalSubmissionsOpen(!isHistoricalSubmissionsOpen)}
            >
              <div className="flex items-center gap-2">
                <History size={16} className="text-slate-700" />
                <div>
                  <h3 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wide">
                    Historical Submissions Index
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Synchronized via Firebase Firestore &amp; Local Persistence
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFormsModalOpen(true);
                  }}
                  className="text-[10.5px] font-sans font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg px-2.5 py-1 tracking-wide flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                  title="Open Google Forms submissions and import field telemetry"
                >
                  <FileCheck size={12} className="text-purple-600" />
                  <span>Google Forms</span>
                </button>
                <button
                  type="button"
                  className="text-[10px] font-mono text-slate-550 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-2 py-0.5 tracking-wider"
                >
                  {isHistoricalSubmissionsOpen ? "COLLAPSE -" : "EXPAND +"}
                </button>
              </div>
            </div>

            {isHistoricalSubmissionsOpen && (
              <>
                {/* Shift records log */}
                <div className="max-h-[380px] overflow-y-auto space-y-3.5 pr-1">
              {history.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center border border-slate-150 border-dashed rounded-xl p-8 bg-slate-50/50">
                  <Database size={28} className="text-slate-300 mb-2.5" />
                  <p className="text-xs text-slate-750 font-sans font-semibold mb-0.5">No shift telemetry snapshots found</p>
                  <p className="text-[10.5px] text-slate-400 font-mono">Click 'Record Shift Snapshot' above to store process records in Firestore.</p>
                </div>
              ) : (
                history.map((record) => {
                  const totPads = record.pads.filter(p => p.status === "Active").length;
                  return (
                    <div
                      key={record.id}
                      onClick={() => handleReloadHistory(record)}
                      className="border border-slate-200 p-3.5 rounded-xl hover:bg-slate-50 cursor-pointer group shadow-sm flex items-center justify-between gap-4 transition-all"
                      title="Load snapshot into the workspace"
                    >
                      <div className="space-y-1.5 font-mono text-xs">
                        {/* Title date-time */}
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={12} className="text-teal-600 flex-none" />
                          <span className="font-bold text-slate-900 text-xs">
                            {record.date} {record.time}
                          </span>
                          {record.userId ? (
                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-bold font-mono uppercase flex items-center gap-1">
                              <Flame size={9} className="text-amber-500" />
                              Firestore
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-semibold font-mono">
                              Cached
                            </span>
                          )}
                        </div>

                        {/* Operational details */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-slate-500 font-medium">
                          <p>Active Pads: <span className="text-teal-700 font-bold">{totPads}</span></p>
                          <p>Ponds flow: <span className="text-slate-800 font-bold">{(record.ponds.raf.flow + record.ponds.ils.flow).toFixed(1)} m³/h</span></p>
                        </div>

                        <p className="text-[10px] text-slate-400 italic truncate max-w-xs pl-4">
                          Note: "{record.notes}"
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteHistory(record.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100 flex-none"
                        title="Delete log"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            </>
            )}
          </div>

        </div>

        {/* Dynamic DCS Operational Simulator & Real-time Scenario testing Sandbox */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100/75 rounded-2xl border border-slate-200 p-4.5 shadow-sm space-y-3 no-print transition-all duration-300">
          <div 
            className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-2.5 cursor-pointer select-none"
            onClick={() => setIsDcsSimulatorOpen(!isDcsSimulatorOpen)}
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800/10 text-[11px]">🧪</span>
                <h4 className="font-sans font-bold text-slate-800 text-xs tracking-wider uppercase flex items-center gap-1.5">
                  Dynamic DCS Operational Simulator & Scenario Testing Sandbox
                </h4>
              </div>
              <p className="text-[10.5px] text-slate-550 leading-relaxed font-sans pl-7">
                Trigger real-time process deviations, extreme weather surges, or mechanical faults. Simulates field inputs to test live alerts and verify the <strong>Gemini AI operator report generator</strong> response.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start md:self-auto" onClick={(e) => e.stopPropagation()}>
              <div className="text-[9px] font-mono font-bold text-slate-400 bg-white border rounded px-2 py-1 uppercase tracking-wide">
                Selected Flow Sheet: {currentShiftId.replace("SHIFT-", "")}
              </div>
              <button
                type="button"
                className="text-[10px] font-mono text-slate-550 bg-white hover:bg-slate-50 border border-slate-200 rounded px-2 py-0.5 tracking-wider"
                onClick={() => setIsDcsSimulatorOpen(!isDcsSimulatorOpen)}
              >
                {isDcsSimulatorOpen ? "COLLAPSE -" : "EXPAND +"}
              </button>
            </div>
          </div>

          {isDcsSimulatorOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1.5">
            {/* Scenario 1: Steady State */}
            <button
              type="button"
              onClick={handleLoadBaselinePreset}
              className={`text-left p-3 rounded-xl border transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between h-22 cursor-pointer ${
                currentShiftId === "SHIFT-ACTIVE-SESSION"
                  ? "bg-white border-indigo-600 shadow-sm ring-1 ring-indigo-600/20"
                  : "bg-white/80 border-slate-200 hover:border-slate-350 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold font-sans text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  1. Steady Normal
                </span>
                <span className="text-[8px] px-1 font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase rounded">Optimal</span>
              </div>
              <p className="text-[9.5px] text-slate-450 leading-tight font-sans mt-1">
                Standard baseline calibration. Balanced acid concentration, stable pond buffers and normal pad flows.
              </p>
            </button>

            {/* Scenario 2: Heavy Storm Runoff */}
            <button
              type="button"
              onClick={handleLoadStormSurgeScenario}
              className={`text-left p-3 rounded-xl border transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between h-22 cursor-pointer ${
                currentShiftId === "SHIFT-SCENARIO-STORM"
                  ? "bg-white border-blue-600 shadow-sm ring-1 ring-blue-600/20"
                  : "bg-white/80 border-slate-200 hover:border-slate-350 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold font-sans text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                  <Gauge size={12} className="text-blue-500 animate-pulse" />
                  2. Storm Water Surge
                </span>
                <span className="text-[8px] px-1 font-mono font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase rounded">Extreme weather</span>
              </div>
              <p className="text-[9.5px] text-slate-450 leading-tight font-sans mt-1">
                45mm rain surge. Pad wash elevated, acid ponds rise to critical &gt;90% capacity, storm-water levels active.
              </p>
            </button>

            {/* Scenario 3: Acid Outage */}
            <button
              type="button"
              onClick={handleLoadAcidCrisisScenario}
              className={`text-left p-3 rounded-xl border transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between h-22 cursor-pointer ${
                currentShiftId === "SHIFT-SCENARIO-ACID"
                  ? "bg-white border-rose-600 shadow-sm ring-1 ring-rose-600/20"
                  : "bg-white/80 border-slate-200 hover:border-slate-350 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold font-sans text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                  <Beaker size={12} className="text-rose-500" />
                  3. Acid Buffer Alert
                </span>
                <span className="text-[8px] px-1 font-mono font-bold bg-rose-50 text-rose-700 border border-rose-100 uppercase rounded">Supply Outage</span>
              </div>
              <p className="text-[9.5px] text-slate-450 leading-tight font-sans mt-1">
                Tanks depleted (&lt;10%). Triggers critical reagent warnings. Projected burn-out inside next 24 hours.
              </p>
            </button>

            {/* Scenario 4: Dripper Blockage */}
            <button
              type="button"
              onClick={handleLoadBlockageScenario}
              className={`text-left p-3 rounded-xl border transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between h-22 cursor-pointer ${
                currentShiftId === "SHIFT-SCENARIO-BLOCKAGE"
                  ? "bg-white border-amber-600 shadow-sm ring-1 ring-amber-600/20"
                  : "bg-white/80 border-slate-200 hover:border-slate-350 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold font-sans text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                  <ShieldAlert size={12} className="text-amber-500 animate-bounce" />
                  4. Line Blockage Fault
                </span>
                <span className="text-[8px] px-1 font-mono font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase rounded">Mechanical</span>
              </div>
              <p className="text-[9.5px] text-slate-450 leading-tight font-sans mt-1">
                Pads LP4/LP5 flow shows 0 despite Active mode. Pump speed at 84% but flow yields 0 (valve/cavitation failure).
              </p>
            </button>
          </div>
          )}
        </div>
          </>
        )}

      </main>

      {/* Modern Industrial Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-500 font-mono text-[10.5px] py-6 select-none mt-12 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-1.5 py-4">
          <p className="text-slate-350 font-bold tracking-wider">MIMBULA MINERALS LIMITED — PROCESSING DEPARTMENT</p>
          <p className="text-[10px]">Real-time heap leach pad flows, acid ponds distribution telemetry & smart handover system.</p>
          <p className="text-slate-500 font-semibold">Developed by Miguel Kaungu</p>
        </div>
      </footer>

      {/* Operator Credentials Edit Modal dialog */}
      {isOperatorModalOpen && (
        <div id="operator-edit-modal" className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden font-sans">
            {/* Modal Header */}
            <div className="bg-slate-850 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-950 text-indigo-400 rounded-lg border border-indigo-900/50">
                  <User size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">Duty Operator Profile</h3>
                  <p className="text-[10px] text-teal-400 font-medium">Mimbula Minerals Limited (Processing Dept)</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsOperatorModalOpen(false)}
                className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition-colors cursor-pointer text-lg font-bold"
                title="Save and close modal"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              setIsOperatorModalOpen(false); 
              if (googleUser) {
                syncUserProfile(googleUser.uid, operatorEmail || googleUser.email || "", operatorName, employmentNumber).catch(() => {});
              }
              triggerToast("Duty Operator details updated and synchronized with Firebase!", "success"); 
            }} className="p-5 space-y-4">
              <div>
                <label htmlFor="modal-operator-name" className="block text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1.5">Full Name</label>
                <div className="relative">
                  <input
                    id="modal-operator-name"
                    type="text"
                    required
                    placeholder="e.g. Miguel Kaungu"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-750 focus:border-teal-500 focus:bg-slate-800 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modal-operator-emp" className="block text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1.5">Employment No.</label>
                  <input
                    id="modal-operator-emp"
                    type="text"
                    required
                    placeholder="e.g. EMP-8274"
                    value={employmentNumber}
                    onChange={(e) => setEmploymentNumber(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-750 focus:border-teal-500 focus:bg-slate-800 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="modal-operator-email" className="block text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1.5">Duty Email</label>
                  <input
                    id="modal-operator-email"
                    type="email"
                    required
                    placeholder="e.g. operator@mine.com"
                    value={operatorEmail}
                    onChange={(e) => setOperatorEmail(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-750 focus:border-teal-500 focus:bg-slate-800 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all font-sans"
                  />
                </div>
              </div>

              {/* Informational Warning */}
              <div className="bg-slate-850/60 border border-slate-800 rounded-xl p-3 flex gap-2.5 items-start">
                <div className="p-1 bg-amber-950/40 text-amber-500 border border-amber-900/35 rounded-lg font-mono text-[9px] font-bold mt-0.5 shrink-0">i</div>
                <div className="text-[10px] text-slate-400 leading-normal">
                  These operational specifications sign off any live CSV telemetry imports, PDF export files, and automates your handover briefing context.
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOperatorModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-350 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <span>Apply Signature</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Drive Save & Synchronization Modal */}
      <GoogleDriveSaveModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        pads={pads}
        ponds={ponds}
        history={history}
        extraTelemetry={extraTelemetry}
        onTriggerToast={triggerToast}
      />

      {/* Gmail Shift Communications & Handover Dispatch Modal */}
      <GmailModal
        isOpen={isGmailModalOpen}
        onClose={() => setIsGmailModalOpen(false)}
        shiftData={{
          id: currentShiftId,
          date,
          time,
          operatorEmail,
          operatorName,
          employmentNumber,
          pads,
          ponds,
          extraTelemetry,
          notes
        }}
        activeWarnings={errors}
        extraTelemetry={extraTelemetry}
        plsCopperGrade={plsCopperGrade}
        sxRecoveryRate={sxRecoveryRate}
        onTriggerToast={triggerToast}
        initialTab={gmailInitialTab}
      />

      {/* Google Forms Shift Inspection & Responses Modal */}
      <GoogleFormsModal
        isOpen={isFormsModalOpen}
        onClose={() => setIsFormsModalOpen(false)}
        onTriggerToast={triggerToast}
        onImportShiftFromForm={handleImportShiftFromForm}
      />

    </div>
  );
}
