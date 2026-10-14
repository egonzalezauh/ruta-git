import {
  allTips,
  ancestors,
  currentBranch,
  describeCommit,
  diffTrees,
  headId,
  headTree,
  isAncestor,
  logHead,
  makeCommit,
  mergeBase,
  newRepo,
  reachable,
  resolveRev,
  setHeadCommit,
  shortId,
  statusInfo,
  treeAt,
  type FileChange,
} from './core';
import { countChanges, diffLines, hasConflictMarkers, merge3, splitLines } from './diff';
import type { LineKind, OutLine, Tree, World } from './types';
import { isIgnored } from './util';

export class Out {
  lines: OutLine[] = [];
  /** Conservar los cambios aunque el comando haya terminado con error (p. ej. un conflicto). */
  keep = false;
  out(text: string, kind?: LineKind) {
    for (const t of text.split('\n')) this.lines.push({ text: t, kind });
  }
  err(text: string) {
    this.out(text, 'err');
  }
  dim(text: string) {
    this.out(text, 'dim');
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fmtDate(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

const GIT_COMMANDS = [
  'init', 'clone', 'config', 'status', 'add', 'commit', 'log', 'diff', 'show', 'branch', 'switch',
  'checkout', 'merge', 'restore', 'reset', 'revert', 'stash', 'tag', 'remote', 'fetch', 'pull', 'push',
  'rm', 'mv', 'reflog', 'help',
];

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/* ------------------------------------------------------------------ */
/* Utilidades de salida                                                */
/* ------------------------------------------------------------------ */

function statLine(changes: FileChange[], from: Tree, to: Tree, o: Out, withFiles = false) {
  let ins = 0;
  let del = 0;
  const rows: string[] = [];
  const width = Math.max(0, ...changes.map((c) => c.path.length));
  for (const c of changes) {
    const { added, removed } = countChanges(from[c.path], to[c.path]);
    ins += added;
    del += removed;
    rows.push(` ${c.path.padEnd(width)} | ${added + removed} ${'+'.repeat(Math.min(added, 20))}${'-'.repeat(Math.min(removed, 20))}`);
  }
  if (withFiles) for (const r of rows) o.out(r);
  const parts = [plural(changes.length, 'archivo cambiado', 'archivos cambiados')];
  if (ins) parts.push(plural(ins, 'inserción(+)', 'inserciones(+)'));
  if (del) parts.push(plural(del, 'eliminación(-)', 'eliminaciones(-)'));
  if (changes.length) o.out(' ' + parts.join(', '));
  for (const c of changes) {
    if (c.kind === 'new') o.out(` modo de creación 100644 ${c.path}`);
    if (c.kind === 'deleted') o.out(` modo de borrado 100644 ${c.path}`);
  }
}

function renderDiff(from: Tree, to: Tree, o: Out, only?: string[]) {
  let changes = diffTrees(from, to);
  if (only?.length) changes = changes.filter((c) => only.includes(c.path));
  for (const c of changes) {
    o.out(`diff --git a/${c.path} b/${c.path}`, 'bold');
    if (c.kind === 'new') o.out('nuevo archivo, modo 100644', 'bold');
    if (c.kind === 'deleted') o.out('archivo borrado, modo 100644', 'bold');
    o.out(c.kind === 'new' ? '--- /dev/null' : `--- a/${c.path}`, 'bold');
    o.out(c.kind === 'deleted' ? '+++ /dev/null' : `+++ b/${c.path}`, 'bold');
    const a = splitLines(from[c.path] ?? '');
    const b = splitLines(to[c.path] ?? '');
    o.out(`@@ -${a.length ? 1 : 0},${a.length} +${b.length ? 1 : 0},${b.length} @@`, 'hunk');
    for (const op of diffLines(a, b)) {
      o.out(`${op.t}${op.s}`, op.t === '+' ? 'add' : op.t === '-' ? 'del' : undefined);
    }
  }
  return changes.length;
}

function decorations(w: World, id: string): string {
  const r = w.repo!;
  const labels: string[] = [];
  const hid = headId(r);
  if (r.head.kind === 'branch' && hid === id) labels.push(`HEAD -> ${r.head.name}`);
  else if (r.head.kind === 'detached' && hid === id) labels.push('HEAD');
  for (const [name, bid] of Object.entries(r.branches)) {
    if (bid === id && !(r.head.kind === 'branch' && r.head.name === name)) labels.push(name);
  }
  for (const [name, tid] of Object.entries(r.tags)) if (tid === id) labels.push(`tag: ${name}`);
  for (const [name, tid] of Object.entries(r.tracking)) if (tid === id) labels.push(name);
  return labels.length ? ` (${labels.join(', ')})` : '';
}

/* ------------------------------------------------------------------ */
/* init / clone / config                                               */
/* ------------------------------------------------------------------ */

function cmdInit(w: World, _args: string[], o: Out) {
  if (w.repo) {
    o.out(`Reinicializado el repositorio Git existente en ~/${w.cwd}/.git/`);
    return true;
  }
  w.repo = newRepo('main');
  o.out(`Inicializado repositorio Git vacío en ~/${w.cwd}/.git/`);
  return true;
}

function cmdClone(w: World, args: string[], o: Out) {
  const pos = args.filter((a) => !a.startsWith('-'));
  const url = pos[0];
  if (!url) {
    o.err('fatal: Debes indicar el repositorio que quieres clonar.');
    o.dim('Ejemplo: git clone https://github.com/usuario/proyecto.git');
    return false;
  }
  const server = w.servers[url];
  if (!server) {
    o.err(`fatal: repositorio '${url}' no encontrado`);
    return false;
  }
  if (w.repo) {
    o.err('fatal: Ya estás dentro de un repositorio. Para clonar otro, empieza en una carpeta vacía.');
    return false;
  }
  const dir = pos[1] ?? (url.split('/').pop() ?? 'proyecto').replace(/\.git$/, '');
  const r = newRepo('main');
  const defaultBranch = server.branches.main ? 'main' : (Object.keys(server.branches)[0] ?? 'main');
  r.head = { kind: 'branch', name: defaultBranch };
  r.remotes.origin = url;
  for (const [b, id] of Object.entries(server.branches)) r.tracking[`origin/${b}`] = id;
  for (const [t, id] of Object.entries(server.tags)) r.tags[t] = id;
  const tip = server.branches[defaultBranch];
  o.out(`Clonando en '${dir}'...`);
  if (tip) {
    r.branches[defaultBranch] = tip;
    r.upstream[defaultBranch] = `origin/${defaultBranch}`;
    r.index = { ...treeAt(w, tip) };
    w.files = { ...treeAt(w, tip) };
    r.reflog.push({ id: tip, msg: `clone: desde ${url}` });
  } else {
    o.dim('Aviso: parece que clonaste un repositorio vacío.');
  }
  w.repo = r;
  w.cwd = dir;
  o.out('recibiendo objetos: 100%, listo.');
  return true;
}

function cmdConfig(w: World, args: string[], o: Out) {
  const pos = args.filter((a) => !a.startsWith('--'));
  if (args.includes('--list') || args.includes('-l')) {
    o.out(`user.name=${w.user.name}`);
    o.out(`user.email=${w.user.email}`);
    return true;
  }
  const [key, value] = pos;
  if (!key) {
    o.err('uso: git config [--global] <clave> [<valor>]');
    return false;
  }
  if (value === undefined) {
    if (key === 'user.name') o.out(w.user.name);
    else if (key === 'user.email') o.out(w.user.email);
    else return false;
    return true;
  }
  if (key === 'user.name') w.user.name = value;
  if (key === 'user.email') w.user.email = value;
  return true;
}

/* ------------------------------------------------------------------ */
/* status / add / commit                                               */
/* ------------------------------------------------------------------ */

function aheadBehind(w: World, local: string, remote: string) {
  const a = ancestors(w, local);
  const b = ancestors(w, remote);
  return {
    ahead: [...a].filter((id) => !b.has(id)).length,
    behind: [...b].filter((id) => !a.has(id)).length,
  };
}

const KIND_LABEL: Record<string, string> = {
  new: 'nuevo archivo:',
  modified: 'modificado:',
  deleted: 'borrado:',
};

function cmdStatus(w: World, args: string[], o: Out) {
  const r = w.repo!;
  const s = statusInfo(w);

  if (args.includes('-s') || args.includes('--short')) {
    const rows = new Map<string, { x: string; y: string }>();
    const mark = (k: string) => (k === 'new' ? 'A' : k === 'deleted' ? 'D' : 'M');
    for (const c of s.staged) rows.set(c.path, { x: mark(c.kind), y: ' ' });
    for (const c of s.unstaged) {
      const row = rows.get(c.path) ?? { x: ' ', y: ' ' };
      row.y = mark(c.kind);
      rows.set(c.path, row);
    }
    for (const p of s.unmerged) rows.set(p, { x: 'U', y: 'U' });
    for (const [p, { x, y }] of [...rows].sort()) o.out(`${x}${y} ${p}`, y !== ' ' ? 'err' : 'ok');
    for (const p of s.untracked) o.out(`?? ${p}`, 'err');
    return true;
  }

  o.out(s.branch ? `En la rama ${s.branch}` : `HEAD desacoplado en ${shortId(s.detachedAt!)}`);
  const up = s.branch ? r.upstream[s.branch] : undefined;
  const localId = headId(r);
  if (up && r.tracking[up] && localId) {
    const { ahead, behind } = aheadBehind(w, localId, r.tracking[up]);
    if (ahead && behind) {
      o.out(`Tu rama y '${up}' han divergido,\ny tienen ${ahead} y ${behind} commits diferentes cada una respectivamente.\n  (usa "git pull" para fusionar la rama remota con la tuya)`);
    } else if (ahead) {
      o.out(`Tu rama está adelantada a '${up}' por ${plural(ahead, 'commit', 'commits')}.\n  (usa "git push" para publicar tus commits locales)`);
    } else if (behind) {
      o.out(`Tu rama está atrasada respecto a '${up}' por ${plural(behind, 'commit', 'commits')}, y se puede avanzar rápido.\n  (usa "git pull" para actualizar tu rama local)`);
    } else o.out(`Tu rama está actualizada con '${up}'.`);
  }
  if (s.unborn) o.out('\nTodavía no hay commits');

  if (r.merge) {
    if (s.unmerged.length) {
      o.out('\nTienes rutas sin fusionar.\n  (arregla los conflictos y ejecuta "git commit")\n  (usa "git merge --abort" para abortar la fusión)');
    } else {
      o.out('\nTodos los conflictos están arreglados pero todavía estás fusionando.\n  (usa "git commit" para concluir la fusión)');
    }
  }
  if (s.staged.length) {
    o.out('\nCambios a ser confirmados:\n  (usa "git restore --staged <archivo>..." para sacarlos del área de preparación)');
    for (const c of s.staged) o.out(`\t${KIND_LABEL[c.kind].padEnd(15)}${c.path}`, 'ok');
  }
  if (s.unmerged.length) {
    o.out('\nRutas sin fusionar:\n  (usa "git add <archivo>..." para marcar cada conflicto como resuelto)');
    for (const p of s.unmerged) o.out(`\t${'ambos modificados:'.padEnd(19)}${p}`, 'err');
  }
  if (s.unstaged.length) {
    o.out('\nCambios no preparados para el commit:\n  (usa "git add <archivo>..." para actualizar lo que será confirmado)\n  (usa "git restore <archivo>..." para descartar los cambios en la carpeta de trabajo)');
    for (const c of s.unstaged) o.out(`\t${KIND_LABEL[c.kind].padEnd(15)}${c.path}`, 'err');
  }
  if (s.untracked.length) {
    o.out('\nArchivos sin seguimiento:\n  (usa "git add <archivo>..." para incluirlo en lo que será confirmado)');
    for (const p of s.untracked) o.out(`\t${p}`, 'err');
  }
  o.out('');
  if (!s.staged.length && !s.unmerged.length) {
    if (s.unstaged.length) o.out('no hay cambios agregados al commit (usa "git add" y/o "git commit -a")');
    else if (s.untracked.length)
      o.out('no hay nada agregado al commit pero hay archivos sin seguimiento (usa "git add" para empezar a seguirlos)');
    else if (s.unborn) o.out('nada para hacer commit (crea o copia archivos y usa "git add" para empezar a seguirlos)');
    else if (!r.merge) o.out('nada para hacer commit, el árbol de trabajo está limpio');
  }
  return true;
}

function cmdAdd(w: World, args: string[], o: Out) {
  const r = w.repo!;
  const pos = args.filter((a) => !a.startsWith('-') || a === '.');
  const flags = args.filter((a) => a.startsWith('-') && a !== '.');
  const onlyTracked = flags.includes('-u') || flags.includes('--update');
  const all = flags.includes('-A') || flags.includes('--all');
  const gi = w.files['.gitignore'];

  if (!pos.length && !all && !onlyTracked) {
    o.out('No indicaste qué agregar.');
    o.dim('Pista: usa "git add <archivo>" o "git add ." para agregar todo.');
    return true;
  }
  const targets = new Set<string>();
  if (all || onlyTracked || pos.includes('.')) {
    for (const p of Object.keys(w.files)) {
      if (r.index[p] === undefined && (onlyTracked || isIgnored(p, gi))) continue;
      targets.add(p);
    }
    for (const p of Object.keys(r.index)) targets.add(p);
  }
  for (const p of pos) {
    if (p === '.') continue;
    const hits = [...new Set([...Object.keys(w.files), ...Object.keys(r.index)])].filter(
      (f) => f === p || f.startsWith(p.replace(/\/$/, '') + '/'),
    );
    if (!hits.length) {
      o.err(`fatal: la ruta '${p}' no coincide con ningún archivo`);
      return false;
    }
    for (const h of hits) {
      if (isIgnored(h, gi) && r.index[h] === undefined) {
        o.err(`Las siguientes rutas se ignoran por una de tus reglas en .gitignore:\n${h}`);
        return false;
      }
      targets.add(h);
    }
  }
  for (const p of targets) {
    const content = w.files[p];
    if (content === undefined) delete r.index[p];
    else {
      r.index[p] = content;
      if (r.merge) {
        if (r.merge.conflicts.includes(p) && hasConflictMarkers(content)) {
          o.out(`Ojo: "${p}" todavía tiene marcas de conflicto (<<<<<<<, =======, >>>>>>>). Revisa el archivo antes de hacer commit.`, 'warn');
        }
        r.merge.conflicts = r.merge.conflicts.filter((c) => c !== p);
      }
    }
  }
  return true;
}

function commitStats(parentTree: Tree, tree: Tree, o: Out) {
  statLine(diffTrees(parentTree, tree), parentTree, tree, o);
}

function cmdCommit(w: World, args: string[], o: Out) {
  const r = w.repo!;
  let message: string | null = null;
  let all = false;
  let amend = false;
  let allowEmpty = false;
  const extra: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--message') message = args[++i] ?? null;
    else if (a.startsWith('--message=')) message = a.slice(10);
    else if (a === '--all') all = true;
    else if (a === '--amend') amend = true;
    else if (a === '--allow-empty') allowEmpty = true;
    else if (a === '--no-edit' || a === '--no-verify') continue;
    else if (/^-[a-zA-Z]+$/.test(a)) {
      for (const ch of a.slice(1)) {
        if (ch === 'a') all = true;
        if (ch === 'm') message = args[++i] ?? null;
      }
    } else extra.push(a);
  }
  if (extra.length) {
    o.err(`error: la ruta '${extra[0]}' no coincide con ningún archivo conocido por git`);
    o.dim('Pista: el mensaje va entre comillas → git commit -m "Mi mensaje"');
    return false;
  }
  if (r.merge?.conflicts.length) {
    o.err('error: No se puede hacer commit porque tienes archivos sin fusionar.');
    o.dim('Arregla los conflictos, usa "git add <archivo>" en cada uno y vuelve a intentarlo.');
    return false;
  }
  if (all) {
    for (const p of Object.keys(r.index)) {
      if (w.files[p] === undefined) delete r.index[p];
      else r.index[p] = w.files[p];
    }
  }
  const hid = headId(r);
  const parentTree = headTree(w);
  const merging = !!r.merge;
  const same = diffTrees(parentTree, r.index).length === 0;
  if (!merging && !amend && !allowEmpty && same) {
    const s = statusInfo(w);
    o.out(r.head.kind === 'branch' ? `En la rama ${r.head.name}` : `HEAD desacoplado en ${shortId(hid!)}`);
    if (s.unstaged.length) o.out('no hay cambios agregados al commit (usa "git add" y/o "git commit -a")');
    else if (s.untracked.length) o.out('no hay nada agregado al commit pero hay archivos sin seguimiento (usa "git add" para empezar a seguirlos)');
    else o.out('nada para hacer commit, el árbol de trabajo está limpio');
    return false;
  }
  if (!message) {
    if (merging) message = r.merge!.message;
    else if (amend && hid) message = w.commits[hid].message;
    else {
      o.err('Se canceló el commit porque no escribiste un mensaje.');
      o.dim('Pista: usa  git commit -m "Describe lo que cambiaste"');
      return false;
    }
  }
  const parents = amend && hid ? [...w.commits[hid].parents] : hid ? [hid] : [];
  if (merging) parents.push(r.merge!.theirs);
  const base = amend && hid ? treeAt(w, w.commits[hid].parents[0]) : parentTree;
  const c = makeCommit(w, message, parents, r.index);
  setHeadCommit(w, c.id);
  logHead(w, amend ? `commit (amend): ${message}` : merging ? `merge ${r.merge!.theirsName}: ${message}` : `commit: ${message}`);
  r.merge = null;
  const label = r.head.kind === 'branch' ? r.head.name : 'HEAD desacoplado';
  const root = parents.length === 0 ? ' (commit raíz)' : '';
  o.out(`[${label}${root} ${shortId(c.id)}] ${message}`);
  commitStats(base, c.tree, o);
  return true;
}

/* ------------------------------------------------------------------ */
/* log / show / diff                                                  */
/* ------------------------------------------------------------------ */

function cmdLog(w: World, args: string[], o: Out) {
  const r = w.repo!;
  let oneline = false;
  let graph = false;
  let all = false;
  let max = Infinity;
  const revs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--oneline') oneline = true;
    else if (a === '--graph') graph = true;
    else if (a === '--all') all = true;
    else if (a === '-n') max = Number(args[++i]);
    else if (/^-\d+$/.test(a)) max = Number(a.slice(1));
    else if (a.startsWith('--max-count=')) max = Number(a.slice(12));
    else if (a === '--') break;
    else if (!a.startsWith('-')) revs.push(a);
  }
  let tips: string[];
  if (all) tips = allTips(w);
  else if (revs.length) {
    tips = [];
    for (const spec of revs) {
      const id = resolveRev(w, spec);
      if (!id) {
        o.err(`fatal: argumento ambiguo '${spec}': revisión desconocida o ruta fuera del árbol de trabajo.`);
        return false;
      }
      tips.push(id);
    }
  } else {
    const h = headId(r);
    if (!h) {
      o.err(`fatal: tu rama actual '${currentBranch(r) ?? 'main'}' todavía no tiene commits`);
      return false;
    }
    tips = [h];
  }
  const commits = reachable(w, tips).slice(0, max);
  const prefix = graph ? '* ' : '';
  commits.forEach((c, idx) => {
    const deco = decorations(w, c.id);
    if (oneline) {
      o.out(`${prefix}${shortId(c.id)}${deco} ${c.message.split('\n')[0]}`);
      return;
    }
    o.out(`${prefix}commit ${c.id}${deco}`, 'head');
    if (c.parents.length > 1) o.out(`Merge: ${c.parents.map(shortId).join(' ')}`);
    o.out(`Autor:  ${c.author}`);
    o.out(`Fecha:  ${fmtDate(c.time)}`);
    o.out('');
    for (const l of c.message.split('\n')) o.out(`    ${l}`);
    if (idx < commits.length - 1) o.out('');
  });
  return true;
}

function cmdShow(w: World, args: string[], o: Out) {
  const spec = args.find((a) => !a.startsWith('-')) ?? 'HEAD';
  if (spec.includes(':')) {
    const [rev, path] = spec.split(':');
    const id = resolveRev(w, rev || 'HEAD');
    if (!id) {
      o.err(`fatal: revisión desconocida: '${rev}'`);
      return false;
    }
    const content = w.commits[id].tree[path];
    if (content === undefined) {
      o.err(`fatal: la ruta '${path}' no existe en '${rev}'`);
      return false;
    }
    o.out(content.replace(/\n$/, ''));
    return true;
  }
  const id = resolveRev(w, spec);
  if (!id) {
    o.err(`fatal: argumento ambiguo '${spec}': revisión desconocida o ruta fuera del árbol de trabajo.`);
    return false;
  }
  const c = w.commits[id];
  o.out(`commit ${c.id}${decorations(w, id)}`, 'head');
  o.out(`Autor:  ${c.author}`);
  o.out(`Fecha:  ${fmtDate(c.time)}`);
  o.out('');
  for (const l of c.message.split('\n')) o.out(`    ${l}`);
  o.out('');
  renderDiff(treeAt(w, c.parents[0]), c.tree, o);
  return true;
}

function cmdDiff(w: World, args: string[], o: Out) {
  const r = w.repo!;
  const staged = args.includes('--staged') || args.includes('--cached');
  const dash = args.indexOf('--');
  const paths = dash >= 0 ? args.slice(dash + 1) : [];
  const items = (dash >= 0 ? args.slice(0, dash) : args).filter((a) => !a.startsWith('-'));
  const revs: string[] = [];
  for (const it of items) {
    const id = resolveRev(w, it);
    if (id) revs.push(id);
    else paths.push(it);
  }
  let from: Tree;
  let to: Tree;
  const tracked = (t: Tree) => Object.fromEntries(Object.entries(t).filter(([p]) => r.index[p] !== undefined));
  if (revs.length >= 2) {
    from = treeAt(w, revs[0]);
    to = treeAt(w, revs[1]);
  } else if (revs.length === 1) {
    from = treeAt(w, revs[0]);
    to = tracked(w.files);
  } else if (staged) {
    from = headTree(w);
    to = r.index;
  } else {
    from = r.index;
    to = tracked(w.files);
  }
  const n = renderDiff(from, to, o, paths.length ? paths : undefined);
  if (!n) o.dim('(sin diferencias)');
  return true;
}

/* ------------------------------------------------------------------ */
/* branch / switch / checkout                                          */
/* ------------------------------------------------------------------ */

const validBranchName = (n: string) => /^[^\s~^:?*[\\]+$/.test(n) && !n.startsWith('-') && !n.endsWith('/');

function cmdBranch(w: World, args: string[], o: Out) {
  const r = w.repo!;
  const flags = args.filter((a) => a.startsWith('-'));
  const pos = args.filter((a) => !a.startsWith('-'));
  const del = flags.includes('-d') || flags.includes('--delete');
  const forceDel = flags.includes('-D');
  const rename = flags.includes('-m') || flags.includes('-M');

  if (del || forceDel) {
    if (!pos.length) {
      o.err('fatal: se necesita el nombre de la rama a borrar');
      return false;
    }
    for (const name of pos) {
      const id = r.branches[name];
      if (!id) {
        o.err(`error: rama '${name}' no encontrada.`);
        return false;
      }
      if (r.head.kind === 'branch' && r.head.name === name) {
        o.err(`error: No se puede borrar la rama '${name}' mientras estás en ella.`);
        o.dim('Pista: cambia primero a otra rama (por ejemplo "git switch main").');
        return false;
      }
      const h = headId(r);
      if (!forceDel && h && !isAncestor(w, id, h)) {
        o.err(`error: la rama '${name}' no está completamente fusionada.`);
        o.dim(`Si estás seguro de querer borrarla, ejecuta: git branch -D ${name}`);
        return false;
      }
      delete r.branches[name];
      delete r.upstream[name];
      o.out(`Eliminada la rama ${name} (era ${shortId(id)}).`);
    }
    return true;
  }
  if (rename) {
    const cur = currentBranch(r);
    const [a, b] = pos.length === 2 ? pos : [cur, pos[0]];
    if (!a || !b) {
      o.err('fatal: indica el nuevo nombre de la rama');
      return false;
    }
    if (!validBranchName(b)) {
      o.err(`fatal: '${b}' no es un nombre de rama válido`);
      return false;
    }
    if (r.branches[a]) {
      r.branches[b] = r.branches[a];
      delete r.branches[a];
      if (r.upstream[a]) {
        r.upstream[b] = r.upstream[a];
        delete r.upstream[a];
      }
    }
    if (r.head.kind === 'branch' && r.head.name === a) r.head = { kind: 'branch', name: b };
    return true;
  }
  if (pos.length) {
    const name = pos[0];
    if (!validBranchName(name)) {
      o.err(`fatal: '${name}' no es un nombre de rama válido`);
      o.dim('Pista: usa letras, números y guiones, sin espacios. Ejemplo: mi-idea');
      return false;
    }
    if (r.branches[name]) {
      o.err(`fatal: ya existe una rama llamada '${name}'`);
      return false;
    }
    const startId = pos[1] ? resolveRev(w, pos[1]) : headId(r);
    if (!startId) {
      o.err(`fatal: nombre de objeto no válido: '${pos[1] ?? currentBranch(r) ?? 'HEAD'}'`);
      if (!pos[1]) o.dim('Pista: haz tu primer commit antes de crear ramas.');
      return false;
    }
    r.branches[name] = startId;
    return true;
  }
  // listar
  const showAll = flags.includes('-a') || flags.includes('--all');
  const verbose = flags.includes('-v') || flags.includes('-vv');
  const names = Object.keys(r.branches).sort();
  const cur = currentBranch(r);
  if (!names.length && cur) o.out(`* ${cur}`, 'ok');
  for (const n of names) {
    const extra = verbose ? ` ${describeCommit(w, r.branches[n])}` : '';
    o.out(`${n === cur ? '* ' : '  '}${n}${extra}`, n === cur ? 'ok' : undefined);
  }
  if (r.head.kind === 'detached') o.out(`* (HEAD desacoplado en ${shortId(r.head.id)})`, 'ok');
  if (showAll || flags.includes('-r')) {
    for (const n of Object.keys(r.tracking).sort()) o.out(`  remotes/${n}`, 'err');
  }
  return true;
}

/** Cambia los archivos y el área de preparación al estado de `target`. Devuelve rutas bloqueadas. */
function checkoutTree(w: World, target: Tree): { blocked: string[]; untracked: string[] } {
  const r = w.repo!;
  const H = headTree(w);
  const paths = new Set([...Object.keys(H), ...Object.keys(target)]);
  const plan = new Map<string, string | undefined>();
  const blocked: string[] = [];
  const untracked: string[] = [];
  for (const p of paths) {
    const h = H[p];
    const t = target[p];
    if (h === t) continue;
    const wd = w.files[p];
    const ix = r.index[p];
    if (wd === h && ix === h) plan.set(p, t);
    else if (h === undefined && ix === undefined && wd !== undefined) {
      if (wd !== t) untracked.push(p);
    } else blocked.push(p);
  }
  if (blocked.length || untracked.length) return { blocked, untracked };
  for (const [p, t] of plan) {
    if (t === undefined) {
      delete w.files[p];
      delete r.index[p];
    } else {
      w.files[p] = t;
      r.index[p] = t;
    }
  }
  return { blocked, untracked };
}

function reportBlocked(o: Out, blocked: string[], untracked: string[], action: string) {
  if (blocked.length) {
    o.err(`error: Tus cambios locales a los siguientes archivos serían sobrescritos al ${action}:`);
    for (const p of blocked) o.err(`\t${p}`);
    o.err('Haz commit de tus cambios o guárdalos con "git stash" antes de continuar.');
  }
  if (untracked.length) {
    o.err(`error: Los siguientes archivos sin seguimiento serían sobrescritos al ${action}:`);
    for (const p of untracked) o.err(`\t${p}`);
    o.err('Muévelos o bórralos antes de continuar.');
  }
}

function detachedNote(o: Out, id: string) {
  o.out(`Nota: cambiando a '${shortId(id)}'.`);
  o.out('');
  o.out("Estás en estado 'HEAD desacoplado': puedes mirar alrededor, pero lo que hagas aquí no\npertenece a ninguna rama. Para conservarlo, crea una rama:\n");
  o.out('  git switch -c <nombre-de-la-rama>');
  o.out('');
}

function switchTo(w: World, args: string[], o: Out, viaCheckout = false) {
  const r = w.repo!;
  if (r.merge) {
    o.err('error: Estás en medio de una fusión. Termínala con "git commit" o cancélala con "git merge --abort".');
    return false;
  }
  const create = args.includes('-c') || args.includes('-b') || args.includes('--create') || args.includes('-C') || args.includes('-B');
  const detach = args.includes('--detach') || args.includes('-d');
  const pos = args.filter((a) => !a.startsWith('-'));
  const name = pos[0];
  if (!name) {
    o.err('fatal: ¿a qué rama quieres cambiar? Ejemplo: git switch main');
    return false;
  }
  const curName = currentBranch(r);
  const from = curName ?? shortId(headId(r)!);

  // git checkout -- archivo  /  git checkout <rev> -- archivo  (restaurar archivos)
  if (viaCheckout && !create && !detach) {
    const dash = args.indexOf('--');
    if (dash >= 0) {
      const rev = dash > 0 ? args[0] : null;
      const files = args.slice(dash + 1);
      return restoreFiles(w, files, rev ? { source: rev, staged: true, worktree: true } : {}, o);
    }
    const isFile = Object.keys(r.index).includes(name) || Object.keys(w.files).includes(name);
    const isRef = r.branches[name] || resolveRev(w, name) || Object.keys(r.tracking).some((k) => k.endsWith(`/${name}`));
    if (isFile && !isRef) return restoreFiles(w, pos, {}, o);
  }

  if (create) {
    if (!validBranchName(name)) {
      o.err(`fatal: '${name}' no es un nombre de rama válido`);
      return false;
    }
    if (r.branches[name]) {
      o.err(`fatal: ya existe una rama llamada '${name}'`);
      return false;
    }
    const start = pos[1] ? resolveRev(w, pos[1]) : headId(r);
    if (!start) {
      if (!pos[1] && !headId(r)) {
        r.head = { kind: 'branch', name };
        o.out(`Cambiado a nueva rama '${name}'`);
        return true;
      }
      o.err(`fatal: nombre de objeto no válido: '${pos[1]}'`);
      return false;
    }
    if (start !== headId(r)) {
      const res = checkoutTree(w, treeAt(w, start));
      if (res.blocked.length || res.untracked.length) {
        reportBlocked(o, res.blocked, res.untracked, 'cambiar de rama');
        return false;
      }
    }
    r.branches[name] = start;
    r.head = { kind: 'branch', name };
    logHead(w, `checkout: moviendo de ${from} a ${name}`);
    o.out(`Cambiado a nueva rama '${name}'`);
    return true;
  }

  // ¿rama local?
  if (r.branches[name] && !detach) {
    if (curName === name) {
      o.out(`Ya estás en '${name}'`);
      return true;
    }
    const res = checkoutTree(w, treeAt(w, r.branches[name]));
    if (res.blocked.length || res.untracked.length) {
      reportBlocked(o, res.blocked, res.untracked, 'cambiar de rama');
      return false;
    }
    r.head = { kind: 'branch', name };
    logHead(w, `checkout: moviendo de ${from} a ${name}`);
    o.out(`Cambiado a rama '${name}'`);
    return true;
  }
  // rama remota con ese nombre → crear rama local que la sigue
  const remoteRef = Object.keys(r.tracking).find((k) => k.endsWith(`/${name}`) && k.split('/').length === 2);
  if (remoteRef && !detach && !r.branches[name]) {
    const id = r.tracking[remoteRef];
    const res = checkoutTree(w, treeAt(w, id));
    if (res.blocked.length || res.untracked.length) {
      reportBlocked(o, res.blocked, res.untracked, 'cambiar de rama');
      return false;
    }
    r.branches[name] = id;
    r.upstream[name] = remoteRef;
    r.head = { kind: 'branch', name };
    logHead(w, `checkout: moviendo de ${from} a ${name}`);
    o.out(`La rama '${name}' está configurada para seguir la rama remota '${name}' de '${remoteRef.split('/')[0]}'.`);
    o.out(`Cambiado a nueva rama '${name}'`);
    return true;
  }
  // commit / etiqueta → HEAD desacoplado
  const id = resolveRev(w, name);
  if (!id) {
    o.err(`fatal: no existe '${name}' (ni rama, ni commit, ni etiqueta).`);
    const names = Object.keys(r.branches);
    if (names.length) o.dim(`Ramas que existen: ${names.join(', ')}`);
    return false;
  }
  if (!viaCheckout && !detach && !r.tags[name] && !r.tracking[name]) {
    // switch no acepta commits sueltos sin --detach
    o.err(`fatal: no se puede cambiar a '${name}': no es una rama.`);
    o.dim(`Pista: para mirar ese momento sin cambiar tu rama usa: git switch --detach ${name}`);
    return false;
  }
  const res = checkoutTree(w, treeAt(w, id));
  if (res.blocked.length || res.untracked.length) {
    reportBlocked(o, res.blocked, res.untracked, 'cambiar de versión');
    return false;
  }
  r.head = { kind: 'detached', id };
  logHead(w, `checkout: moviendo de ${from} a ${shortId(id)}`);
  detachedNote(o, id);
  o.out(`HEAD está ahora en ${describeCommit(w, id)}`);
  return true;
}

/* ------------------------------------------------------------------ */
/* restore / reset / revert / rm / mv                                  */
/* ------------------------------------------------------------------ */

function restoreFiles(
  w: World,
  files: string[],
  opts: { staged?: boolean; worktree?: boolean; source?: string },
  o: Out,
) {
  const r = w.repo!;
  if (!files.length) {
    o.err('fatal: debes indicar qué archivos restaurar. Ejemplo: git restore archivo.txt');
    return false;
  }
  let srcTree: Tree | null = null;
  if (opts.source) {
    const id = resolveRev(w, opts.source);
    if (!id) {
      o.err(`fatal: no se pudo resolver '${opts.source}' como un commit válido`);
      return false;
    }
    srcTree = treeAt(w, id);
  }
  const head = headTree(w);
  // Sin --source ni --staged, solo se pueden restaurar archivos que Git ya conoce.
  const known = srcTree
    ? new Set([...Object.keys(srcTree), ...Object.keys(r.index), ...Object.keys(w.files)])
    : new Set([...Object.keys(r.index), ...Object.keys(head)]);
  const targets = new Set<string>();
  for (const f of files) {
    if (f === '.') {
      known.forEach((p) => targets.add(p));
      continue;
    }
    const hits = [...known].filter((p) => p === f || p.startsWith(f.replace(/\/$/, '') + '/'));
    if (!hits.length) {
      o.err(`error: la ruta '${f}' no coincide con ningún archivo conocido por git`);
      return false;
    }
    hits.forEach((h) => targets.add(h));
  }
  const both = opts.staged && opts.worktree;
  for (const p of targets) {
    if (opts.staged) {
      const from = srcTree ? srcTree[p] : head[p];
      if (from === undefined) delete r.index[p];
      else r.index[p] = from;
    }
    if (!opts.staged || both) {
      const from = srcTree ? srcTree[p] : both ? head[p] : r.index[p];
      if (from === undefined) delete w.files[p];
      else w.files[p] = from;
    }
  }
  return true;
}

function cmdRestore(w: World, args: string[], o: Out) {
  let source: string | undefined;
  const files: string[] = [];
  let staged = false;
  let worktree = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--staged' || a === '-S') staged = true;
    else if (a === '--worktree' || a === '-W') worktree = true;
    else if (a.startsWith('--source=')) source = a.slice(9);
    else if (a === '--source' || a === '-s') source = args[++i];
    else if (a === '--') continue;
    else if (!a.startsWith('-') || a === '.') files.push(a);
  }
  return restoreFiles(w, files, { staged, worktree, source }, o);
}

function cmdReset(w: World, args: string[], o: Out) {
  const r = w.repo!;
  const mode = args.includes('--hard') ? 'hard' : args.includes('--soft') ? 'soft' : 'mixed';
  const pos = args.filter((a) => !a.startsWith('-'));
  const dash = args.indexOf('--');
  let rev: string | null = null;
  let files: string[] = [];
  if (dash >= 0) {
    files = args.slice(dash + 1);
    rev = args.slice(0, dash).find((a) => !a.startsWith('-')) ?? null;
  } else if (pos.length) {
    const first = pos[0];
    const asRev = resolveRev(w, first);
    const isFile = [...Object.keys(r.index), ...Object.keys(w.files), ...Object.keys(headTree(w))].includes(first);
    if (asRev && !isFile) {
      rev = first;
      files = pos.slice(1);
    } else files = pos;
  }
  if (files.length) {
    const base = rev ? treeAt(w, resolveRev(w, rev)) : headTree(w);
    for (const f of files) {
      if (base[f] === undefined) delete r.index[f];
      else r.index[f] = base[f];
    }
    o.out('Cambios fuera del área de preparación tras el reset:');
    for (const f of files) if (w.files[f] !== r.index[f]) o.out(`M\t${f}`);
    return true;
  }
  const target = rev ?? 'HEAD';
  const id = resolveRev(w, target);
  if (!id) {
    o.err(`fatal: argumento ambiguo '${target}': revisión desconocida o ruta fuera del árbol de trabajo.`);
    return false;
  }
  const tracked = new Set([...Object.keys(headTree(w)), ...Object.keys(r.index)]);
  const newTree = treeAt(w, id);
  setHeadCommit(w, id);
  r.merge = null;
  if (mode !== 'soft') r.index = { ...newTree };
  if (mode === 'hard') {
    for (const p of tracked) delete w.files[p];
    for (const [p, c] of Object.entries(newTree)) w.files[p] = c;
    o.out(`HEAD está ahora en ${describeCommit(w, id)}`);
  } else if (mode === 'mixed') {
    const left = Object.keys(newTree)
      .sort()
      .filter((p) => w.files[p] !== newTree[p]);
    if (left.length) {
      o.out('Cambios fuera del área de preparación tras el reset:');
      for (const p of left) o.out(`${w.files[p] === undefined ? 'D' : 'M'}\t${p}`);
    }
  }
  logHead(w, `reset: moviendo a ${target}`);
  return true;
}

function ensureCleanFor(w: World, paths: string[], ours: Tree, o: Out, action: string) {
  const r = w.repo!;
  const bad = paths.filter((p) => {
    const wd = w.files[p];
    const ix = r.index[p];
    if (ours[p] === undefined && ix === undefined && wd !== undefined) return true;
    return wd !== ours[p] || ix !== ours[p];
  });
  if (bad.length) {
    o.err(`error: Tus cambios locales a los siguientes archivos serían sobrescritos al ${action}:`);
    for (const p of bad) o.err(`\t${p}`);
    o.err('Haz commit de tus cambios o guárdalos con "git stash" antes de continuar.');
    return false;
  }
  return true;
}

function cmdRevert(w: World, args: string[], o: Out) {
  const r = w.repo!;
  const spec = args.find((a) => !a.startsWith('-'));
  if (!spec) {
    o.err('fatal: indica qué commit quieres revertir. Ejemplo: git revert HEAD');
    return false;
  }
  const id = resolveRev(w, spec);
  if (!id) {
    o.err(`fatal: argumento ambiguo '${spec}': revisión desconocida.`);
    return false;
  }
  const hid = headId(r);
  if (!hid) {
    o.err('fatal: no hay commits todavía');
    return false;
  }
  if (diffTrees(headTree(w), r.index).length) {
    o.err('error: tienes cambios en el área de preparación. Haz commit o descártalos antes de revertir.');
    return false;
  }
  const c = w.commits[id];
  const parentTree = treeAt(w, c.parents[0]);
  const ours = headTree(w);
  const result: Tree = { ...ours };
  const changed: string[] = [];
  const paths = new Set([...Object.keys(c.tree), ...Object.keys(parentTree), ...Object.keys(ours)]);
  for (const p of paths) {
    const base = c.tree[p];
    const theirs = parentTree[p];
    const cur = ours[p];
    if (base === theirs) continue;
    if (cur === base) {
      if (theirs === undefined) delete result[p];
      else result[p] = theirs;
      changed.push(p);
    } else if (cur === theirs) continue;
    else {
      const m = merge3(base ?? '', cur ?? '', theirs ?? '', 'HEAD', `parent of ${shortId(id)}`);
      if (m.conflict || cur === undefined || theirs === undefined) {
        o.err(`error: no se pudo revertir ${shortId(id)}... ${c.message}`);
        o.err(`Hay conflicto en '${p}': esa parte del archivo cambió después de ese commit.`);
        o.dim('Tip: el commit se quedó como estaba. Edita el archivo a mano y haz un commit normal.');
        return false;
      }
      result[p] = m.text;
      changed.push(p);
    }
  }
  if (!ensureCleanFor(w, changed, ours, o, 'revertir')) return false;
  for (const p of changed) {
    if (result[p] === undefined) {
      delete w.files[p];
      delete r.index[p];
    } else {
      w.files[p] = result[p];
      r.index[p] = result[p];
    }
  }
  const msg = `Revert "${c.message.split('\n')[0]}"`;
  const nc = makeCommit(w, `${msg}\n\nEsto revierte el commit ${c.id}.`, [hid], result);
  setHeadCommit(w, nc.id);
  logHead(w, `revert: ${msg}`);
  o.out(`[${currentBranch(r) ?? 'HEAD desacoplado'} ${shortId(nc.id)}] ${msg}`);
  commitStats(ours, result, o);
  return true;
}

function cmdRm(w: World, args: string[], o: Out) {
  const r = w.repo!;
  const cached = args.includes('--cached');
  const pos = args.filter((a) => !a.startsWith('-'));
  if (!pos.length) {
    o.err('fatal: indica qué archivo quieres quitar');
    return false;
  }
  for (const p of pos) {
    if (r.index[p] === undefined) {
      o.err(`fatal: la ruta '${p}' no coincide con ningún archivo`);
      return false;
    }
  }
  for (const p of pos) {
    delete r.index[p];
    if (!cached) delete w.files[p];
    o.out(`rm '${p}'`);
  }
  return true;
}

function cmdMv(w: World, args: string[], o: Out) {
  const r = w.repo!;
  const pos = args.filter((a) => !a.startsWith('-'));
  const [a, b] = pos;
  if (!a || !b) {
    o.err('uso: git mv <origen> <destino>');
    return false;
  }
  if (w.files[a] === undefined) {
    o.err(`fatal: no se puede mover: '${a}' no existe`);
    return false;
  }
  w.files[b] = w.files[a];
  delete w.files[a];
  if (r.index[a] !== undefined) {
    r.index[b] = w.files[b];
    delete r.index[a];
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* merge / pull                                                        */
/* ------------------------------------------------------------------ */

interface MergeOpts {
  noFF?: boolean;
  message?: string | null;
  label: string;
}

function mergeInto(w: World, targetId: string, targetName: string, o: Out, opts: MergeOpts) {
  const r = w.repo!;
  const ours = headId(r);
  if (r.merge) {
    o.err('error: Todavía estás en medio de una fusión. Termínala con "git commit" o cancélala con "git merge --abort".');
    return false;
  }
  if (!ours) {
    // rama sin commits: simplemente avanza
    r.branches[currentBranch(r) ?? 'main'] = targetId;
    r.index = { ...treeAt(w, targetId) };
    w.files = { ...w.files, ...treeAt(w, targetId) };
    logHead(w, `merge ${targetName}: Fast-forward`);
    o.out('Fast-forward');
    return true;
  }
  if (targetId === ours || isAncestor(w, targetId, ours)) {
    o.out('Ya está actualizado.');
    return true;
  }
  if (diffTrees(headTree(w), r.index).length) {
    o.err('error: Tienes cambios en el área de preparación. Haz commit (o "git stash") antes de fusionar.');
    return false;
  }
  const oursTree = headTree(w);
  const theirsTree = treeAt(w, targetId);

  // avance rápido
  if (isAncestor(w, ours, targetId) && !opts.noFF) {
    const changes = diffTrees(oursTree, theirsTree);
    if (!ensureCleanFor(w, changes.map((c) => c.path), oursTree, o, 'fusionar')) return false;
    for (const c of changes) {
      if (c.kind === 'deleted') {
        delete w.files[c.path];
        delete r.index[c.path];
      } else {
        w.files[c.path] = theirsTree[c.path];
        r.index[c.path] = theirsTree[c.path];
      }
    }
    o.out(`Actualizando ${shortId(ours)}..${shortId(targetId)}`);
    o.out('Fast-forward');
    setHeadCommit(w, targetId);
    logHead(w, `merge ${targetName}: Fast-forward`);
    statLine(changes, oursTree, theirsTree, o, true);
    return true;
  }

  // fusión real de tres vías
  const baseId = mergeBase(w, ours, targetId);
  const baseTree = treeAt(w, baseId);
  const oursLabel = currentBranch(r) ?? 'HEAD';
  const merged: Tree = { ...oursTree };
  const conflicts: string[] = [];
  const touched: string[] = [];
  const conflictText: Record<string, string> = {};
  const paths = new Set([...Object.keys(baseTree), ...Object.keys(oursTree), ...Object.keys(theirsTree)]);
  for (const p of [...paths].sort()) {
    const b = baseTree[p];
    const a = oursTree[p];
    const t = theirsTree[p];
    if (a === t) continue;
    if (b === a) {
      if (t === undefined) delete merged[p];
      else merged[p] = t;
      touched.push(p);
    } else if (b === t) continue;
    else if (a === undefined || t === undefined) {
      conflicts.push(p);
      touched.push(p);
      conflictText[p] = a ?? t ?? '';
      o.out(`CONFLICTO (modificar/borrar): ${p} fue modificado en una rama y borrado en la otra.`, 'err');
    } else {
      const m = merge3(b ?? '', a, t, oursLabel, targetName);
      touched.push(p);
      if (m.conflict) {
        conflicts.push(p);
        conflictText[p] = m.text;
        o.out(`Auto-fusionando ${p}`);
        o.out(`CONFLICTO (contenido): Conflicto de fusión en ${p}`, 'err');
      } else {
        merged[p] = m.text;
        o.out(`Auto-fusionando ${p}`);
      }
    }
  }
  if (!ensureCleanFor(w, touched, oursTree, o, 'fusionar')) return false;

  for (const p of touched) {
    if (conflicts.includes(p)) w.files[p] = conflictText[p];
    else if (merged[p] === undefined) {
      delete w.files[p];
      delete r.index[p];
    } else {
      w.files[p] = merged[p];
      r.index[p] = merged[p];
    }
  }
  const defaultMsg = opts.message ?? opts.label;
  if (conflicts.length) {
    r.merge = { theirs: targetId, theirsName: targetName, message: defaultMsg, conflicts };
    o.out('La fusión automática falló; arregla los conflictos y luego haz commit con el resultado.', 'err');
    o.keep = true;
    return false;
  }
  const nc = makeCommit(w, defaultMsg, [ours, targetId], merged);
  setHeadCommit(w, nc.id);
  logHead(w, `merge ${targetName}: Merge made by the 'ort' strategy.`);
  o.out("Fusión hecha con la estrategia 'ort'.");
  statLine(diffTrees(oursTree, merged), oursTree, merged, o, true);
  return true;
}

function cmdMerge(w: World, args: string[], o: Out) {
  const r = w.repo!;
  if (args.includes('--abort')) {
    if (!r.merge) {
      o.err('fatal: No hay ninguna fusión en curso.');
      return false;
    }
    const t = headTree(w);
    const touched = new Set([...Object.keys(r.index), ...Object.keys(t)]);
    r.merge = null;
    r.index = { ...t };
    for (const p of touched) delete w.files[p];
    for (const [p, c] of Object.entries(t)) w.files[p] = c;
    o.out('Fusión cancelada. Todo volvió a como estaba antes de fusionar.');
    return true;
  }
  let message: string | null = null;
  const noFF = args.includes('--no-ff');
  const pos: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-m') message = args[++i] ?? null;
    else if (!args[i].startsWith('-')) pos.push(args[i]);
  }
  const name = pos[0];
  if (!name) {
    o.err('fatal: ¿qué rama quieres fusionar? Ejemplo: git merge mi-idea');
    return false;
  }
  const id = resolveRev(w, name);
  if (!id) {
    o.err(`fatal: ${name} - no es algo que podamos fusionar`);
    const names = Object.keys(r.branches).filter((b) => b !== currentBranch(r));
    if (names.length) o.dim(`Ramas que puedes fusionar: ${names.join(', ')}`);
    return false;
  }
  const into = currentBranch(r);
  const label = into && into !== 'main' ? `Merge branch '${name}' into ${into}` : `Merge branch '${name}'`;
  return mergeInto(w, id, name, o, { noFF, message, label });
}

/* ------------------------------------------------------------------ */
/* stash / tag                                                         */
/* ------------------------------------------------------------------ */

function cmdStash(w: World, args: string[], o: Out) {
  const r = w.repo!;
  const sub = args[0] && !args[0].startsWith('-') ? args[0] : 'push';
  const rest = sub === 'push' && args[0] === 'push' ? args.slice(1) : args;

  if (sub === 'list') {
    r.stash.forEach((s, i) => o.out(`stash@{${i}}: WIP en ${s.branch}: ${s.message}`));
    if (!r.stash.length) o.dim('(no hay nada guardado en el stash)');
    return true;
  }
  if (sub === 'drop' || sub === 'clear') {
    if (sub === 'clear') r.stash = [];
    else {
      if (!r.stash.length) {
        o.err('error: no hay entradas en el stash');
        return false;
      }
      r.stash.shift();
    }
    o.out('Entrada del stash eliminada.');
    return true;
  }
  if (sub === 'pop' || sub === 'apply') {
    const s = r.stash[0];
    if (!s) {
      o.err('error: No hay stash para aplicar.');
      return false;
    }
    const head = headTree(w);
    const base = treeAt(w, s.base);
    const paths = new Set([...Object.keys(base), ...Object.keys(s.work)]);
    const blocked: string[] = [];
    for (const p of paths) {
      if (base[p] === s.work[p]) continue;
      const wd = w.files[p];
      if (wd !== head[p] && wd !== s.work[p]) blocked.push(p);
    }
    if (blocked.length) {
      o.err('error: Tienes cambios locales que chocarían con el stash:');
      for (const p of blocked) o.err(`\t${p}`);
      o.err('Haz commit o guarda tus cambios actuales antes de recuperar el stash.');
      return false;
    }
    for (const p of paths) {
      if (base[p] === s.work[p]) continue;
      if (s.work[p] === undefined) delete w.files[p];
      else {
        w.files[p] = s.work[p];
        if (base[p] === undefined && s.index[p] !== undefined) r.index[p] = s.work[p];
      }
    }
    if (sub === 'pop') {
      r.stash.shift();
      o.out('Cambios recuperados. Entrada del stash eliminada.');
    } else o.out('Cambios recuperados.');
    return true;
  }
  // push
  let message = '';
  let includeUntracked = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '-m' || rest[i] === '--message') message = rest[++i] ?? '';
    else if (rest[i] === '-u' || rest[i] === '--include-untracked') includeUntracked = true;
  }
  const s = statusInfo(w);
  const hasTracked = s.staged.length || s.unstaged.length;
  if (!hasTracked && !(includeUntracked && s.untracked.length)) {
    o.out('No hay cambios locales para guardar.');
    return false;
  }
  const hid = headId(r);
  const work: Tree = {};
  for (const p of new Set([...Object.keys(r.index), ...Object.keys(headTree(w))])) {
    if (w.files[p] !== undefined) work[p] = w.files[p];
  }
  if (includeUntracked) for (const p of s.untracked) work[p] = w.files[p];
  const branch = currentBranch(r) ?? 'HEAD';
  const msg = message || (hid ? describeCommit(w, hid) : 'cambios sin guardar');
  r.stash.unshift({ message: msg, base: hid, branch, work, index: { ...r.index } });
  const head = headTree(w);
  for (const p of Object.keys(work)) {
    if (head[p] === undefined) delete w.files[p];
    else w.files[p] = head[p];
  }
  for (const p of Object.keys(head)) if (w.files[p] === undefined) w.files[p] = head[p];
  r.index = { ...head };
  o.out(`Directorio de trabajo y estado del índice guardados: WIP en ${branch}: ${msg}`);
  return true;
}

