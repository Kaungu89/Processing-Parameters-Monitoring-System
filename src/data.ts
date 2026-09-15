import { LeachPadNode, PondTelemetry, ValidationError, ShiftTelemetryData, ExtraProcessTelemetry } from "./types";

// Static data from User's attached image
export const IMAGE_PRESET_PADS: LeachPadNode[] = [
  { id: "LP1", min: 44.70, max: 44.70, status: "Active", feedType: "RAF", dischargePlsPercent: 100, dischargeIlsPercent: 0 },
  { id: "LP2", min: 0.00, max: 0.00, status: "Off", feedType: "RAF", dischargePlsPercent: 100, dischargeIlsPercent: 0 },
  { id: "LP3", min: 0.00, max: 0.00, status: "Off", feedType: "ILS", dischargePlsPercent: 0, dischargeIlsPercent: 100 },
  { id: "LP4", min: 122.00, max: 122.00, status: "Active", feedType: "RAF", dischargePlsPercent: 100, dischargeIlsPercent: 0 },
  { id: "LP5", min: 155.00, max: 155.00, status: "Active", feedType: "RAF", dischargePlsPercent: 80, dischargeIlsPercent: 20 },
  { id: "LP6", min: 182.00, max: 182.00, status: "Active", feedType: "ILS", dischargePlsPercent: 50, dischargeIlsPercent: 50 },
  { id: "LP7", min: 164.00, max: 164.00, status: "Active", feedType: "RAF", dischargePlsPercent: 100, dischargeIlsPercent: 0 },
  { id: "LP8", min: 94.00, max: 94.00, status: "Active", feedType: "RAF", dischargePlsPercent: 70, dischargeIlsPercent: 30 },
  { id: "LP9", min: 161.00, max: 161.00, status: "Active", feedType: "ILS", dischargePlsPercent: 100, dischargeIlsPercent: 0 },
  { id: "LP10", min: 0.00, max: 0.00, status: "Off", feedType: "RAF", dischargePlsPercent: 60, dischargeIlsPercent: 40 },
  { id: "LP11", min: 147.00, max: 147.00, status: "Active", feedType: "RAF", dischargePlsPercent: 100, dischargeIlsPercent: 0 },
  { id: "LP12", min: 133.00, max: 133.00, status: "Active", feedType: "ILS", dischargePlsPercent: 0, dischargeIlsPercent: 100 },
];

export const IMAGE_PRESET_PONDS = {
  raf: { id: "raf", name: "RAF Pond Acid", totalizer: 4476.14, flow: 780.00 },
  ils: { id: "ils", name: "ILS Pond Acid", totalizer: 8611.71, flow: 680.00 },
  crasher: { id: "crasher", name: "Acid to Crasher", totalizer: 40856.09, flow: 147.00 },
  mainLine: { id: "mainLine", name: "Main Line", totalizer: 7436.41, flow: 1066.00 },
};

export const DEFAULT_EXTRA_TELEMETRY: ExtraProcessTelemetry = {
  // Ponds & Pump speeds
  plsFlowToSx: 602.00,
  plsPondLevel: 65.50,
  plsPumpSpeed: 68.4,
  ilsPondLevel: 79.50,
  ilsPumpSpeed: 74.5,
  rafPondLevel: 85.40,
  rafPumpSpeed: 82.1,

  // Acid Reserves
  acidTank1Level: 10.90, // Critical - Will show verification alert
  acidTank2Level: 81.40,
  acidTank3Level: 48.80, // Acid Tank Small
  gyroCrusherAcidTankLevel: 64.20,
  jawCrusherAcidTankLevel: 47.00,

  // Organic loops
  organicTankLevel: 16.20,
  organicTankLevelSx2: 17.60,
  organicPumpSpeed: 49.70,
  organicFlow: 687.00,

  // Electrowinning advance & Buffers
  advanceFlowToEw: 147.00,
  advancePumpSpeed: 52.3,
  advanceTankLevel: 44.50,
  advanceTankLevelSx2: 73.70,

  // Intermediate Storage
  hgRaffinateTankLevelSx2: 9.90,
  spentTankLevel: 55.70,
  backwashTankLevel: 4.71,
  intermediateLevel: 79.30,
  newSpentTankLevel: 28.00,
  diluentTankLevel: 0.00,
  dieselTankBurner: 46.50,

  // Secondary Flows
  ilsFlowToSx2: 160.00,
  plsFlowToSx2: 160.00,
  totalRaffinateFlow: 780.00,
  totalIlsFlow: 680.00,
  spentFlowToSx: 147.00,
  newCirculationFlow: 1066.00,

  // Additional Ponds
  stormWaterPondLevel: 51.20,
  rawWaterPondLevel: 37.90,

  // EW Rectifier Current
  ewCurrent: 24.00,
};

