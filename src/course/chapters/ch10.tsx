import { createWorld, headId, isAncestor } from '../../engine';
import { addServer, serverCommit } from '../../engine/scenario';
import { Callout, Cmd } from '../../components/ui';
import type { Chapter, StepAction } from '../types';

const URL = 'https://github.com/tu-usuario/mi-app.git';

function makeWorld() {
  return addServer(createWorld({ cwd: 'mi-app' }), URL);
}

const anaDocs: StepAction = {
  label: 'Simular: Ana sube la documentación',
  message: 'Novedad: Ana subió "docs.txt" a main en el servidor.',
  run: (w) => serverCommit(w, URL, 'main', { 'docs.txt': 'Cómo usar la app\n' }, 'Agrego la documentación'),
};

export const ch10: Chapter = {
  id: 10,
  kind: 'lesson',
  title: 'Reto final',
  tagline: 'Un proyecto de principio a fin con escenarios reales.',
  minutes: 15,
  makeWorld,
  recap: [
    { cmd: 'init → add → commit', desc: 'empezar un proyecto' },
    { cmd: 'remote add + push -u', desc: 'publicarlo' },
    { cmd: 'switch -c → commit', desc: 'trabajar en una rama' },
    { cmd: 'pull → merge → push', desc: 'integrar con el equipo' },
    { cmd: 'tag + push --tags', desc: 'lanzar una versión' },
  ],
  steps: [
    {
      id: 'intro',
      title: 'Todo junto',
      body: (
        <>
          <p>
            Vas a construir un proyecto completo con todo lo que aprendiste: crearlo, publicarlo, trabajar en una
            rama, integrar lo de una compañera y lanzar la versión 1.0.
          </p>
          <Callout title="Esta vez, menos pistas">
            Cada paso te dice <b>qué lograr</b>, no el comando. Si te trabas, la pista te lo recuerda. Cuando te
            sientas listo, las misiones que siguen no traen ninguna ayuda.
          </Callout>
          <p>
            El repositorio vacío ya existe en GitHub: <Cmd>{URL}</Cmd>
          </p>
        </>
      ),
    },
    {
      id: 'crear',
      title: 'Crea el repositorio con un archivo README.txt',
      body: <p>Empieza el repositorio y crea un archivo <b>README.txt</b> con una frase que describa tu app.</p>,
      hint: (
        <>
          <Cmd>git init</Cmd> y luego <Cmd>echo "Mi app de tareas" &gt; README.txt</Cmd>.
        </>
      ),
      check: ({ world }) => world.repo !== null && world.files['README.txt'] !== undefined,
      solution: ['git init', 'echo "Mi app de tareas" > README.txt'],
    },
    {
      id: 'primer-commit',
      title: 'Guarda tu primer commit',
      body: <p>Deja el README guardado en la historia con un mensaje claro.</p>,
      hint: (
        <>
          <Cmd>git add .</Cmd> y <Cmd>git commit -m "Primer commit"</Cmd>.
        </>
      ),
      check: ({ world }) => Object.keys(world.commits).length >= 1,
      solution: ['git add .', 'git commit -m "Primer commit"'],
    },
    {
      id: 'publicar',
      title: 'Conéctalo y publícalo',
      body: (
        <p>
          Conecta tu proyecto con <b>{URL}</b> y sube <b>main</b>, dejando la conexión guardada para el futuro.
        </p>
      ),
      hint: (
        <>
          <Cmd>git remote add origin {URL}</Cmd> y <Cmd>git push -u origin main</Cmd>.
        </>
      ),
      check: ({ world }) => !!world.repo && world.servers[URL]?.branches.main === headId(world.repo),
      solution: [`git remote add origin ${URL}`, 'git push -u origin main'],
      done: <p>Tu proyecto ya vive en internet. Cualquiera con la dirección puede descargarlo.</p>,
    },
    {
      id: 'rama',
      title: 'Trabaja en una rama: login',
      body: (
        <p>
          Crea una rama llamada <b>funcion-login</b>, agrega un archivo <b>login.txt</b> y guarda el cambio en esa
          rama.
        </p>
      ),
      hint: (
        <>
          <Cmd>git switch -c funcion-login</Cmd>, <Cmd>echo "Pantalla de login" &gt; login.txt</Cmd>,{' '}
          <Cmd>git add .</Cmd>, <Cmd>git commit -m "Agrego el login"</Cmd>.
        </>
      ),
      check: ({ world }) => {
        const r = world.repo;
        const tip = r?.branches['funcion-login'];
        return !!tip && tip !== r?.branches.main && world.commits[tip].tree['login.txt'] !== undefined;
      },
      solution: [
        'git switch -c funcion-login',
        'echo "Pantalla de login" > login.txt',
        'git add .',
        'git commit -m "Agrego el login"',
      ],
    },
    {
      id: 'ana',
      title: 'Ana también publica',
      body: <p>Mientras trabajabas, tu compañera subió la documentación a main.</p>,
      actions: [anaDocs],
      check: ({ ran }) => ran(/^\[evento\]/),
      solution: ['@0'],
    },
    {
      id: 'actualizar',
      title: 'Vuelve a main y actualízate',
      body: <p>Cambia a main y trae lo que Ana subió.</p>,
      hint: (
        <>
          <Cmd>git switch main</Cmd> y <Cmd>git pull</Cmd>.
        </>
      ),
      check: ({ world }) =>
        !!world.repo &&
        world.repo.head.kind === 'branch' &&
        world.repo.head.name === 'main' &&
        world.files['docs.txt'] !== undefined,
      solution: ['git switch main', 'git pull'],
    },
    {
      id: 'unir',
      title: 'Une tu función con main',
      body: <p>Trae el login a main.</p>,
      hint: <Cmd>git merge funcion-login</Cmd>,
      check: ({ world }) => {
        const b = world.repo?.branches;
        return !!b && !!b['funcion-login'] && isAncestor(world, b['funcion-login'], b.main);
      },
      solution: ['git merge funcion-login'],
    },
    {
      id: 'subir',
      title: 'Publica main',
      body: <p>Sube el resultado al servidor para que todos lo vean.</p>,
      hint: <Cmd>git push</Cmd>,
      check: ({ world }) => !!world.repo && world.servers[URL]?.branches.main === headId(world.repo),
      solution: ['git push'],
    },
    {
      id: 'lanzar',
      title: 'Lanza la versión 1.0',
      body: (
        <p>
          Pon la etiqueta <b>v1.0</b> en este punto y publícala también en el servidor.
        </p>
      ),
      hint: (
        <>
          <Cmd>git tag v1.0</Cmd> y <Cmd>git push --tags</Cmd>.
        </>
      ),
      check: ({ world }) => !!world.repo && world.servers[URL]?.tags['v1.0'] === headId(world.repo),
      solution: ['git tag v1.0', 'git push --tags'],
      done: (
        <p>
          ¡Lanzamiento listo! Creaste, publicaste, trabajaste en equipo y etiquetaste una versión. Eso es Git de
          verdad. Ahora, las misiones: sin ninguna ayuda.
        </p>
      ),
    },
  ],
};