function cmdTag(w: World, args: string[], o: Out) {
  const r = w.repo!;
  const del = args.includes('-d') || args.includes('--delete');
  const pos: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-m') i++;
    else if (!args[i].startsWith('-')) pos.push(args[i]);
  }
  if (del) {
    for (const t of pos) {
      if (!r.tags[t]) {
        o.err(`error: etiqueta '${t}' no encontrada.`);
        return false;
      }
      o.out(`Etiqueta '${t}' eliminada (era ${shortId(r.tags[t])})`);
      delete r.tags[t];
    }
    return true;
  }
  if (!pos.length) {
    for (const t of Object.keys(r.tags).sort()) o.out(t);
    return true;
  }
  const name = pos[0];
  if (r.tags[name]) {
    o.err(`fatal: la etiqueta '${name}' ya existe`);
    return false;
  }
  const id = pos[1] ? resolveRev(w, pos[1]) : headId(r);
  if (!id) {
    o.err('fatal: no hay ningún commit al que ponerle etiqueta todavía');
    return false;
  }
  r.tags[name] = id;
  return true;
}

function cmdReflog(w: World, _args: string[], o: Out) {
  const r = w.repo!;
  if (!r.reflog.length) {
    o.dim('(todavía no hay movimientos registrados)');
    return true;
  }
  r.reflog
    .slice()
    .reverse()
    .forEach((e, i) => {
      o.out(`${e.id ? shortId(e.id) : '0000000'} HEAD@{${i}}: ${e.msg}`);
    });
  return true;
}

