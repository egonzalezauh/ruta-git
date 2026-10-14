import type { Commit, Repo, Tree, World } from './types';
import { hash40, isIgnored } from './util';

export const BASE_TIME = Date.UTC(2026, 2, 2, 9, 0, 0);
const MINUTE = 60_000;

export function createWorld(opts: { cwd?: string; files?: Tree; userName?: string } = {}): World {
  const name = opts.userName ?? 'Tú';
  return {
    files: { ...(opts.files ?? {}) },
    repo: null,
    commits: {},
    servers: {},
    cwd: opts.cwd ?? 'proyecto',
    seq: 1,
    user: { name, email: 'tu@correo.com' },
  };
}

export function newRepo(branch = 'main'): Repo {
  return {
    head: { kind: 'branch', name: branch },
    branches: {},
    tags: {},
    index: {},
    stash: [],
    remotes: {},
    tracking: {},
    upstream: {},
    merge: null,
    reflog: [],
  };
}

export const shortId = (id: string) => id.slice(0, 7);

export function headId(r: Repo): string | null {
  return r.head.kind === 'branch' ? (r.branches[r.head.name] ?? null) : r.head.id;
}

export function currentBranch(r: Repo): string | null {
  return r.head.kind === 'branch' ? r.head.name : null;
}

export function treeAt(w: World, id: string | null | undefined): Tree {
  return id ? (w.commits[id]?.tree ?? {}) : {};
}

export function headTree(w: World): Tree {
  return w.repo ? treeAt(w, headId(w.repo)) : {};
}

export function ancestors(w: World, id: string | null): Set<string> {
  const seen = new Set<string>();
  const stack = id ? [id] : [];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const p of w.commits[cur]?.parents ?? []) stack.push(p);
  }
  return seen;
}

/** ¿`a` es igual o ancestro de `b`? */
export function isAncestor(w: World, a: string, b: string): boolean {
  return ancestors(w, b).has(a);
}

export function mergeBase(w: World, a: string, b: string): string | null {
  const fromA = ancestors(w, a);
  let best: Commit | null = null;
  for (const id of ancestors(w, b)) {
    if (!fromA.has(id)) continue;
    const c = w.commits[id];
    if (!best || c.seq > best.seq) best = c;
  }
  return best ? best.id : null;
}

export function makeCommit(w: World, message: string, parents: string[], tree: Tree, author?: string): Commit {
  const auth = author ?? `${w.user.name} <${w.user.email}>`;
  const seq = w.seq++;
  const id = hash40(JSON.stringify([message, parents, tree, seq, auth]));
  const commit: Commit = {
    id,
    message,
    parents,
    tree: { ...tree },
    author: auth,
    seq,
    time: BASE_TIME + seq * 17 * MINUTE,
  };
  w.commits[id] = commit;
  return commit;
}

/** Interpreta nombres como HEAD, HEAD~2, main, v1.0, origin/main, a1b2c3d o HEAD@{1}. */
export function resolveRev(w: World, spec: string): string | null {
  const r = w.repo;
  if (!r) return null;
  const m = /^(.*?)((?:[~^]\d*)*)$/.exec(spec);
  if (!m) return null;
  const name = m[1];
  const suffix = m[2];

  let id: string | null = null;
  const reflogRef = /^HEAD@\{(\d+)\}$/.exec(name);
  if (name === 'HEAD') id = headId(r);
  else if (reflogRef) {
    const n = Number(reflogRef[1]);
    id = r.reflog[r.reflog.length - 1 - n]?.id ?? null;
  } else if (r.branches[name]) id = r.branches[name];
  else if (r.tags[name]) id = r.tags[name];
  else if (r.tracking[name]) id = r.tracking[name];
  else if (/^[0-9a-f]{4,40}$/.test(name)) {
    const hits = Object.keys(w.commits).filter((c) => c.startsWith(name));
    if (hits.length === 1) id = hits[0];
  }
  if (!id) return null;

  let cur: string = id;
  for (const tok of suffix.match(/[~^]\d*/g) ?? []) {
    const n = tok.length > 1 ? Number(tok.slice(1)) : 1;
    if (tok[0] === '~') {
      for (let i = 0; i < n; i++) {
        const parent: string | undefined = w.commits[cur]?.parents[0];
        if (!parent) return null;
        cur = parent;
      }
    } else {
      const parent: string | undefined = w.commits[cur]?.parents[n - 1];
      if (!parent) return null;
      cur = parent;
    }
  }
  return cur;
}

