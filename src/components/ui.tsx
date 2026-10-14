import type { ReactNode } from 'react';
import { GLOSSARY } from '../course/glossary';

/** Término del glosario: se subraya con puntos y explica al pasar el mouse o enfocar con el teclado. */
export function Term({ k, children }: { k: keyof typeof GLOSSARY | string; children: ReactNode }) {
  const def = GLOSSARY[k];
  if (!def) return <>{children}</>;
  return (
    <span className="term" tabIndex={0} data-def={def}>
      {children}
    </span>
  );
}

/** Comando escrito dentro de un párrafo. */
export function Cmd({ children }: { children: ReactNode }) {
  return <code className="cmd">{children}</code>;
}

/** Recuadro con una idea clave o una analogía. */
export function Callout({
  title,
  children,
  tone = 'idea',
}: {
  title?: string;
  children: ReactNode;
  tone?: 'idea' | 'warn';
}) {
  const color = tone === 'warn' ? 'var(--color-line-3)' : 'var(--color-line-main)';
  return (
    <aside
      className="my-3 rounded-xl bg-wash/70 py-3 pr-4 pl-4 text-[15px] text-ink-soft"
      style={{ borderLeft: `5px solid ${color}` }}
    >
      {title && <p className="sign mb-0.5 text-[13px] text-ink">{title}</p>}
      {children}
    </aside>
  );
}

/** Contenedor de cada zona de la pantalla de práctica. */
export function Panel({
  title,
  subtitle,
  right,
  children,
  className = '',
  bodyClassName = '',
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-rule bg-card shadow-[0_1px_0_rgba(14,22,48,0.04)] ${className}`}
    >
      <header className="flex items-baseline gap-3 border-b border-rule px-4 py-2.5">
        <h2 className="sign text-[15px] text-ink">{title}</h2>
        {subtitle && <p className="min-w-0 flex-1 truncate text-[13.5px] text-ink-faint">{subtitle}</p>}
        {right}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5l3.2 3.2L13 4.8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8h11M9 3.5L13.5 8 9 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FileIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 1.8h5l3 3V13a1.2 1.2 0 0 1-1.2 1.2H4A1.2 1.2 0 0 1 2.8 13V3A1.2 1.2 0 0 1 4 1.8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 1.8V5h3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Marca del curso: dos estaciones unidas por una línea. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--color-line-main)" />
      <path d="M7.5 21h7.2l4.6-9h5.2" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.5" cy="21" r="3.4" fill="var(--color-line-main)" stroke="#fff" strokeWidth="2.6" />
      <circle cx="24.5" cy="12" r="3.4" fill="var(--color-line-main)" stroke="#fff" strokeWidth="2.6" />
    </svg>
  );
}