/* ------------------------------------------------------------------ */
/* remote / fetch / pull / push                                        */
/* ------------------------------------------------------------------ */

function cmdRemote(w: World, args: string[], o: Out) {
  const r = w.repo!;
  const [sub, a, b] = args.filter((x) => x !== '-v');
  if (!sub) {
    if (args.includes('-v')) {
      for (const [n, u] of Object.entries(r.remotes)) {
        o.out(`${n}\t${u} (fetch)`);
        o.out(`${n}\t${u} (push)`);
      }
    } else for (const n of Object.keys(r.remotes)) o.out(n);
    return true;
  }
  if (sub === 'add') {
    if (!a || !b) {
      o.err('uso: git remote add <nombre> <url>');
      return false;
    }
    if (r.remotes[a]) {
      o.err(`error: el remoto '${a}' ya existe.`);
      return false;
    }
    r.remotes[a] = b;
    return true;
  }
  if (sub === 'remove' || sub === 'rm') {
    if (!a || !r.remotes[a]) {
      o.err(`error: No existe el remoto '${a ?? ''}'.`);
      return false;
    }
    delete r.remotes[a];
    for (const k of Object.keys(r.tracking)) if (k.startsWith(`${a}/`)) delete r.tracking[k];
    return true;
  }
  o.err(`error: subcomando de remote desconocido: ${sub}`);
  return false;
}

