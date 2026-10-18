/** Chuleta de comandos: lo que hace cada uno y cuándo conviene usarlo. */

/** Los cuatro lugares por donde viajan tus cambios. */
export const ZONES = ['Tu carpeta', 'Preparados', 'Historial', 'Remoto'] as const;

export interface CommandInfo {
  cmd: string;
  /** Qué hace, en una frase sin jerga. */
  what: string;
  /** En qué situación se usa. */
  when: string;
  /** Si mueve cambios de un lugar a otro: índices en ZONES. */
  from?: number;
  to?: number;
  /** Si solo mira o toca un lugar (sin mover nada): índices en ZONES. */
  at?: number[];
}

export interface CommandGroup {
  id: string;
  title: string;
  tagline: string;
  /** Variable de color de la línea (ver styles.css). */
  color: string;
  commands: CommandInfo[];
}

export const COMMAND_GROUPS: CommandGroup[] = [
  {
    id: 'empezar',
    title: 'Empezar',
    tagline: 'Dejar listo un proyecto para que Git lo vigile.',
    color: 'var(--color-line-main)',
    commands: [
      {
        cmd: 'git init',
        what: 'Convierte la carpeta en un repositorio: Git empieza a vigilarla.',
        when: 'Cuando arrancas un proyecto nuevo desde cero.',
        at: [2],
      },
      {
        cmd: 'git clone <dirección>',
        what: 'Descarga una copia completa de un proyecto que vive en internet, con todo su historial.',
        when: 'Cuando quieres trabajar en un proyecto que ya existe (por ejemplo, en GitHub).',
        from: 3,
        to: 0,
      },
      {
        cmd: 'git config --global user.name "Tu nombre"',
        what: 'Le dice a Git quién eres para firmar tus commits. Lo mismo con user.email.',
        when: 'Una sola vez, cuando instalas Git en una computadora nueva.',
        at: [2],
      },
    ],
  },
  {
    id: 'guardar',
    title: 'Guardar cambios',
    tagline: 'El ciclo de todos los días: ver, preparar y guardar.',
    color: 'var(--color-line-2)',
    commands: [
      {
        cmd: 'git status',
        what: 'Muestra qué archivos cambiaron y cuáles están listos para guardarse.',
        when: 'Siempre que dudes de cómo está tu proyecto. Es el comando más usado.',
        at: [0, 1],
      },
      {
        cmd: 'git add <archivo>',
        what: 'Pasa un archivo a “Preparados”: lo eliges para el próximo guardado.',
        when: 'Cuando terminaste de cambiar algo y quieres que entre en el siguiente commit.',
        from: 0,
        to: 1,
      },
      {
        cmd: 'git add .',
        what: 'Prepara todos los cambios de la carpeta de una vez.',
        when: 'Cuando todo lo que cambiaste pertenece al mismo guardado.',
        from: 0,
        to: 1,
      },
      {
        cmd: 'git commit -m "mensaje"',
        what: 'Guarda un punto en la historia con lo que está preparado, más un mensaje que explica el cambio.',
        when: 'Cuando completaste una pieza de trabajo con sentido propio (una función, un arreglo).',
        from: 1,
        to: 2,
      },
      {
        cmd: 'git commit -am "mensaje"',
        what: 'Atajo: prepara los archivos que ya conocía Git y guarda, en un solo paso.',
        when: 'Para cambios rápidos en archivos que ya estaban en el proyecto. No incluye archivos nuevos.',
        from: 0,
        to: 2,
      },
      {
        cmd: 'git diff',
        what: 'Enseña línea por línea qué cambió y todavía no has preparado.',
        when: 'Antes de hacer add, para revisar que no se te cuele nada raro.',
        at: [0],
      },
    ],
  },
  {
    id: 'historial',
    title: 'Mirar el historial',
    tagline: 'Viajar al pasado sin cambiar nada.',
    color: 'var(--color-line-4)',
    commands: [
      {
        cmd: 'git log',
        what: 'Lista los commits uno tras otro, del más nuevo al más viejo.',
        when: 'Para saber qué se ha hecho en el proyecto y quién lo hizo.',
        at: [2],
      },
      {
        cmd: 'git log --oneline --graph --all',
        what: 'Lo mismo, pero una línea por commit y dibujando las ramas como un mapa.',
        when: 'Cuando hay varias ramas y quieres ver cómo se cruzan.',
        at: [2],
      },
      {
        cmd: 'git show <commit>',
        what: 'Abre un commit y muestra exactamente qué cambió en él.',
        when: 'Cuando algo se rompió y quieres ver qué tocó ese guardado.',
        at: [2],
      },
      {
        cmd: 'git diff <rama1> <rama2>',
        what: 'Compara dos ramas o dos commits y muestra sus diferencias.',
        when: 'Antes de unir ramas, para saber qué va a entrar.',
        at: [2],
      },
    ],
  },
  {
    id: 'ramas',
    title: 'Ramas',
    tagline: 'Líneas paralelas para probar cosas sin riesgo.',
    color: 'var(--color-line-1)',
    commands: [
      {
        cmd: 'git branch',
        what: 'Lista tus ramas y marca en cuál estás.',
        when: 'Para ubicarte: “¿en qué línea estoy parado?”.',
        at: [2],
      },
      {
        cmd: 'git switch -c <nombre>',
        what: 'Crea una rama nueva y te mueve a ella.',
        when: 'Cuando vas a empezar algo nuevo (una idea, un arreglo) y no quieres tocar la rama principal.',
        at: [2],
      },
      {
        cmd: 'git switch <nombre>',
        what: 'Te cambia a otra rama que ya existe.',
        when: 'Para volver a la principal o saltar entre tareas.',
        at: [0, 2],
      },
      {
        cmd: 'git merge <nombre>',
        what: 'Une los cambios de otra rama dentro de la rama en la que estás.',
        when: 'Cuando tu idea ya funciona y quieres sumarla a la línea principal.',
        from: 2,
        to: 2,
      },
      {
        cmd: 'git branch -d <nombre>',
        what: 'Borra una rama que ya fue unida.',
        when: 'Para limpiar después de un merge. Git avisa si todavía hay trabajo sin unir.',
        at: [2],
      },
    ],
  },
  {
    id: 'remoto',
    title: 'Trabajar con otros',
    tagline: 'Compartir tu trabajo y recibir el de los demás.',
    color: 'var(--color-line-5)',
    commands: [
      {
        cmd: 'git remote add origin <dirección>',
        what: 'Conecta tu proyecto con una copia en internet y le pone el nombre “origin”.',
        when: 'Cuando creas un repositorio vacío en GitHub y quieres enlazarlo con el tuyo.',
        at: [3],
      },
      {
        cmd: 'git push',
        what: 'Sube tus commits al remoto.',
        when: 'Cuando quieres respaldar tu trabajo o que otros lo vean.',
        from: 2,
        to: 3,
      },
      {
        cmd: 'git fetch',
        what: 'Mira qué hay de nuevo en el remoto, sin tocar tus archivos.',
        when: 'Para enterarte de lo que hizo el equipo antes de decidir si lo traes.',
        from: 3,
        to: 2,
      },
      {
        cmd: 'git pull',
        what: 'Trae los cambios nuevos del remoto y los une con los tuyos (fetch + merge).',
        when: 'Al empezar el día o antes de subir, para estar al día con el equipo.',
        from: 3,
        to: 0,
      },
    ],
  },
  {
    id: 'deshacer',
    title: 'Deshacer',
    tagline: 'Para cuando algo salió mal. Casi todo tiene arreglo.',
    color: 'var(--color-line-3)',
    commands: [
      {
        cmd: 'git restore <archivo>',
        what: 'Descarta los cambios de un archivo y lo deja como en el último commit.',
        when: 'Cuando probaste algo, no te gustó, y quieres volver atrás. Ojo: esos cambios se pierden.',
        from: 2,
        to: 0,
      },
      {
        cmd: 'git restore --staged <archivo>',
        what: 'Saca un archivo de “Preparados” sin perder sus cambios.',
        when: 'Cuando hiciste add de algo por error y no quieres que entre en el commit.',
        from: 1,
        to: 0,
      },
      {
        cmd: 'git commit --amend',
        what: 'Corrige el último commit: cambia su mensaje o le suma algo que olvidaste.',
        when: 'Justo después de commitear, si te equivocaste en el texto o faltó un archivo. Solo si aún no lo subiste.',
        from: 1,
        to: 2,
      },
      {
        cmd: 'git revert <commit>',
        what: 'Crea un commit nuevo que cancela lo que hizo otro. La historia no se borra.',
        when: 'Para deshacer algo que ya compartiste con otros. Es la forma segura.',
        at: [2],
      },
      {
        cmd: 'git reset --hard <commit>',
        what: 'Regresa todo el proyecto a un commit anterior y descarta lo posterior.',
        when: 'Solo en trabajo tuyo que no has subido. Es peligroso: borra cambios sin preguntar.',
        from: 2,
        to: 0,
      },
      {
        cmd: 'git reflog',
        what: 'Muestra el diario de por dónde has estado, incluso commits que “desaparecieron”.',
        when: 'Tu salvavidas: cuando crees que perdiste trabajo tras un reset o un cambio de rama.',
        at: [2],
      },
    ],
  },
  {
    id: 'extras',
    title: 'Extras útiles',
    tagline: 'Herramientas pequeñas que sacan de apuros.',
    color: 'var(--color-line-2)',
    commands: [
      {
        cmd: 'git stash',
        what: 'Guarda en un cajón tus cambios a medias y deja la carpeta limpia.',
        when: 'Cuando necesitas cambiar de rama urgente pero no quieres hacer un commit a medias.',
        from: 0,
        to: 2,
      },
      {
        cmd: 'git stash pop',
        what: 'Saca del cajón lo último que guardaste y lo devuelve a tu carpeta.',
        when: 'Al volver a lo que estabas haciendo.',
        from: 2,
        to: 0,
      },
      {
        cmd: 'git tag <nombre>',
        what: 'Le pone una etiqueta fija a un commit, como “v1.0”.',
        when: 'Para marcar versiones importantes que quieras encontrar fácil.',
        at: [2],
      },
      {
        cmd: 'git rm <archivo>',
        what: 'Borra un archivo y deja anotado el borrado para el próximo commit.',
        when: 'Cuando un archivo ya no hace falta en el proyecto.',
        from: 0,
        to: 1,
      },
      {
        cmd: 'git mv <viejo> <nuevo>',
        what: 'Renombra o mueve un archivo avisándole a Git.',
        when: 'Para que Git entienda que es el mismo archivo y no uno borrado y otro nuevo.',
        from: 0,
        to: 1,
      },
    ],
  },
];