// Target operation ranges (standard design constraints)
export const OPERATIONAL_LIMITS = {
  padMinFlow: 0,
  padMaxFlow: 250, // maximum safety flow rate in m³/h
  pondMinTotalizer: 0,
  pondMaxTotalizer: 100000,
  pondMaxFlowRate: 150, // limit for acid transport rate in m³/h
};

export const getInitialLeachPads = (): LeachPadNode[] => {
  return JSON.parse(JSON.stringify(IMAGE_PRESET_PADS));
};

export const getInitialPonds = () => {
  return JSON.parse(JSON.stringify(IMAGE_PRESET_PONDS));
};

// Comprehensive Real-time telemetry validation
export const validateTelemetry = (
  pads: LeachPadNode[],
  ponds: {
    raf: PondTelemetry;
    ils: PondTelemetry;
    crasher: PondTelemetry;
    mainLine: PondTelemetry;
  },
  extraTelemetry?: ExtraProcessTelemetry
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Validate individual Leach Pads
  pads.forEach((pad) => {
    // 1. Min > Max flow rate
    if (pad.min > pad.max) {
      errors.push({
        id: `${pad.id}_min_greater_max`,
        field: `${pad.id}_min`,
        message: `${pad.id}: Min flow rate (current: ${pad.min}) cannot be strictly greater than Max flow rate (current: ${pad.max}).`,
        type: "error",
      });
    }

    // 2. Negative inputs
    if (pad.min < 0) {
      errors.push({
        id: `${pad.id}_neg_min`,
        field: `${pad.id}_min`,
        message: `${pad.id}: Min flow cannot be negative.`,
        type: "error",
      });
    }
    if (pad.max < 0) {
      errors.push({
        id: `${pad.id}_neg_max`,
        field: `${pad.id}_max`,
        message: `${pad.id}: Max flow cannot be negative.`,
        type: "error",
      });
    }

    // 2b. Totalizer validation
    if (pad.totalizer !== undefined && pad.totalizer < 0) {
      errors.push({
        id: `${pad.id}_neg_totalizer`,
        field: `${pad.id}_totalizer`,
        message: `${pad.id}: Totalizer reading cannot be negative.`,
        type: "error",
      });
    }

    // 3. Flow exceeds safety limit
    if (pad.max > OPERATIONAL_LIMITS.padMaxFlow) {
      errors.push({
        id: `${pad.id}_high_flow`,
        field: `${pad.id}_max`,
        message: `${pad.id}: Flow rate of ${pad.max} m³/h is extremely high (Safety limit is ${OPERATIONAL_LIMITS.padMaxFlow} m³/h).`,
        type: "warning",
      });
    }

    // 4. Status consistency checks
    if (pad.status === "Active" && pad.min === 0 && pad.max === 0) {
      errors.push({
        id: `${pad.id}_active_zero`,
        field: `${pad.id}_status`,
        message: `${pad.id}: Marked as Active, but flow indicates raw 0.00 m³/h. Consider setting state to 'Off' or checking physical line blockage.`,
        type: "warning",
      });
    }

    if ((pad.status === "Off" || pad.status === "Offline") && (pad.min > 0 || pad.max > 0)) {
      errors.push({
        id: `${pad.id}_inactive_non_zero`,
        field: `${pad.id}_status`,
        message: `${pad.id}: Marked as ${pad.status}, but recorded values show active irrigation flows (${pad.min} - ${pad.max} m³/h). Please set to Active or double-check values.`,
        type: "error",
      });
    }
  });

  // Validate Pond systems and totalizers
  const pondKeys: ("raf" | "ils" | "crasher" | "mainLine")[] = ["raf", "ils", "crasher", "mainLine"];
  
  pondKeys.forEach((key) => {
    const pond = ponds[key];
    if (pond.totalizer < 0) {
      errors.push({
        id: `${key}_neg_totalizer`,
        field: `${key}_totalizer`,
        message: `${pond.name}: Totalizer reading cannot be negative.`,
        type: "error",
      });
    }
    if (pond.flow < 0) {
      errors.push({
        id: `${key}_neg_flow`,
        field: `${key}_flow`,
        message: `${pond.name}: Outgoing flow cannot be negative.`,
        type: "error",
      });
    }
    if (pond.flow > OPERATIONAL_LIMITS.pondMaxFlowRate) {
      errors.push({
        id: `${key}_high_flow`,
        field: `${key}_flow`,
        message: `${pond.name}: Outgoing flow rate (${pond.flow} m³/h) exceeds normal plant distribution threshold (${OPERATIONAL_LIMITS.pondMaxFlowRate} m³/h).`,
        type: "warning",
      });
    }
  });

  // Cross-system telemetry correlations
  const sumActivePadFlowAvg = pads
    .filter(p => p.status === "Active")
    .reduce((sum, p) => sum + (p.min + p.max) / 2, 0);

  // RAF vs ILS Acid proportion
  if (ponds.raf.flow > 0 && ponds.ils.flow > 0) {
    const ratio = ponds.raf.flow / ponds.ils.flow;
    if (ratio > 2.5 || ratio < 0.4) {
      errors.push({
        id: `pond_imbalance`,
        field: `raf_flow`,
        message: `Chemical Balance Warning: RAF vs ILS Acid proportion ratio is severely imbalanced (${ratio.toFixed(2)}). Normal target ratio is 0.5 to 2.0 to maintain heap saturation uniformity.`,
        type: "suggestion",
      });
    }
  }

  // Validate 16 Extra Metallurgy / Process signals
  if (extraTelemetry) {
    const {
      plsFlowToSx, plsPondLevel, plsPumpSpeed,
      ilsPondLevel, ilsPumpSpeed,
      rafPondLevel, rafPumpSpeed,
      acidTank1Level, acidTank2Level, acidTank3Level,
      advanceFlowToEw, advancePumpSpeed, advanceTankLevel,
      organicTankLevel, organicPumpSpeed, organicFlow
    } = extraTelemetry;

    // 1. PLS Flow to SX
    if (plsFlowToSx < 0) {
      errors.push({ id: `plsFlowToSx_neg`, field: `plsFlowToSx`, message: `PLS Flow to SX cannot be negative.`, type: "error" });
    } else if (plsFlowToSx > 750) {
      errors.push({ id: `plsFlowToSx_high`, field: `plsFlowToSx`, message: `PLS Flow to SX is extremely high (${plsFlowToSx.toFixed(1)} m³/h). Normal limit is 750 m³/h.`, type: "warning" });
    }

    // 2. PLS Pond Level
    if (plsPondLevel < 0) {
      errors.push({ id: `plsPondLevel_neg`, field: `plsPondLevel`, message: `PLS Pond Level cannot be negative.`, type: "error" });
    } else if (plsPondLevel > 100) {
      errors.push({ id: `plsPondLevel_high`, field: `plsPondLevel`, message: `PLS Pond Level exceeds 100%. Critical spill alarm triggered!`, type: "error" });
    } else if (plsPondLevel < 15) {
      errors.push({ id: `plsPondLevel_low`, field: `plsPondLevel`, message: `PLS Pond Level is low (${plsPondLevel.toFixed(2)}%). Suction loss risk.`, type: "warning" });
    }

    // 3. PLS Pump Speed
    if (plsPumpSpeed < 0 || plsPumpSpeed > 100) {
      errors.push({ id: `plsPumpSpeed_range`, field: `plsPumpSpeed`, message: `PLS Pump Speed must be between 0% and 100%.`, type: "error" });
    } else if (plsPumpSpeed > 10 && plsFlowToSx === 0) {
      errors.push({ id: `plsPump_cavitation`, field: `plsPumpSpeed`, message: `PLS Pump is active (${plsPumpSpeed.toFixed(1)}%) but flow reading is exactly zero. Cavitation risk.`, type: "error" });
    }

    // 4. ILS Pond Level & 5. ILS Pump Speed
    if (ilsPondLevel < 0) {
      errors.push({ id: `ilsPondLevel_neg`, field: `ilsPondLevel`, message: `ILS Pond Level cannot be negative.`, type: "error" });
    } else if (ilsPondLevel > 100) {
      errors.push({ id: `ilsPondLevel_high`, field: `ilsPondLevel`, message: `ILS Pond Level exceeds 100%. Critical spill alarm triggered!`, type: "error" });
    } else if (ilsPondLevel < 15) {
      errors.push({ id: `ilsPondLevel_low`, field: `ilsPondLevel`, message: `ILS Pond Level is extremely low (${ilsPondLevel.toFixed(2)}%). Pump starvation risk.`, type: "warning" });
    }
    if (ilsPumpSpeed < 0 || ilsPumpSpeed > 100) {
      errors.push({ id: `ilsPumpSpeed_range`, field: `ilsPumpSpeed`, message: `ILS Pump Speed must be between 0% and 100%.`, type: "error" });
    }

    // 6. RAF Pond Level & 7. RAF Pump Speed
    if (rafPondLevel < 0) {
      errors.push({ id: `rafPondLevel_neg`, field: `rafPondLevel`, message: `RAF Pond Level cannot be negative.`, type: "error" });
    } else if (rafPondLevel > 100) {
      errors.push({ id: `rafPondLevel_high`, field: `rafPondLevel`, message: `RAF Pond Level exceeds 100%. Critical spill alarm triggered!`, type: "error" });
    } else if (rafPondLevel < 15) {
      errors.push({ id: `rafPondLevel_low`, field: `rafPondLevel`, message: `RAF Pond Level is low (${rafPondLevel.toFixed(2)}%). Cavitation risk.`, type: "warning" });
    }
    if (rafPumpSpeed < 0 || rafPumpSpeed > 100) {
      errors.push({ id: `rafPumpSpeed_range`, field: `rafPumpSpeed`, message: `RAF Pump Speed must be between 0% and 100%.`, type: "error" });
    }

    // 8. Acid Tank 1 Level
    if (acidTank1Level < 0 || acidTank1Level > 100) {
      errors.push({ id: `acidTank1Level_range`, field: `acidTank1Level`, message: `Acid Tank 1 Level must be between 0% and 100%.`, type: "error" });
    } else if (acidTank1Level < 15) {
      errors.push({ id: `acidTank1Level_low`, field: `acidTank1Level`, message: `Acid Supply Critical: Tank 1 Level is extremely low (${acidTank1Level.toFixed(1)}%). Reorder urgent bulk sulfuric acid!`, type: "error" });
    }

    // 9. Acid Tank 2 level
    if (acidTank2Level < 0 || acidTank2Level > 100) {
      errors.push({ id: `acidTank2Level_range`, field: `acidTank2Level`, message: `Acid Tank 2 Level must be between 0% and 100%.`, type: "error" });
    } else if (acidTank2Level < 15) {
      errors.push({ id: `acidTank2Level_low`, field: `acidTank2Level`, message: `Acid Supply Warning: Tank 2 Level is low (${acidTank2Level.toFixed(1)}%). Correlate bulk reservoir drawdowns.`, type: "warning" });
    }

    // 10. Acid Tank 3 (small) level
    if (acidTank3Level < 0 || acidTank3Level > 100) {
      errors.push({ id: `acidTank3Level_range`, field: `acidTank3Level`, message: `Acid Tank 3 Level must be between 0% and 100%.`, type: "error" });
    } else if (acidTank3Level < 10) {
      errors.push({ id: `acidTank3Level_low`, field: `acidTank3Level`, message: `Small Dosing Tank 3 Level is critically low (${acidTank3Level.toFixed(1)}%). Automated heap ph control at risk!`, type: "error" });
    }

    // 11. Advance flow to EW, 12. Advance pump speed, 13. Advance tank level
    if (advanceFlowToEw < 0) {
      errors.push({ id: `advanceFlowToEw_neg`, field: `advanceFlowToEw`, message: `Advance Flow to EW cannot be negative.`, type: "error" });
    } else if (advanceFlowToEw > 600) {
      errors.push({ id: `advanceFlowToEw_high`, field: `advanceFlowToEw`, message: `Advance Flow to EW exceeds hydraulic circuit parameters (${advanceFlowToEw.toFixed(1)} m³/h).`, type: "warning" });
    }
    if (advancePumpSpeed < 0 || advancePumpSpeed > 100) {
      errors.push({ id: `advancePumpSpeed_range`, field: `advancePumpSpeed`, message: `Advance Pump Speed must be between 0% and 100%.`, type: "error" });
    }
    if (advanceTankLevel < 0 || advanceTankLevel > 100) {
      errors.push({ id: `advanceTankLevel_range`, field: `advanceTankLevel`, message: `Advance Tank Level must be between 0% and 100%.`, type: "error" });
    } else if (advanceTankLevel < 15) {
      errors.push({ id: `advanceTankLevel_low`, field: `advanceTankLevel`, message: `Advance Surge Tank Level is low (${advanceTankLevel.toFixed(1)}%). EW cells feed starvation risk.`, type: "warning" });
    }

    // 14. Organic tank level, 15. Organic pump speed, 16. Organic flow
    if (organicTankLevel < 0 || organicTankLevel > 100) {
      errors.push({ id: `organicTankLevel_range`, field: `organicTankLevel`, message: `Organic Tank Level must be between 0% and 100%.`, type: "error" });
    } else if (organicTankLevel < 20) {
      errors.push({ id: `organicTankLevel_low`, field: `organicTankLevel`, message: `Organic Co-Reagent inventory level is low (${organicTankLevel.toFixed(1)}%). Replenish diluent mixture.`, type: "warning" });
    }
    if (organicPumpSpeed < 0 || organicPumpSpeed > 100) {
      errors.push({ id: `organicPumpSpeed_range`, field: `organicPumpSpeed`, message: `Organic Pump Speed must be between 0% and 100%.`, type: "error" });
    }
    if (organicFlow < 0) {
      errors.push({ id: `organicFlow_neg`, field: `organicFlow`, message: `Organic Flow cannot be negative.`, type: "error" });
    } else if (organicFlow > 1000) {
      errors.push({ id: `organicFlow_high`, field: `organicFlow`, message: `Organic Active Extraction Flow exceeds safe diluent parameters.`, type: "warning" });
    }
  }

  return errors;
};

// LocalStorage helpers for shifts persistence
const HISTORY_KEY = "leach_pad_shifts_history_v2";

export const getShiftHistory = (): ShiftTelemetryData[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(HISTORY_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveShiftToHistory = (data: ShiftTelemetryData): void => {
  const history = getShiftHistory();
  // Avoid duplicate by ID
  const filtered = history.filter((h) => h.id !== data.id);
  const updated = [data, ...filtered].slice(0, 50); // Keep last 50 entries
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
};

export const deleteShiftFromHistory = (id: string): void => {
  const history = getShiftHistory();
  const updated = history.filter((h) => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
};
