import type { Activity, Habits, Hold, LinkedProgram, Moment, Program, Purchase, UsePlan } from '@shared/types';

export interface ProgramPlans {
  link: LinkedProgram;
  program: Program;
  plans: UsePlan[];
  nextReward: { optionId: string; pointsNeeded: number } | null;
}

export interface Summary {
  programs: ProgramPlans[];
  habits: Habits;
  holds: Hold[];
  atRisk: { programId: string; points: number; expiresAt: string }[];
  totals: { bestValue: number; valueAtRisk: number };
  activity: Activity[];
}

export interface ProgramsResponse {
  programs: { program: Program; link: LinkedProgram | null }[];
}

export interface Decision {
  sent: boolean;
  optionId: string | null;
  title: string;
  body: string;
  reasons: string[];
  suppressedBecause: string | null;
  uplift: number;
  pIfNotified: number;
  pIfNot: number;
  distanceM: number | null;
  bucket: string;
}

export interface EvaluateResponse {
  moment: Moment | null;
  decision: Decision;
  model: string;
  threshold: number;
  fallback: boolean;
  context: { hour: number; minute: number; located: boolean };
}

export interface PilotReply {
  reply: string;
  cards: string[];
  table: { columns: string[]; rows: string[][] } | null;
  notes: string[];
  followUps: string[];
  engine: string;
}

export type { Purchase };
