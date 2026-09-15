export type PadStatus = "Active" | "Off" | "Offline";
export type FeedType = "RAF" | "ILS";

export interface LeachPadNode {
  id: string; // e.g., "LP1"
  min: number;
  max: number;
  status: PadStatus;
  feedType?: FeedType;
  dischargePlsPercent?: number;
  dischargeIlsPercent?: number;
  notes?: string;
  totalizer?: number; // Totalizer entry in m³
}

export interface PondTelemetry {
  id: string; // e.g. "raf"
  name: string; // e.g. "RAF Pond Acid:"
  totalizer: number;
  flow: number;
}

export interface ExtraProcessTelemetry {
  plsFlowToSx: number;
  plsPondLevel: number;
  plsPumpSpeed: number;
  ilsPondLevel: number;
  ilsPumpSpeed: number;
  rafPondLevel: number;
  rafPumpSpeed: number;
  acidTank1Level: number;
  acidTank2Level: number;
  acidTank3Level: number; // Acid Tank Small
  advanceFlowToEw: number;
  advancePumpSpeed: number;
  advanceTankLevel: number;
  organicTankLevel: number;
  organicPumpSpeed: number;
  organicFlow: number;

  // New Tank Levels from report
  gyroCrusherAcidTankLevel: number;
  jawCrusherAcidTankLevel: number;
  organicTankLevelSx2: number;
  advanceTankLevelSx2: number;
  hgRaffinateTankLevelSx2: number;
  spentTankLevel: number;
  backwashTankLevel: number;
  intermediateLevel: number;
  newSpentTankLevel: number;
  diluentTankLevel: number;
  dieselTankBurner: number;

  // New Flows from report
  ilsFlowToSx2: number;
  plsFlowToSx2: number;
  totalRaffinateFlow: number;
  totalIlsFlow: number;
  spentFlowToSx: number;
  newCirculationFlow: number;

  // New Ponds from report
  stormWaterPondLevel: number;
  rawWaterPondLevel: number;

  // EW Rectifier Current
  ewCurrent: number; // in KA
}

export interface ShiftTelemetryData {
  id: string; // unique ID of submission
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  operatorEmail: string;
  operatorName?: string;
  employmentNumber?: string;
  pads: LeachPadNode[];
  ponds: {
    raf: PondTelemetry;
    ils: PondTelemetry;
    crasher: PondTelemetry;
    mainLine: PondTelemetry;
  };
  extraTelemetry?: ExtraProcessTelemetry;
  notes?: string;
}

export interface ValidationError {
  id: string;
  field: string; // e.g., "LP4_min", "raf_totalizer"
  message: string;
  type: "error" | "warning" | "suggestion";
}

export interface SystemMetrics {
  totalActiveFlow: number;
  avgPadFlow: number;
  activePadCount: number;
  totalPadsCount: number;
  maxVariancePad: string;
  totalizerSum: number;
  pondFlowSum: number;
}
