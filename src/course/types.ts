import type { ReactNode } from 'react';
import type { World } from '../engine';

export interface CheckCtx {
  /** Estado del proyecto ahora. */
  world: World;
  /** Estado del proyecto cuando empezó este paso. */
  before: World;
  /** ¿Se ejecutó con éxito, desde que empezó el paso, un comando que coincida? */
  ran: (re: RegExp) => boolean;
  /** ¿Se intentó (aunque fallara) un comando que coincida? */
  tried: (re: RegExp) => boolean;
  /** Último comando ejecutado. */
  last: { input: string; ok: boolean } | null;
}

/** Botón que simula algo que hace otra persona (por ejemplo, que Ana suba un cambio). */
export interface StepAction {
  label: string;
  /** Lo que se muestra en la terminal cuando ocurre. */
  message: string;
  run: (w: World) => World;
}

export interface Step {
  id: string;
  title: string;
  /** Qué hacer y por qué. Puede depender del estado del proyecto. */
  body: ReactNode | ((w: World) => ReactNode);
  /** Si no hay `check`, es un paso de lectura. */
  check?: (c: CheckCtx) => boolean;
  /** Comandos que se ofrecen como botones para copiar a la terminal. */
  suggest?: string[] | ((w: World) => string[]);
  hint?: ReactNode;
  /** Explicación que aparece cuando el paso se completa. */
  done?: ReactNode;
  /** Prepara una situación nueva al empezar el paso. */
  setup?: (w: World) => World;
  /** Aviso en la terminal cuando se prepara la situación. */
  setupNote?: string;
  /** Botones que simulan acciones de otras personas. */
  actions?: StepAction[];
  /** Solo para pruebas automáticas: comandos que resuelven el paso ("@0" = acción 0). */
  solution?: string[];
}

export type RouteKind = 'lesson' | 'mission';

export interface ChapterMeta {
  id: number;
  kind: RouteKind;
  title: string;
  tagline: string;
  minutes: number;
}

export interface Chapter extends ChapterMeta {
  kind: 'lesson';
  makeWorld: () => World;
  steps: Step[];
  recap: { cmd: string; desc: string }[];
}

export interface Objective {
  id: string;
  text: string;
  check: (w: World) => boolean;
  /** Los objetivos extra no son obligatorios. */
  bonus?: boolean;
}

/** Algo que pasa en medio de la misión (por ejemplo, un compañero sube un cambio). */
export interface MissionEvent {
  id: string;
  when: (c: { world: World; commands: string[] }) => boolean;
  run: (w: World) => World;
  message: string;
}

export interface Mission extends ChapterMeta {
  kind: 'mission';
  story: ReactNode;
  makeWorld: () => World;
  objectives: Objective[];
  events?: MissionEvent[];
  /** Cantidad de movimientos "ideal" para ganar las tres estrellas. */
  par: number;
  /** Para pruebas automáticas y para mostrar al final una forma de resolverla. */
  solution: string[];
  /** Qué se practicó. */
  debrief: ReactNode;
}
