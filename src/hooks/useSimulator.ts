import { useCallback, useRef, useState } from 'react';
import { currentBranch, execute, type LineKind, type OutLine, type World } from '../engine';

export interface TermEntry {
  id: number;
  type: 'cmd' | 'out';
  text: string;
  kind?: LineKind;
  /** Para líneas de comando: cómo se veía el prompt cuando se escribió. */
  cwd?: string;
  branch?: string | null;
  ok?: boolean;
}

export interface CommandRecord {
  input: string;
  ok: boolean;
  lines: OutLine[];
  after: World;
  /** Un comando, un evento simulado (otra persona) o una edición en el editor. */
  kind: 'cmd' | 'event' | 'edit';
  /** ¿Cambió algo del proyecto? (los comandos que solo miran no cuentan como movimiento) */
  changed: boolean;
}

interface Options {
  /** `false` en las misiones: sin pistas ni ayuda dentro de la terminal. */
  hints?: boolean;
}

/** Mantiene el proyecto simulado, lo que se ve en la terminal y el historial de comandos. */
export function useSimulator(makeWorld: () => World, welcome: string[] = [], opts: Options = {}) {
  const idRef = useRef(0);
  const nextId = () => ++idRef.current;
  const initial = useRef<World | null>(null);
  if (initial.current === null) initial.current = makeWorld();

  const worldRef = useRef<World>(initial.current);
  const hintsRef = useRef(opts.hints !== false);
  const [world, setWorld] = useState<World>(initial.current);
  const [entries, setEntries] = useState<TermEntry[]>(() =>
    welcome.map((t) => ({ id: nextId(), type: 'out' as const, text: t, kind: 'dim' as LineKind })),
  );
  const [commands, setCommands] = useState<CommandRecord[]>([]);

  const note = useCallback((lines: string[], kind: LineKind = 'warn') => {
    setEntries((prev) => [
      ...prev,
      ...lines.map((text) => ({ id: ++idRef.current, type: 'out' as const, text, kind })),
    ]);
  }, []);

  const run = useCallback((input: string) => {
    const before = worldRef.current;
    const res = execute(before, input, { hints: hintsRef.current });
    worldRef.current = res.world;
    setWorld(res.world);
    const changed = res.world !== before && JSON.stringify(res.world) !== JSON.stringify(before);
    if (input.trim() && !res.clear) {
      setCommands((prev) => [
        ...prev,
        { input, ok: res.ok, lines: res.lines, after: res.world, kind: 'cmd', changed },
      ]);
    }
    setEntries((prev) => {
      const base = res.clear ? [] : prev;
      if (!input.trim() || res.clear) return base;
      const branch = before.repo ? (currentBranch(before.repo) ?? 'HEAD') : null;
      const cmd: TermEntry = {
        id: ++idRef.current,
        type: 'cmd',
        text: input,
        cwd: before.cwd,
        branch: before.repo ? branch : null,
        ok: res.ok,
      };
      const out: TermEntry[] = res.lines.map((l) => ({
        id: ++idRef.current,
        type: 'out',
        text: l.text,
        kind: l.kind,
      }));
      return [...base, cmd, ...out];
    });
    return res;
  }, []);

  /** Algo que pasa "afuera" (otra persona sube un cambio, se prepara un escenario). Cuenta como evento. */
  const inject = useCallback(
    (fn: (w: World) => World, message: string, label = 'evento', record = true) => {
      const before = worldRef.current;
      const next = fn(before);
      worldRef.current = next;
      setWorld(next);
      if (message) note(message.split('\n'), record ? 'warn' : 'dim');
      if (record) {
        setCommands((prev) => [
          ...prev,
          { input: `[evento] ${label}`, ok: true, lines: [], after: next, kind: 'event', changed: true },
        ]);
      }
      return next;
    },
    [note],
  );

  /** El usuario editó un archivo desde el editor. */
  const editFile = useCallback(
    (path: string, content: string) => {
      const before = worldRef.current;
      if (before.files[path] === content) return;
      const next = structuredClone(before);
      next.files[path] = content;
      worldRef.current = next;
      setWorld(next);
      note([`(guardaste cambios en ${path} desde el editor)`], 'dim');
      setCommands((prev) => [
        ...prev,
        { input: `[editor] ${path}`, ok: true, lines: [], after: next, kind: 'edit', changed: true },
      ]);
    },
    [note],
  );

  const reset = useCallback(() => {
    const w = makeWorld();
    worldRef.current = w;
    setWorld(w);
    setCommands([]);
    setEntries(
      welcome.map((t) => ({ id: ++idRef.current, type: 'out' as const, text: t, kind: 'dim' as LineKind })),
    );
    return w;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makeWorld]);

  return { world, entries, commands, run, reset, inject, editFile, note };
}