function doFetch(w: World, remote: string, o: Out): boolean {
  const r = w.repo!;
  const url = r.remotes[remote];
  if (!url) {
    o.err(`fatal: '${remote}' no parece ser un repositorio git`);
    o.err('fatal: No se pudo leer desde el repositorio remoto.');
    o.dim('Pista: agrega uno con  git remote add origin <url>');
    return false;
  }
  const server = w.servers[url];
  if (!server) {
    o.err(`fatal: repositorio '${url}' no encontrado`);
    o.dim('Revisa que la dirección esté bien escrita y que el repositorio exista en GitHub.');
    return false;
  }
  const lines: string[] = [];
  for (const [b, id] of Object.entries(server.branches)) {
    const key = `${remote}/${b}`;
    const old = r.tracking[key];
    if (old === id) continue;
    if (!old) lines.push(` * [nueva rama]      ${b.padEnd(10)} -> ${key}`);
    else lines.push(`   ${shortId(old)}..${shortId(id)}  ${b.padEnd(10)} -> ${key}`);
    r.tracking[key] = id;
  }
  for (const [t, id] of Object.entries(server.tags)) {
    if (r.tags[t] === id) continue;
    r.tags[t] = id;
    lines.push(` * [nueva etiqueta]  ${t.padEnd(10)} -> ${t}`);
  }
  if (lines.length) {
    o.out(`Desde ${url}`);
    for (const l of lines) o.out(l);
  }
  return true;
}

