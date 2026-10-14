import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface Props {
  path: string;
  initial: string;
  onSave: (content: string) => void;
  onClose: () => void;
}

/** Un mini editor de texto para modificar archivos sin escribir comandos (como abrirlos en el Bloc de notas). */
export function FileEditor({ path, initial, onSave, onClose }: Props) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, []);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSave(text);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Editar ${path}`}
        onKeyDown={onKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-card shadow-[0_30px_80px_-30px_rgba(14,22,48,0.7)]"
      >
        <header className="border-b border-rule px-5 py-3.5">
          <p className="sign text-[13px] text-line-main">Editor de texto</p>
          <h2 className="font-mono text-[17px] font-medium text-ink">{path}</h2>
          <p className="mt-0.5 text-[14px] text-ink-faint">
            Es como abrir el archivo en tu editor. Cuando guardes, Git notará el cambio.
          </p>
        </header>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          aria-label={`Contenido de ${path}`}
          className="block h-64 w-full resize-none bg-[#f7f8fc] px-5 py-4 font-mono text-[14.5px] leading-relaxed text-ink outline-none"
        />
        <footer className="flex items-center justify-between gap-3 border-t border-rule px-5 py-3">
          <p className="hidden text-[13px] text-ink-faint sm:block">Ctrl + Enter para guardar · Esc para cerrar</p>
          <div className="ml-auto flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-rule px-3.5 py-2 text-[14.5px] font-medium text-ink hover:bg-wash"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onSave(text)}
              className="rounded-lg bg-ink px-4 py-2 text-[14.5px] font-bold text-white"
            >
              Guardar cambios
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
