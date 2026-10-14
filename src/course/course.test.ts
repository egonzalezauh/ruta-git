import { describe, expect, it } from 'vitest';
import { execute, type World } from '../engine';
import { ROUTE, getChapter, getMission, isReady } from './index';
import { makeCtx, missionWon, objectiveStatus, pendingEvent, type Rec } from './runner';

const lessons = ROUTE.filter((c) => c.kind === 'lesson').map((c) => getChapter(c.id)!);
const missions = ROUTE.filter((c) => c.kind === 'mission').map((c) => getMission(c.id)!);

describe('estructura del curso', () => {
  it('tiene 10 paradas y 4 misiones, todas con contenido', () => {
    expect(lessons).toHaveLength(10);
    expect(missions).toHaveLength(4);
    expect(ROUTE.every((c) => isReady(c.id))).toBe(true);
    expect(new Set(ROUTE.map((c) => c.id)).size).toBe(ROUTE.length);
  });
});

describe.each(lessons.map((c) => [c.id, c.title, c] as const))('parada %i: %s', (_id, _title, chapter) => {
  it('se puede completar paso a paso con la solución', () => {
    let world: World = chapter.makeWorld();

    chapter.steps.forEach((step) => {
      if (step.setup) world = step.setup(world);
      const before = world;
      const since: Rec[] = [];

      // Ningún paso debe darse por cumplido sin que la persona haga algo.
      if (step.check) {
        expect(step.check(makeCtx(world, before, [])), `"${step.id}" ya estaba cumplido al empezar`).toBe(false);
      }

      for (const cmd of step.solution ?? []) {
        if (cmd.startsWith('@')) {
          const action = step.actions![Number(cmd.slice(1))];
          world = action.run(world);
          since.push({ input: `[evento] ${action.label}`, ok: true });
        } else {
          const res = execute(world, cmd);
          world = res.world;
          since.push({ input: cmd, ok: res.ok });
        }
      }

      if (step.check) {
        expect(step.check(makeCtx(world, before, since)), `"${step.id}" no se cumple con su solución`).toBe(true);
      } else {
        expect(step.solution ?? [], `"${step.id}" es de lectura y no debería tener solución`).toEqual([]);
      }
    });
  });

  it('cada paso tiene título y explicación', () => {
    for (const s of chapter.steps) {
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.body).toBeTruthy();
    }
    expect(chapter.recap.length).toBeGreaterThan(0);
  });
});

describe.each(missions.map((m) => [m.id, m.title, m] as const))('misión %i: %s', (_id, _title, mission) => {
  it('empieza sin estar resuelta', () => {
    const w = mission.makeWorld();
    expect(missionWon(mission, w)).toBe(false);
  });

  it('se puede ganar con la solución, incluyendo los giros', () => {
    let world = mission.makeWorld();
    const fired: string[] = [];
    const cmds: string[] = [];
    let wonEarly = false;

    for (const cmd of mission.solution) {
      world = execute(world, cmd, { hints: false }).world;
      cmds.push(cmd);
      let ev = pendingEvent(mission, world, cmds, fired);
      while (ev) {
        world = ev.run(world);
        fired.push(ev.id);
        ev = pendingEvent(mission, world, cmds, fired);
      }
      if (missionWon(mission, world) && cmd !== mission.solution[mission.solution.length - 1]) wonEarly = true;
    }
    const pending = objectiveStatus(mission, world)
      .filter((s) => !s.objective.bonus && !s.done)
      .map((s) => s.objective.id);
    expect(pending, 'objetivos sin cumplir').toEqual([]);
    expect(missionWon(mission, world)).toBe(true);
    expect(wonEarly, 'se ganó antes de terminar la solución').toBe(false);
  });

  it('no da ayuda ni pistas', () => {
    const w = mission.makeWorld();
    const help = execute(w, 'help', { hints: false });
    expect(help.lines.map((l) => l.text).join(' ')).toContain('no hay ayuda');
    const typo = execute(w, 'git comit', { hints: false });
    expect(typo.lines.map((l) => l.text).join(' ')).not.toContain('Quisiste decir');
  });
});