function cmdFetch(w: World, args: string[], o: Out) {
  const r = w.repo!;
  const pos = args.filter((a) => !a.startsWith('-'));
  const remote = pos[0] ?? (currentBranch(r) && r.upstream[currentBranch(r)!]?.split('/')[0]) ?? 'origin';
  return doFetch(w, remote, o);
}

function cmdPull(w: World, args: string[], o: Out) {
  const r = w.repo!;
  const pos = args.filter((a) => !a.startsWith('-'));
  const cur = currentBranch(r);
  if (!cur) {
    o.err('fatal: no estás en ninguna rama. Cambia a una rama antes de hacer pull.');
    return false;
  }
  const up = r.upstream[cur];
  const remote = pos[0] ?? up?.split('/')[0] ?? (r.remotes.origin ? 'origin' : '');
  const branch = pos[1] ?? (up ? up.split('/').slice(1).join('/') : cur);
  if (!remote) {
    o.err('fatal: este repositorio no tiene un remoto configurado.');
    o.dim('Pista: agrega uno con  git remote add origin <url>');
    return false;
  }
  if (!pos.length && !up) {
    o.err(`No hay información de seguimiento para la rama actual (${cur}).`);
    o.dim(`Pista: indica de dónde traer los cambios →  git pull origin ${cur}`);
    return false;
  }
  if (!doFetch(w, remote, o)) return false;
  const ref = `${remote}/${branch}`;
  const target = r.tracking[ref];
  if (!target) {
    o.err(`fatal: no se encontró la rama remota '${branch}' en '${remote}'.`);
    return false;
  }
  const url = r.remotes[remote];
  return mergeInto(w, target, ref, o, {
    label: `Merge branch '${branch}' of ${url}`,
  });
}

