export function splitLines(s: string): string[] {
  if (s === '') return [];
  return s.replace(/\n$/, '').split('\n');
}

export function joinLines(lines: string[]): string {
  return lines.length ? lines.join('\n') + '\n' : '';
}

/** Pares [i, j] de líneas iguales en la subsecuencia común más larga. */
export function lcs(a: string[], b: string[]): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

export interface DiffOp {
  t: ' ' | '+' | '-';
  s: string;
}

export function diffLines(a: string[], b: string[]): DiffOp[] {
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  for (const [pi, pj] of lcs(a, b)) {
    while (i < pi) ops.push({ t: '-', s: a[i++] });
    while (j < pj) ops.push({ t: '+', s: b[j++] });
    ops.push({ t: ' ', s: a[i] });
    i++;
    j++;
  }
  while (i < a.length) ops.push({ t: '-', s: a[i++] });
  while (j < b.length) ops.push({ t: '+', s: b[j++] });
  return ops;
}

/** Cuenta líneas añadidas y quitadas entre dos contenidos. */
export function countChanges(oldText: string | undefined, newText: string | undefined) {
  const ops = diffLines(splitLines(oldText ?? ''), splitLines(newText ?? ''));
  return {
    added: ops.filter((o) => o.t === '+').length,
    removed: ops.filter((o) => o.t === '-').length,
  };
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export interface Merge3Result {
  text: string;
  conflict: boolean;
}

/**
 * Fusión de tres vías por líneas, como hace Git: los cambios en zonas distintas
 * se combinan solos; si los dos tocan la misma zona, hay conflicto.
 */
export function merge3(
  baseS: string,
  oursS: string,
  theirsS: string,
  oursLabel: string,
  theirsLabel: string,
): Merge3Result {
  if (oursS === theirsS) return { text: oursS, conflict: false };
  if (baseS === oursS) return { text: theirsS, conflict: false };
  if (baseS === theirsS) return { text: oursS, conflict: false };

  const base = splitLines(baseS);
  const ours = splitLines(oursS);
  const theirs = splitLines(theirsS);
  const mo = new Map<number, number>(lcs(base, ours));
  const mt = new Map<number, number>(lcs(base, theirs));

  const sync: Array<[number, number, number]> = [];
  for (let b = 0; b < base.length; b++) {
    const o = mo.get(b);
    const t = mt.get(b);
    if (o !== undefined && t !== undefined) sync.push([b, o, t]);
  }
  sync.push([base.length, ours.length, theirs.length]);

  const out: string[] = [];
  let conflict = false;
  let pb = 0;
  let po = 0;
  let pt = 0;
  for (const [b, o, t] of sync) {
    const B = base.slice(pb, b);
    const O = ours.slice(po, o);
    const T = theirs.slice(pt, t);
    if (same(O, T)) out.push(...O);
    else if (same(B, O)) out.push(...T);
    else if (same(B, T)) out.push(...O);
    else {
      conflict = true;
      out.push(`<<<<<<< ${oursLabel}`, ...O, '=======', ...T, `>>>>>>> ${theirsLabel}`);
    }
    if (b < base.length) out.push(base[b]);
    pb = b + 1;
    po = o + 1;
    pt = t + 1;
  }
  return { text: joinLines(out), conflict };
}

export function hasConflictMarkers(text: string): boolean {
  return /^(<<<<<<< |=======$|>>>>>>> )/m.test(text);
}
