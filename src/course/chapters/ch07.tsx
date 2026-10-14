import { createWorld, headTree, type World } from '../../engine';
import { addServer, serverCommit, serverMerge } from '../../engine/scenario';
import { Callout, Cmd, Term } from '../../components/ui';
import type { Chapter, StepAction } from '../types';

const URL = 'https://github.com/ana/recetas-compartidas.git';

function makeWorld() {
  let w = createWorld({ cwd: 'colaboracion' });
  w = addServer(w, URL);
  w = serverCommit(w, URL, 'main', { 'README.txt': 'Recetas compartidas\n' }, 'Primer commit');
  w = serverCommit(w, URL, 'main', { 'ensalada.txt': 'Lechuga, tomate y aceite\n' }, 'Agrego la ensalada');
  w = serverCommit(w, URL, 'main', { 'sopa.txt': 'Verduras y caldo\n' }, 'Agrego la sopa');
  return w;
}

const openPr: StepAction = {
  label: 'Abrir pull request en GitHub',
  message:
    'GitHub: abriste el pull request #1 «mi-receta → main». Ana recibió un aviso para revisarlo.',
  run: (w) => w,
};

const approve: StepAction = {
  label: 'Simular: Ana aprueba y fusiona',
  message: 'GitHub: Ana aprobó el pull request #1 y lo fusionó en main. ¡Tu aporte ya es parte del proyecto!',
  run: (w) => serverMerge(w, URL, 'mi-receta', 'main'),
};

const serverHas = (w: World, branch: string, file: string) => {
  const tip = w.servers[URL]?.branches[branch];
  return !!tip && w.commits[tip]?.tree[file] !== undefined;
};