function cmdPush(w: World, args: string[], o: Out) {
  const r = w.repo!;
  const setUpstream = args.includes('-u') || args.includes('--set-upstream');
  const force = args.includes('-f') || args.includes('--force') || args.includes('--force-with-lease');
  const tags = args.includes('--tags');
  const del = args.includes('--delete');
  const pos = args.filter((a) => !a.startsWith('-'));
  const cur = currentBranch(r);
  const up = cur ? r.upstream[cur] : undefined;

  const remote = pos[0] ?? up?.split('/')[0] ?? (!pos.length && r.remotes.origin && cur && setUpstream ? 'origin' : undefined);
  if (!remote) {
    if (!Object.keys(r.remotes).length) {
      o.err('fatal: No hay ningún repositorio remoto configurado.');
      o.dim('Pista: conecta uno con  git remote add origin <url-de-github>');
      return false;
    }
    o.err(`fatal: La rama actual ${cur ?? ''} no tiene una rama upstream.`);
    o.out(`Para publicarla y dejarla conectada, usa:\n\n    git push --set-upstream origin ${cur}`);
    return false;
  }
  const url = r.remotes[remote];
  if (!url) {
    o.err(`fatal: '${remote}' no parece ser un repositorio git`);
    o.err('fatal: No se pudo leer desde el repositorio remoto.');
    o.dim('Pista: agrega uno con  git remote add origin <url-de-github>');
    return false;
  }
  const server = w.servers[url];
  if (!server) {
    o.err(`remote: Repositorio no encontrado.\nfatal: repositorio '${url}' no encontrado`);
    o.dim('Primero crea el repositorio vacío en GitHub y copia su dirección.');
    return false;
  }

  if (tags) {
    const fresh = Object.entries(r.tags).filter(([t, id]) => server.tags[t] !== id);
    if (!fresh.length) {
      o.out('Todo está actualizado.');
      return true;
    }
    o.out(`To ${url}`);
    for (const [t, id] of fresh) {
      server.tags[t] = id;
      o.out(` * [nueva etiqueta]  ${t} -> ${t}`);
    }
    return true;
  }
  // git push origin v1.0  (una etiqueta concreta)
  if (pos[1] && r.tags[pos[1]] && !r.branches[pos[1]]) {
    const t = pos[1];
    if (server.tags[t] === r.tags[t]) o.out('Todo está actualizado.');
    else {
      server.tags[t] = r.tags[t];
      o.out(`To ${url}`);
      o.out(` * [nueva etiqueta]  ${t} -> ${t}`);
    }
    return true;
  }

  let branch = pos[1] ?? cur;
  if (del) {
    const target = pos[1] ?? pos[0];
    if (!target || !server.branches[target]) {
      o.err(`error: no se pudo borrar '${target ?? ''}': la rama remota no existe`);
      return false;
    }
    delete server.branches[target];
    delete r.tracking[`${remote}/${target}`];
    o.out(`To ${url}`);
    o.out(` - [borrada]         ${target}`);
    return true;
  }
  if (branch?.includes(':')) branch = branch.split(':')[1];
  if (!branch) {
    o.err('fatal: estás en HEAD desacoplado; indica qué rama quieres publicar.');
    return false;
  }
  const local = pos[1]?.includes(':') ? pos[1].split(':')[0] : branch;
  const localId = r.branches[local] ?? (local === 'HEAD' ? headId(r) : undefined);
  if (!localId) {
    o.err(`error: la referencia '${local}' no coincide con ninguna rama que puedas publicar.`);
    return false;
  }
  const remoteId = server.branches[branch];
  if (remoteId === localId) {
    o.out('Todo está actualizado.');
    if (setUpstream && cur) r.upstream[cur] = `${remote}/${branch}`;
    return true;
  }
  if (remoteId && !isAncestor(w, remoteId, localId) && !force) {
    o.out(`To ${url}`);
    o.err(` ! [rechazado]       ${branch} -> ${branch} (hay que traer cambios primero)`);
    o.err(`error: no se pudieron publicar algunas referencias en '${url}'`);
    o.out('Pista: el remoto tiene cambios que tú no tienes todavía. Primero trae lo nuevo con "git pull" y luego vuelve a hacer push.', 'warn');
    return false;
  }
  o.out('Enviando objetos: 100%, listo.');
  o.out(`To ${url}`);
  if (!remoteId) o.out(` * [nueva rama]      ${branch} -> ${branch}`);
  else o.out(`   ${shortId(remoteId)}..${shortId(localId)}  ${branch} -> ${branch}${force && !isAncestor(w, remoteId, localId) ? ' (forzado)' : ''}`);
  server.branches[branch] = localId;
  r.tracking[`${remote}/${branch}`] = localId;
  if (setUpstream && r.branches[local]) {
    r.upstream[local] = `${remote}/${branch}`;
    o.out(`Rama '${local}' configurada para hacer seguimiento de '${remote}/${branch}'.`);
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Despachador                                                         */
/* ------------------------------------------------------------------ */

export function runGit(w: World, args: string[], o: Out): boolean {
  const [sub, ...rest] = args;
  if (!sub) {
    o.out('uso: git <comando> [<argumentos>]\n');
    o.out('Los más usados: init, status, add, commit, log, branch, switch, merge, push, pull');
    o.dim('Escribe "help" para ver todo lo que entiende este simulador.');
    return true;
  }
  if (sub === '--version' || sub === 'version') {
    o.out('git version 2.47.0 (simulado)');
    return true;
  }
  if (sub === 'help' || sub === '--help') {
    o.out('Comandos de Git que entiende este simulador:');
    o.out('  ' + GIT_COMMANDS.filter((c) => c !== 'help').join(', '));
    return true;
  }
  if (sub === 'init') return cmdInit(w, rest, o);
  if (sub === 'clone') return cmdClone(w, rest, o);
  if (sub === 'config') return cmdConfig(w, rest, o);

  if (!GIT_COMMANDS.includes(sub)) {
    if (['rebase', 'cherry-pick', 'bisect', 'submodule', 'worktree', 'blame'].includes(sub)) {
      o.err(`git ${sub} existe en Git de verdad, pero este simulador todavía no lo incluye.`);
      return false;
    }
    o.err(`git: '${sub}' no es un comando de git.`);
    const near = GIT_COMMANDS.filter((c) => distance(sub, c) <= 2);
    if (near.length) o.out(`\n¿Quisiste decir esto?\n\t${near.join('\n\t')}`);
    return false;
  }
  if (!w.repo) {
    o.err('fatal: no es un repositorio git (ni ninguno de los directorios superiores): .git');
    o.dim('Pista: esta carpeta todavía no es un repositorio. Créalo con  git init');
    return false;
  }
  switch (sub) {
    case 'status':
      return cmdStatus(w, rest, o);
    case 'add':
      return cmdAdd(w, rest, o);
    case 'commit':
      return cmdCommit(w, rest, o);
    case 'log':
      return cmdLog(w, rest, o);
    case 'show':
      return cmdShow(w, rest, o);
    case 'diff':
      return cmdDiff(w, rest, o);
    case 'branch':
      return cmdBranch(w, rest, o);
    case 'switch':
      return switchTo(w, rest, o, false);
    case 'checkout':
      return switchTo(w, rest, o, true);
    case 'merge':
      return cmdMerge(w, rest, o);
    case 'restore':
      return cmdRestore(w, rest, o);
    case 'reset':
      return cmdReset(w, rest, o);
    case 'revert':
      return cmdRevert(w, rest, o);
    case 'stash':
      return cmdStash(w, rest, o);
    case 'tag':
      return cmdTag(w, rest, o);
    case 'remote':
      return cmdRemote(w, rest, o);
    case 'fetch':
      return cmdFetch(w, rest, o);
    case 'pull':
      return cmdPull(w, rest, o);
    case 'push':
      return cmdPush(w, rest, o);
    case 'rm':
      return cmdRm(w, rest, o);
    case 'mv':
      return cmdMv(w, rest, o);
    case 'reflog':
      return cmdReflog(w, rest, o);
    default:
      return false;
  }
}
