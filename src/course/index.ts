import type { Chapter, ChapterMeta, Mission } from './types';
import { ch01 } from './chapters/ch01';
import { ch02 } from './chapters/ch02';
import { ch03 } from './chapters/ch03';
import { ch04 } from './chapters/ch04';
import { ch05 } from './chapters/ch05';
import { ch06 } from './chapters/ch06';
import { ch07 } from './chapters/ch07';
import { ch08 } from './chapters/ch08';
import { ch09 } from './chapters/ch09';
import { ch10 } from './chapters/ch10';
import { m11, m12, m13, m14 } from './missions';

const LESSONS: Chapter[] = [ch01, ch02, ch03, ch04, ch05, ch06, ch07, ch08, ch09, ch10];
const MISSIONS: Mission[] = [m11, m12, m13, m14];

const meta = (c: Chapter | Mission): ChapterMeta => ({
  id: c.id,
  kind: c.kind,
  title: c.title,
  tagline: c.tagline,
  minutes: c.minutes,
});

/** Las 10 paradas guiadas y las 4 misiones sin ayuda. */
export const ROUTE: ChapterMeta[] = [...LESSONS, ...MISSIONS].map(meta);
export const LESSON_COUNT = LESSONS.length;
export const MISSION_COUNT = MISSIONS.length;

export const getChapter = (id: number): Chapter | undefined => LESSONS.find((c) => c.id === id);
export const getMission = (id: number): Mission | undefined => MISSIONS.find((m) => m.id === id);
export const isReady = (id: number) => !!getChapter(id) || !!getMission(id);