export const ch07: Chapter = {
  id: 7,
  kind: 'lesson',
  title: 'GitHub y pull requests',
  tagline: 'Propón cambios y revísalos en equipo.',
  minutes: 8,
  makeWorld,
  recap: [
    { cmd: 'git clone url', desc: 'descargar un proyecto con todo su historial' },
    { cmd: 'git push -u origin rama', desc: 'publicar tu rama' },
    { cmd: 'pull request', desc: 'pedir que revisen y acepten tus cambios' },
    { cmd: 'git pull', desc: 'traer lo que se aprobó' },
  ],
  steps: [
    {
      id: 'intro',
      title: 'Proponer en vez de imponer',
      body: (
        <>
          <p>
            En proyectos compartidos casi nadie escribe directo en <b>main</b>. Lo normal es trabajar en una rama
            propia y pedir que el equipo revise antes de unirla. Ese pedido se llama{' '}
            <b>pull request</b> (o «PR»).
          </p>
          <Callout title="Importante">
            Los pull requests no son parte de Git: son una función de GitHub (y de otras plataformas). Git pone las
            ramas; GitHub pone la conversación y el botón de aprobar.
          </Callout>
        </>
      ),
    },
    {
      id: 'clone',
      title: 'Descarga el proyecto de Ana',
      body: (
        <p>
          Ana te invitó a su repositorio. <Cmd>git clone {URL}</Cmd> lo descarga completo, con todo su{' '}
          <Term k="clonar">historial</Term>.
        </p>
      ),
      suggest: [`git clone ${URL}`],
      check: ({ world }) => world.repo !== null,
      solution: [`git clone ${URL}`],
      done: (
        <p>
          Tu carpeta se llenó con los archivos de Ana y el mapa muestra sus 3 commits. Además, el clon ya viene
          conectado al servidor: no hace falta <Cmd>git remote add</Cmd>.
        </p>
      ),
    },
    {
      id: 'branch',
      title: 'Crea tu rama',
      body: (
        <p>
          Nunca trabajes en main de un proyecto compartido. Crea tu rama: <Cmd>git switch -c mi-receta</Cmd>.
        </p>
      ),
      suggest: ['git switch -c mi-receta'],
      check: ({ world }) =>
        !!world.repo && world.repo.head.kind === 'branch' && world.repo.head.name === 'mi-receta',
      solution: ['git switch -c mi-receta'],
    },
    {
      id: 'file',
      title: 'Agrega tu receta',
      body: (
        <p>
          Crea un archivo nuevo: <Cmd>echo "Postre: flan de caramelo" &gt; postre.txt</Cmd>.
        </p>
      ),
      suggest: ['echo "Postre: flan de caramelo" > postre.txt'],
      check: ({ world }) => world.files['postre.txt'] !== undefined,
      solution: ['echo "Postre: flan de caramelo" > postre.txt'],
    },
    {
      id: 'commit',
      title: 'Guárdala',
      body: (
        <p>
          Prepara y guarda: <Cmd>git add .</Cmd> y luego <Cmd>git commit -m "Agrego receta de postre"</Cmd>.
        </p>
      ),
      suggest: ['git add .', 'git commit -m "Agrego receta de postre"'],
      check: ({ world }) => {
        const b = world.repo?.branches;
        return !!b && !!b['mi-receta'] && b['mi-receta'] !== b.main;
      },
      solution: ['git add .', 'git commit -m "Agrego receta de postre"'],
    },
    {
      id: 'push',
      title: 'Publica tu rama',
      body: (
        <p>
          <Cmd>git push -u origin mi-receta</Cmd> sube tu rama (no main) al servidor.
        </p>
      ),
      suggest: ['git push -u origin mi-receta'],
      check: ({ world }) => !!world.servers[URL]?.branches['mi-receta'],
      solution: ['git push -u origin mi-receta'],
      done: (
        <p>
          Tu rama ya está en GitHub. Hasta aquí es todo Git. Lo que sigue pasa en la página web.
        </p>
      ),
    },
    {
      id: 'open-pr',
      title: 'Abre el pull request',
      body: (
        <>
          <p>En GitHub verías un botón verde. Aquí lo simulamos:</p>
          <div className="my-2 rounded-xl border border-rule bg-[#f7f8fc] p-3 text-[14.5px]">
            <p className="sign text-[12px] text-ink-faint">Pull request nuevo</p>
            <p className="font-bold text-ink">Agrego receta de postre</p>
            <p className="font-mono text-[12.5px] text-ink-soft">mi-receta → main</p>
            <p className="mt-1 text-ink-soft">+1 archivo: postre.txt</p>
          </div>
        </>
      ),
      actions: [openPr],
      check: ({ ran }) => ran(/^\[evento\]/),
      solution: ['@0'],
      done: <p>Ahora alguien del equipo revisa tu propuesta, comenta y, si todo está bien, la aprueba.</p>,
    },
    {
      id: 'approve',
      title: 'Ana la revisa y la aprueba',
      body: <p>Tú esperas. Usa el botón para simular que Ana aprueba y fusiona tu aporte en main.</p>,
      actions: [approve],
      check: ({ world }) => serverHas(world, 'main', 'postre.txt'),
      solution: ['@0'],
      done: (
        <p>
          En el servidor, <b>main</b> ya tiene tu postre. En tu computador todavía no: tu <b>main</b> local sigue
          como estaba.
        </p>
      ),
    },
    {
      id: 'pull',
      title: 'Trae lo aprobado',
      body: (
        <p>
          Vuelve a main con <Cmd>git switch main</Cmd> y actualízalo con <Cmd>git pull</Cmd>.
        </p>
      ),
      suggest: ['git switch main', 'git pull'],
      check: ({ world }) =>
        !!world.repo && world.repo.head.kind === 'branch' && world.repo.head.name === 'main' && !!headTree(world)['postre.txt'],
      solution: ['git switch main', 'git pull'],
      done: <p>Tu receta ya es parte oficial del proyecto, en tu computador y en el de todos.</p>,
    },
    {
      id: 'clean',
      title: 'Ordena la casa',
      body: (
        <p>
          Tu rama ya cumplió. Bórrala localmente con <Cmd>git branch -d mi-receta</Cmd>. (En GitHub suele haber un
          botón para borrar también la rama del servidor.)
        </p>
      ),
      suggest: ['git branch -d mi-receta'],
      check: ({ world }) => !!world.repo && world.repo.branches['mi-receta'] === undefined,
      solution: ['git branch -d mi-receta'],
      done: <p>Ese es el flujo de casi todo equipo: rama → pull request → revisión → fusión → pull.</p>,
    },
  ],
};
