/**
 * 经期预测 - 业务类型
 * 对齐 Flask predictor.predict() 的输出
 */

export type PredictMode = 'normal' | 'ttc' | 'contraception';

export interface Cycle {
  id: number;
  startDate: string;          // YYYY-MM-DD
  periodDays: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhaseRange {
  start: string;
  end: string;
}

export interface OvulationInfo extends PhaseRange {
  ovulationDay: string;
  bestDays: string[];
}

export interface PhaseMap {
  menstrual: PhaseRange;
  follicular: PhaseRange;
  ovulation: OvulationInfo;
  luteal: PhaseRange;
  pms: PhaseRange & { days: number };
}

export interface CurrentCycle {
  currentPhase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'pms';
  dayOfCycle: number;
  daysUntilNextPeriod: number;
}

export interface CycleStats {
  avgCycle: number;
  minCycle: number;
  maxCycle: number;
  stdDev: number;
  variance: number;
  totalCycles: number;
  cycles: number[];
  filteredCycles: number[];
  filtered: boolean;
  regularityLevel: 'regular' | 'irregular' | 'very_irregular' | 'unknown';
}

export interface Prediction {
  nextPeriodStart: string;
  nextPeriodEnd: string;
  confidence: 'high' | 'medium' | 'low';
  errorDays: number;
  confidenceInterval: { earliest: string; latest: string };
}

export interface OverdueInfo {
  isOverdue: boolean;
  level: 'normal' | 'warning' | 'overdue';
  overdueDays: number;
  suggestion: string;
}

export interface Warning {
  code: string;
  level: 'info' | 'warning' | 'danger';
  message: string;
}

export interface ModeInfo {
  mode: PredictMode;
  tips: string[];
}

export interface PredictionResult {
  prediction: Prediction;
  currentCycle: CurrentCycle;
  cycleStats: CycleStats;
  phases: PhaseMap;
  overdueInfo: OverdueInfo;
  modeInfo: ModeInfo;
  warnings: Warning[];
  specialNote: string;
}

export interface AnnualStats {
  year: number;
  totalCycles: number;
  avgCycleLength: number;
  minCycleLength: number;
  maxCycleLength: number;
  stdDev: number;
  longestGap: number;
  shortestGap: number;
  regularityLevel: 'very_regular' | 'regular' | 'irregular' | 'very_irregular';
  regularityScore: number;
  cycleDetails: Array<{
    index: number;
    startDate: string;
    cycleLength: number;
  }>;
}

export interface DemoCaseInput {
  lmp: string;
  periodDays: number;
  avgCycle: number;
  history: string[];
  mode: PredictMode;
  specialFactors: Record<string, boolean>;
  chronicConditions: string[];
  pmsDays: number;
}

export interface DemoCaseResponse {
  data: PredictionResult;
  caseInput: DemoCaseInput;
}
