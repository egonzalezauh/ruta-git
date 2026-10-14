/** Archivos del proyecto: ruta -> contenido. Sin carpetas reales (las rutas con "/" crean carpetas implícitas). */
export type Tree = Record<string, string>;

export interface Commit {
  id: string;
  message: string;
  parents: string[];
  tree: Tree;
  author: string;
  /** Contador creciente: sirve como orden cronológico y topológico. */
  seq: number;
  time: number;
}

export type Head = { kind: 'branch'; name: string } | { kind: 'detached'; id: string };

export interface StashEntry {
  message: string;
  base: string | null;
  branch: string;
  work: Tree;
  index: Tree;
}

export interface MergeState {
  theirs: string;
  theirsName: string;
  message: string;
  conflicts: string[];
}

export interface ReflogEntry {
  id: string | null;
  msg: string;
}

export interface Repo {
  head: Head;
  branches: Record<string, string>;
  tags: Record<string, string>;
  /** Área de preparación (staging). */
  index: Tree;
  stash: StashEntry[];
  /** nombre -> url */
  remotes: Record<string, string>;
  /** "origin/main" -> id del commit */
  tracking: Record<string, string>;
  /** rama local -> "origin/main" */
  upstream: Record<string, string>;
  merge: MergeState | null;
  reflog: ReflogEntry[];
}

export interface Server {
  branches: Record<string, string>;
  tags: Record<string, string>;
}

export interface World {
  /** Carpeta de trabajo. */
  files: Tree;
  repo: Repo | null;
  /** Almacén de commits compartido entre tu repositorio y los servidores simulados. */
  commits: Record<string, Commit>;
  servers: Record<string, Server>;
  cwd: string;
  seq: number;
  user: { name: string; email: string };
}

export type LineKind = 'out' | 'err' | 'ok' | 'warn' | 'dim' | 'add' | 'del' | 'hunk' | 'head' | 'bold';

export interface OutLine {
  text: string;
  kind?: LineKind;
}

export interface ExecResult {
  world: World;
  lines: OutLine[];
  /** El comando terminó sin error. */
  ok: boolean;
  /** Pide a la terminal limpiar la pantalla. */
  clear?: boolean;
}
