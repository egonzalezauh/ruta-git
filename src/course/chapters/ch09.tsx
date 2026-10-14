import { createWorld, headId } from '../../engine';
import { script } from '../../engine/scenario';
import { isIgnored } from '../../engine/util';
import { Callout, Cmd } from '../../components/ui';
import type { Chapter } from '../types';

function makeWorld() {
  return script(createWorld({ cwd: 'app' }), [
    'git init',
    'echo "Mi app: versión 1" > app.txt',
    'git add app.txt',
    'git commit -m "Primera versión de la app"',
    'echo "CLAVE_SECRETA=abc123" > secretos.env',
    'echo "error 404 en la línea 12" > debug.log',
  ]);
}

export const ch09: Chapter = {
  id: 9,
  kind: 'lesson',
  title: 'Buenas prácticas',
  tagline: 'Hábitos que te ahorran problemas.',
  minutes: 6,
  makeWorld,
  recap: [
    { cmd: '.gitignore', desc: 'lista de archivos que Git debe ignorar' },
    { cmd: 'git status antes de git add', desc: 'mirar antes de guardar' },
    { cmd: 'mensajes claros', desc: 'explicar qué y por qué' },
    { cmd: 'git tag v1.0', desc: 'marcar versiones importantes' },
  ],
  steps: [
    {
      id: 'intro',
      title: 'Tres hábitos que lo cambian todo',
      body: (
        <>
          <p>Git ya funciona con lo que sabes. Estos hábitos hacen que funcione bien con otras personas:</p>
          <ul>
            <li>
              <b>Nunca</b> guardar claves ni archivos temporales.
            </li>
            <li>
              Commits <b>pequeños</b> y con mensajes que se entienden.
            </li>
            <li>
              Marcar las versiones importantes con una <b>etiqueta</b>.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'status',
      title: 'Mira antes de guardar',
      body: (
        <p>
          En esta carpeta hay dos archivos que no deberían subirse nunca. Míralos con <Cmd>git status</Cmd>.
        </p>
      ),
      suggest: ['git status'],
      check: ({ ran }) => ran(/^git status/),
      solution: ['git status'],
      done: (
        <p>
          Dos archivos «sin seguimiento»: <b>secretos.env</b> (con una clave) y <b>debug.log</b> (basura temporal).
          Si ahora escribieras <Cmd>git add .</Cmd>, ¡subirías la clave!
        </p>
      ),
    },
    {
      id: 'ignore',
      title: 'Dile a Git que los ignore',
      body: (
        <>
          <p>
            Un archivo llamado <Cmd>.gitignore</Cmd> lista lo que Git debe ignorar. Cada línea es un nombre o un
            patrón (<Cmd>*.log</Cmd> significa «todo lo que termine en .log»).
          </p>
          <p>Créalo con las dos reglas.</p>
        </>
      ),
      suggest: ['echo "secretos.env" > .gitignore', 'echo "*.log" >> .gitignore'],
      hint: 'La primera usa > (crea el archivo) y la segunda >> (agrega una línea al final).',
      check: ({ world }) =>
        isIgnored('secretos.env', world.files['.gitignore']) && isIgnored('debug.log', world.files['.gitignore']),
      solution: ['echo "secretos.env" > .gitignore', 'echo "*.log" >> .gitignore'],
      done: (
        <p>
          Mira «Tu carpeta»: los dos archivos ahora dicen <b>ignorado</b>. Siguen ahí, pero Git hará como que no
          existen.
        </p>
      ),
    },
    {
      id: 'status2',
      title: 'Comprueba que funcionó',
      body: (
        <p>
          Vuelve a mirar con <Cmd>git status</Cmd>. Debería aparecer solo <b>.gitignore</b>.
        </p>
      ),
      suggest: ['git status'],
      check: ({ ran }) => ran(/^git status/),
      solution: ['git status'],
    },
    {
      id: 'commit-ignore',
      title: 'Guarda el .gitignore',
      body: (
        <p>
          <Cmd>git add .</Cmd> y luego <Cmd>git commit -m "Agrego .gitignore"</Cmd>. Esta vez <Cmd>add .</Cmd> es
          seguro.
        </p>
      ),
      suggest: ['git add .', 'git commit -m "Agrego .gitignore"'],
      check: ({ world }) => {
        const h = world.repo ? headId(world.repo) : null;
        if (!h) return false;
        const t = world.commits[h].tree;
        return t['.gitignore'] !== undefined && t['secretos.env'] === undefined && t['debug.log'] === undefined;
      },
      solution: ['git add .', 'git commit -m "Agrego .gitignore"'],
      done: <p>La clave quedó fuera del historial. Y eso es difícil de arreglar después, por eso vale la pena hacerlo bien desde el inicio.</p>,
    },
    {
      id: 'mensajes',
      title: 'Escribe un mensaje que se entienda',
      body: (
        <>
          <p>
            El mensaje es para tu yo del futuro (y para tu equipo). Explica <b>qué</b> cambió y, si hace falta,{' '}
            <b>por qué</b>.
          </p>
          <div className="my-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-line-1/40 bg-[#fff0ea] p-3 text-[14.5px] text-ink">
              <p className="sign text-[12px] text-line-1">Mejor evitar</p>
              <p className="font-mono text-[13px]">arreglos</p>
              <p className="font-mono text-[13px]">cambios varios</p>
              <p className="font-mono text-[13px]">asdf</p>
            </div>
            <div className="rounded-xl border border-line-2/40 bg-[#e9f8f3] p-3 text-[14.5px] text-ink">
              <p className="sign text-[12px] text-line-2">Mucho mejor</p>
              <p className="font-mono text-[13px]">Agrego botón de ayuda en la portada</p>
              <p className="font-mono text-[13px]">Corrijo el cálculo del total con IVA</p>
            </div>
          </div>
          <p>
            Haz un cambio a <b>app.txt</b> y guárdalo con un mensaje <i>tuyo</i> que se entienda.
          </p>
        </>
      ),
      suggest: ['echo "Versión 2: agrego un botón de ayuda" >> app.txt'],
      hint: (
        <>
          Después de cambiar el archivo, algo como{' '}
          <Cmd>git commit -am "Agrego un botón de ayuda para que nadie se pierda"</Cmd>. Debe tener al menos 4 palabras.
        </>
      ),
      check: ({ world, before }) => {
        const h = world.repo ? headId(world.repo) : null;
        if (!h || Object.keys(world.commits).length <= Object.keys(before.commits).length) return false;
        const msg = world.commits[h].message.trim();
        return msg.length >= 20 && msg.split(/\s+/).length >= 4;
      },
      solution: [
        'echo "Versión 2: agrego un botón de ayuda" >> app.txt',
        'git commit -am "Agrego un botón de ayuda para que nadie se pierda"',
      ],
      done: <p>Dentro de un mes, ese mensaje te va a ahorrar un buen rato de dudas.</p>,
    },
    {
      id: 'tag',
      title: 'Marca esta versión',
      body: (
        <p>
          Cuando una versión es importante (un lanzamiento, una entrega), ponle una <b>etiqueta</b>:{' '}
          <Cmd>git tag v1.0</Cmd>. Es un nombre fijo para ese punto.
        </p>
      ),
      suggest: ['git tag v1.0'],
      check: ({ world }) => Object.keys(world.repo?.tags ?? {}).length > 0,
      solution: ['git tag v1.0'],
      done: <p>En el mapa aparece un rótulo con un rombo sobre esa estación.</p>,
    },
    {
      id: 'tags',
      title: 'Lista tus etiquetas',
      body: (
        <p>
          <Cmd>git tag</Cmd> sin nada más muestra todas las que tienes.
        </p>
      ),
      suggest: ['git tag'],
      check: ({ ran }) => ran(/^git tag\s*$/),
      solution: ['git tag'],
      done: (
        <>
          <p>
            Es útil para decir «arreglen el error de la <b>v1.0</b>». Más adelante puedes subirlas con{' '}
            <Cmd>git push --tags</Cmd>.
          </p>
          <Callout title="Antes de cada commit">
            Repite este mini ritual: <b>status → diff → add → commit</b>. Mirar antes de guardar evita el 90% de los
            sustos.
          </Callout>
        </>
      ),
    },
  ],
};
