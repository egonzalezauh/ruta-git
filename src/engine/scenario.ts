import { ancestors, isAncestor, makeCommit, mergeBase, treeAt } from './core';
import { merge3 } from './diff';
import { execute } from './index';
import type { Tree, World } from './types';

/** Ejecuta comandos para preparar un escenario. Si alguno falla, lanza un error (así los errores de autoría se notan). */
export function script(w: World, cmds: string[]): World {
  let cur = w;
  for (const c of cmds) {
    const r = execute(cur, c);
    if (!r.ok) {
      throw new Error(`Escenario: falló "${c}" → ${r.lines.map((l) => l.text).join(' | ')}`);
    }
    cur = r.world;
  }
  return cur;
}

/** Igual que `script`, pero ignora los comandos que fallen (útil cuando el estado de partida puede variar). */
export function tryScript(w: World, cmds: string[]): World {
  let cur = w;
  for (const c of cmds) cur = execute(cur, c).world;
  return cur;
}

/** Ejecuta comandos como si los hiciera otra persona del equipo. */
export function asUser(w: World, name: string, cmds: string[]): World {
  const next = structuredClone(w);
  const prev = next.user;
  next.user = { name, email: `${name.toLowerCase()}@correo.com` };
  const out = script(next, cmds);
  out.user = prev;
  return out;
}

/** Crea un repositorio remoto vacío (como el que se crea en GitHub antes del primer push). */
export function addServer(w: World, url: string): World {
  const next = structuredClone(w);
  next.servers[url] ??= { branches: {}, tags: {} };
  return next;
}

type Patch = Record<string, string | null>;

function applyPatch(base: Tree, patch: Patch): Tree {
  const tree = { ...base };
  for (const [p, c] of Object.entries(patch)) {
    if (c === null) delete tree[p];
    else tree[p] = c;
  }
  return tree;
}

/** Una persona del equipo sube un commit a una rama del servidor. */
export function serverCommit(
  w: World,
  url: string,
  branch: string,
  patch: Patch,
  message: string,
  author = 'Ana <ana@correo.com>',
): World {
  const next = structuredClone(w);
  const server = (next.servers[url] ??= { branches: {}, tags: {} });
  const tip = server.branches[branch];
  const c = makeCommit(next, message, tip ? [tip] : [], applyPatch(treeAt(next, tip), patch), author);
  server.branches[branch] = c.id;
  return next;
}

/** Crea una rama nueva en el servidor a partir de otra. */
export function serverBranch(w: World, url: string, name: string, from = 'main'): World {
  const next = structuredClone(w);
  const server = next.servers[url];
  server.branches[name] = server.branches[from];
  return next;
}

/** Une una rama del servidor con otra (lo que hace el botón "Merge" de un pull request). */
export function serverMerge(
  w: World,
  url: string,
  branch: string,
  into = 'main',
  author = 'Ana <ana@correo.com>',
): World {
  const next = structuredClone(w);
  const server = next.servers[url];
  const a = server.branches[into];
  const b = server.branches[branch];
  if (!a || !b || a === b || isAncestor(next, b, a)) return next;
  if (isAncestor(next, a, b)) {
    server.branches[into] = b;
    return next;
  }
  const baseTree = treeAt(next, mergeBase(next, a, b));
  const oursTree = treeAt(next, a);
  const theirsTree = treeAt(next, b);
  const merged: Tree = { ...oursTree };
  for (const p of new Set([...Object.keys(baseTree), ...Object.keys(oursTree), ...Object.keys(theirsTree)])) {
    const m = merge3(baseTree[p] ?? '', oursTree[p] ?? '', theirsTree[p] ?? '', into, branch);
    if (m.conflict) throw new Error(`Escenario: el pull request de ${branch} tiene conflictos en ${p}`);
    if (oursTree[p] === undefined && theirsTree[p] === undefined) continue;
    if (m.text === '' && theirsTree[p] === undefined) delete merged[p];
    else merged[p] = m.text;
  }
  const c = makeCommit(next, `Merge pull request de ${branch}`, [a, b], merged, author);
  server.branches[into] = c.id;
  return next;
}

/** Agrega un commit a una rama local sin tocar la carpeta de trabajo (trabajo "que ya estaba hecho"). */
export function branchCommit(
  w: World,
  branch: string,
  patch: Patch,
  message: string,
  author = 'Luis <luis@correo.com>',
): World {
  const next = structuredClone(w);
  const r = next.repo!;
  const tip = r.branches[branch];
  const c = makeCommit(next, message, tip ? [tip] : [], applyPatch(treeAt(next, tip), patch), author);
  r.branches[branch] = c.id;
  return next;
}

/** ¿Todos los commits de `ancestor` ya están dentro de `branch`? */
export function contains(w: World, branchTip: string | undefined, commitId: string | undefined): boolean {
  if (!branchTip || !commitId) return false;
  return ancestors(w, branchTip).has(commitId);
}