export type ChangeKind = 'new' | 'modified' | 'deleted';
export interface FileChange {
  path: string;
  kind: ChangeKind;
}

export function diffTrees(from: Tree, to: Tree): FileChange[] {
  const out: FileChange[] = [];
  const paths = new Set([...Object.keys(from), ...Object.keys(to)]);
  for (const path of [...paths].sort()) {
    const a = from[path];
    const b = to[path];
    if (a === b) continue;
    out.push({ path, kind: a === undefined ? 'new' : b === undefined ? 'deleted' : 'modified' });
  }
  return out;
}

export interface StatusInfo {
  branch: string | null;
  detachedAt: string | null;
  unborn: boolean;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: string[];
  unmerged: string[];
  clean: boolean;
}

export function statusInfo(w: World): StatusInfo {
  const r = w.repo!;
  const head = headTree(w);
  const unmerged = r.merge?.conflicts ?? [];
  const staged = diffTrees(head, r.index).filter((c) => !unmerged.includes(c.path));
  const unstaged: FileChange[] = [];
  for (const path of Object.keys(r.index).sort()) {
    if (unmerged.includes(path)) continue;
    const wd = w.files[path];
    if (wd === undefined) unstaged.push({ path, kind: 'deleted' });
    else if (wd !== r.index[path]) unstaged.push({ path, kind: 'modified' });
  }
  const gi = w.files['.gitignore'];
  const untracked = Object.keys(w.files)
    .filter((p) => r.index[p] === undefined && !isIgnored(p, gi))
    .sort();
  const id = headId(r);
  return {
    branch: currentBranch(r),
    detachedAt: r.head.kind === 'detached' ? r.head.id : null,
    unborn: id === null,
    staged,
    unstaged,
    untracked,
    unmerged: [...unmerged],
    clean: !staged.length && !unstaged.length && !untracked.length && !unmerged.length,
  };
}

/** Commits alcanzables desde un conjunto de puntas, del más nuevo al más antiguo. */
export function reachable(w: World, tips: string[]): Commit[] {
  const seen = new Set<string>();
  for (const t of tips) for (const id of ancestors(w, t)) seen.add(id);
  return [...seen]
    .map((id) => w.commits[id])
    .filter(Boolean)
    .sort((a, b) => b.seq - a.seq);
}

export function allTips(w: World): string[] {
  const r = w.repo;
  if (!r) return [];
  const tips = new Set<string>();
  const h = headId(r);
  if (h) tips.add(h);
  for (const id of Object.values(r.branches)) tips.add(id);
  for (const id of Object.values(r.tags)) tips.add(id);
  for (const id of Object.values(r.tracking)) tips.add(id);
  return [...tips];
}

export function logHead(w: World, msg: string) {
  const r = w.repo!;
  r.reflog.push({ id: headId(r), msg });
}

export function setHeadCommit(w: World, id: string) {
  const r = w.repo!;
  if (r.head.kind === 'branch') r.branches[r.head.name] = id;
  else r.head = { kind: 'detached', id };
}

/** Nombre corto de commit para mensajes: "a1b2c3d mensaje". */
export function describeCommit(w: World, id: string) {
  const c = w.commits[id];
  return `${shortId(id)} ${c?.message.split('\n')[0] ?? ''}`.trim();
}
