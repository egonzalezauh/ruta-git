import { createWorld, headId, type World } from '../../engine';
import { addServer, script, serverCommit } from '../../engine/scenario';
import { Callout, Cmd, Term } from '../../components/ui';
import type { Chapter, StepAction } from '../types';

const URL = 'https://github.com/tu-usuario/proyecto-equipo.git';

function makeWorld() {
  let w = createWorld({ cwd: 'proyecto-equipo' });
  w = script(w, [
    'git init',
    'echo "Proyecto del equipo" > README.txt',
    'echo "- definir objetivos" > tareas.txt',
    'git add .',
    'git commit -m "Primer commit del proyecto"',
    'echo "- armar el calendario" >> tareas.txt',
    'git commit -am "Agrego tarea de calendario"',
  ]);
  return addServer(w, URL);
}

const anaNotas: StepAction = {
  label: 'Simular: Ana sube sus notas',
  message: 'Novedad: Ana subió "ana-notas.txt" al servidor desde su computador.',
  run: (w) =>
    serverCommit(w, URL, 'main', { 'ana-notas.txt': 'Reunión el lunes a las 9\n' }, 'Notas de la reunión'),
};

const anaAgenda: StepAction = {
  label: 'Simular: Ana sube la agenda',
  message: 'Novedad: Ana subió "agenda.txt" al servidor. Tú todavía no lo sabes.',
  run: (w) => serverCommit(w, URL, 'main', { 'agenda.txt': 'Lunes: revisión del plan\n' }, 'Agenda de la semana'),
};

const serverMain = (w: World) => w.servers[URL]?.branches.main;

