import { headId, isAncestor, type World } from '../engine';
import type { CheckCtx, Mission, MissionEvent, Step } from './types';

/** Lo mínimo que necesitamos saber de cada comando ejecutado. */
export interface Rec {
  input: string;
  ok: boolean;
}

export function makeCtx(world: World, before: World, since: Rec[]): CheckCtx {
  const last = since[since.length - 1];
  return {
    world,
    before,
    ran: (re) => since.some((c) => c.ok && re.test(c.input.trim())),
    tried: (re) => since.some((c) => re.test(c.input.trim())),
    last: last ? { input: last.input, ok: last.ok } : null,
  };
}

export function stepPassed(step: Step, ctx: CheckCtx): boolean {
  return !!step.check && step.check(ctx);
}

export function objectiveStatus(m: Mission, w: World) {
  return m.objectives.map((o) => ({ objective: o, done: safe(() => o.check(w)) }));
}

export function missionWon(m: Mission, w: World): boolean {
  return objectiveStatus(m, w)
    .filter((s) => !s.objective.bonus)
    .every((s) => s.done);
}

/** Primer evento de la misión que ya toca y todavía no ocurrió. */
export function pendingEvent(m: Mission, world: World, commands: string[], fired: string[]): MissionEvent | null {
  for (const e of m.events ?? []) {
    if (fired.includes(e.id)) continue;
    if (safe(() => e.when({ world, commands }))) return e;
  }
  return null;
}

/** 3 estrellas si cumples el objetivo ideal; 2 si te pasas poco; 1 por completarla. */
export function starsFor(moves: number, par: number): 1 | 2 | 3 {
  if (moves <= par) return 3;
  if (moves <= Math.ceil(par * 1.7)) return 2;
  return 1;
}

function safe(fn: () => boolean): boolean {
  try {
    return fn();
  } catch {
    return false;
  }
}

/** Atajos usados en los objetivos de las misiones. */
export const tip = (w: World, branch: string): string | undefined => w.repo?.branches[branch];
export const headCommit = (w: World) => (w.repo ? headId(w.repo) : null);
export const merged = (w: World, branch: string, into: string): boolean => {
  const a = tip(w, branch);
  const b = tip(w, into);
  return !!a && !!b && isAncestor(w, a, b);
};