export const ch06: Chapter = {
  id: 6,
  kind: 'lesson',
  title: 'Trabajar en equipo',
  tagline: 'Sube y baja cambios con un repositorio remoto.',
  minutes: 12,
  makeWorld,
  recap: [
    { cmd: 'git remote add origin url', desc: 'conectar con el servidor' },
    { cmd: 'git push -u origin main', desc: 'subir tus commits por primera vez' },
    { cmd: 'git fetch', desc: 'ver qué hay de nuevo sin tocar tus archivos' },
    { cmd: 'git pull', desc: 'traer y unir lo nuevo' },
    { cmd: 'git push', desc: 'subir tus cambios' },
  ],
  steps: [
    {
      id: 'intro',
      title: 'Una copia en la nube',
      body: (
        <>
          <p>
            Hasta ahora todo vivía en tu computador. Para trabajar con otras personas, el proyecto se guarda también
            en un <Term k="remoto">repositorio remoto</Term> (por ejemplo, en GitHub). Todos suben y bajan cambios
            desde ahí.
          </p>
          <Callout title="Origin">
            Al remoto principal se le llama <b>origin</b>, como un apodo para una dirección larga. Ya creamos por ti
            un repositorio vacío en GitHub para este ejercicio.
          </Callout>
        </>
      ),
    },
    {
      id: 'remote-add',
      title: 'Conecta tu proyecto con el servidor',
      body: (
        <p>
          Dile a Git cuál es la dirección: <Cmd>git remote add origin {URL}</Cmd>
        </p>
      ),
      suggest: [`git remote add origin ${URL}`],
      check: ({ world }) => !!world.repo?.remotes.origin,
      solution: [`git remote add origin ${URL}`, 'git remote -v'],
      done: <p>Tu proyecto ya sabe a dónde subir. Con <Cmd>git remote -v</Cmd> puedes ver la dirección guardada.</p>,
    },
    {
      id: 'push',
      title: 'Sube tu trabajo por primera vez',
      body: (
        <>
          <p>
            <Cmd>git push -u origin main</Cmd> envía tu rama main al servidor.
          </p>
          <p>
            La parte <Cmd>-u</Cmd> recuerda la conexión: desde ahora basta con escribir <Cmd>git push</Cmd> o{' '}
            <Cmd>git pull</Cmd>.
          </p>
        </>
      ),
      suggest: ['git push -u origin main'],
      check: ({ world }) => !!world.repo && serverMain(world) === headId(world.repo),
      solution: ['git push -u origin main'],
      done: (
        <p>
          Aparece una etiqueta con una nube: <b>origin/main</b> es dónde está main en el servidor. Las estaciones
          dejaron de decir «solo en tu compu».
        </p>
      ),
    },
    {
      id: 'ana-1',
      title: 'Mientras tanto, Ana trabaja',
      body: (
        <>
          <p>
            Ana usa el mismo proyecto desde su computador. Usa el botón para simular que sube un cambio al servidor.
          </p>
        </>
      ),
      actions: [anaNotas],
      check: ({ ran }) => ran(/^\[evento\]/),
      solution: ['@0'],
      done: (
        <p>
          El servidor ahora tiene algo que tú <b>no tienes</b>. Tu mapa todavía no lo sabe: Git solo mira internet
          cuando se lo pides.
        </p>
      ),
    },
    {
      id: 'fetch',
      title: 'Mira qué hay de nuevo',
      body: (
        <p>
          <Cmd>git fetch</Cmd> consulta el servidor y trae la información, pero <b>no toca tus archivos</b>.
        </p>
      ),
      suggest: ['git fetch'],
      check: ({ world }) => {
        const r = world.repo;
        return !!r && !!r.tracking['origin/main'] && r.tracking['origin/main'] !== r.branches.main;
      },
      solution: ['git fetch'],
      done: (
        <p>
          En el mapa, <b>origin/main</b> está un paso por delante de tu <b>main</b>. Sabes que hay novedades, pero
          tu carpeta sigue igual.
        </p>
      ),
    },
    {
      id: 'pull',
      title: 'Tráelo a tu carpeta',
      body: (
        <p>
          <Cmd>git pull</Cmd> hace un <Term k="fetch">fetch</Term> y además une lo nuevo con tu rama.
        </p>
      ),
      suggest: ['git pull'],
      check: ({ world }) => {
        const r = world.repo;
        return !!r && r.branches.main === r.tracking['origin/main'] && world.files['ana-notas.txt'] !== undefined;
      },
      solution: ['git pull'],
      done: <p>El archivo de Ana apareció en tu carpeta y tu main alcanzó a origin/main.</p>,
    },
    {
      id: 'local',
      title: 'Ahora trabajas tú',
      body: (
        <p>
          Agrega una tarea y guárdala: <Cmd>echo "- revisar presupuesto" &gt;&gt; tareas.txt</Cmd> y luego{' '}
          <Cmd>git commit -am "Agrego una tarea"</Cmd>.
        </p>
      ),
      suggest: ['echo "- revisar presupuesto" >> tareas.txt', 'git commit -am "Agrego una tarea"'],
      check: ({ world, before }) => {
        const r = world.repo;
        return (
          Object.keys(world.commits).length > Object.keys(before.commits).length &&
          !!r &&
          r.branches.main !== r.tracking['origin/main']
        );
      },
      solution: ['echo "- revisar presupuesto" >> tareas.txt', 'git commit -am "Agrego una tarea"'],
      done: (
        <p>
          Tu estación nueva dice «solo en tu compu»: está guardada, pero todavía nadie más la ve. Falta subirla.
        </p>
      ),
    },
    {
      id: 'ana-2',
      title: 'Ana se adelanta otra vez',
      body: (
        <p>
          Antes de que subas, Ana publica otra cosa. Esto es lo que pasa seguido en equipos reales. Simúlalo:
        </p>
      ),
      actions: [anaAgenda],
      check: ({ ran }) => ran(/^\[evento\]/),
      solution: ['@0'],
    },
    {
      id: 'rejected',
      title: 'Intenta subir: te lo rechazan',
      body: (
        <p>
          Prueba <Cmd>git push</Cmd>. El servidor tiene un commit que tú no tienes, así que no te dejará pisarlo.
        </p>
      ),
      suggest: ['git push'],
      check: ({ tried, world }) =>
        tried(/^git push/) && !!world.repo && serverMain(world) !== headId(world.repo),
      solution: ['git push'],
      done: (
        <p>
          Rechazado, y es <b>bueno</b>: Git te protege de borrar el trabajo de Ana. La solución es traer primero lo
          suyo.
        </p>
      ),
    },
    {
      id: 'pull-merge',
      title: 'Trae lo de Ana y únelo con lo tuyo',
      body: (
        <p>
          <Cmd>git pull</Cmd> otra vez. Esta vez las dos partes avanzaron, así que Git crea un commit de fusión.
        </p>
      ),
      suggest: ['git pull'],
      check: ({ world }) => {
        const h = world.repo ? headId(world.repo) : null;
        return !!h && world.commits[h].parents.length === 2;
      },
      solution: ['git pull'],
      done: <p>Mira el mapa: tu línea y la de Ana se unieron en un transbordo.</p>,
    },
    {
      id: 'push-ok',
      title: 'Ahora sí: sube',
      body: (
        <p>
          <Cmd>git push</Cmd>
        </p>
      ),
      suggest: ['git push'],
      check: ({ world }) => !!world.repo && serverMain(world) === headId(world.repo),
      solution: ['git push'],
      done: (
        <p>
          Ciclo completo: <b>pull → trabajar → push</b>. Hazlo así y rara vez tendrás sorpresas.
        </p>
      ),
    },
  ],
};
