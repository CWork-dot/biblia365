# Biblia en un Año · Asociación San Juan Apóstol — Guía de despliegue (con Firebase)

Esta carpeta contiene la app de lectura **y** el panel de coordinador,
conectados a tu proyecto de Firebase (`biblia-asja-4aea4`).

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La app que usan los lectores (con el plan de 365 días embebido) |
| `coordinador.html` | El panel donde vos ves el progreso de todos |
| `app-firebase.js` | Lógica de la app de lectura (conecta a Firestore) |
| `coordinador.js` | Lógica del panel (lee todos los usuarios) |
| `shared.css` | Estilos de ambas páginas (identidad ASJA) |
| `manifest.webmanifest` | Configuración para que se pueda instalar como app |
| `icon-logo.png` | Logo ASJA usado en ambas páginas |
| `firestore.rules` | Reglas de seguridad — **pegar en la consola de Firebase**, no se sube a GitHub |

## Novedad: sugerencia de nombre

Cada dispositivo recuerda el último nombre usado en él y lo precarga automáticamente en el campo al abrir la app — así no hay que tipearlo cada vez. Si otra persona usa el mismo teléfono, simplemente borra el campo y escribe el suyo, igual que siempre; a partir de ahí el dispositivo va a sugerir ese nombre nuevo. Esto se guarda solo en el teléfono (no en la nube), así que no afecta el progreso de nadie ni este paso requiere tocar nada en Firebase.

## Arreglo: la app ahora funciona sin conexión

Hasta ahora la app nunca tuvo un Service Worker real — por eso, al abrirla sin internet (sobre todo la primera vez desde el ícono instalado), Chrome mostraba su error nativo de "sin conexión" (el dinosaurio) en vez de cargar la app.

Agregué un archivo nuevo, **`sw.js`** (Service Worker), que guarda una copia local de los archivos propios de la app (`index.html`, `coordinador.html`, `app-firebase.js`, `coordinador.js`, `shared.css`, `manifest.webmanifest`, `icon-logo.png`) la primera vez que se visita con conexión. A partir de ahí, cualquier apertura posterior —con o sin internet— carga desde esa copia local.

**Importante — esto tiene un límite que ninguna app puede evitar:** la primerísima vez que alguien abre la app, tiene que haber conexión, aunque sea breve. Es imposible que un teléfono muestre contenido que nunca llegó a descargar. Pero a partir de esa primera apertura con internet, todas las siguientes funcionan sin conexión — incluso reabriendo el ícono de la pantalla de inicio días después.

Las llamadas a Firebase (donde vive el progreso de lectura) **no** pasan por este caché — siguen funcionando exactamente igual que antes, con su propio mecanismo de sincronización offline.

**Para que esto funcione, subí también el archivo nuevo `sw.js`** a la raíz del repositorio, junto con los demás. No requiere ningún cambio en Firebase ni en las reglas.

### Si alguien ya tiene la app instalada de antes

Las personas que ya instalaron la PWA antes de este cambio van a necesitar abrir la app **una vez con conexión** después de que subas estos archivos nuevos, para que el Service Worker se registre por primera vez. A partir de esa visita, el offline va a funcionar para ellos también.

## Cambio: la racha ahora se mide por días calendario reales

Antes, "racha" contaba días del plan consecutivos (día 1, día 2, día 3...) sin importar cuándo los leíste en el calendario — podías leer el día 1 un lunes y el día 2 recién el viernes, y la app igual decía "racha: 2".

Ahora la racha mide **constancia real**: cuántos días de calendario consecutivos completaste al menos una lectura del plan. Si te saltás un día completo sin leer nada, la racha se corta a 0 — sin margen de tolerancia.

- Completar dos o más días del plan el mismo día calendario (por ejemplo, "ponerse al día" leyendo varios capítulos juntos) cuenta como **un solo día** de racha, no como varios.
- El panel de coordinador calcula la racha de la misma forma, así que coincide con lo que ve cada usuario.
- Los usuarios que ya tenían progreso antes de este cambio no tienen historial de fechas — van a empezar a acumular racha por calendario desde la primera vez que usen la versión nueva.

**Importante:** esta vez `firestore.rules` también cambió (nuevo campo `fechasCompletadas`). Volvé a publicar las reglas en Firebase.

## Cambio: ahora se pide mail en vez de nombre

Para evitar registros duplicados (alguien escribiendo "Juan Pérez" dos veces de formas distintas), la app ahora identifica a cada persona por su **mail** en vez de su nombre. El mail se normaliza (minúsculas, sin espacios extra) antes de guardar, así que variantes como `Maria@Gmail.com` y `maria@gmail.com` siempre apuntan al mismo registro.

- Se valida que tenga formato de mail básico (`algo@algo.algo`) antes de aceptarlo.
- El panel de coordinador ahora muestra el mail en la columna donde antes mostraba el nombre.
- **Los usuarios que ya venían usando la app con nombre quedan como registros separados** — no se migra nada automáticamente. Cuando esa persona entre con su mail por primera vez, va a empezar de cero. Si en algún momento querés fusionar un progreso viejo con el nuevo, hay que hacerlo a mano desde la consola de Firebase.

**Importante:** esta vez `firestore.rules` SÍ cambió otra vez (el campo permitido pasó de `nombre` a `email`, con su propia validación). Tenés que volver a pegar las reglas nuevas en Firebase (Paso 1 de abajo) o las escrituras van a empezar a fallar.

## Arreglo: la app ahora recuerda en qué día te quedaste

Antes, cada vez que se cerraba y volvía a abrir la app, siempre mostraba el día 1 — eso hacía parecer que se "tildaba sola" una lectura, cuando en realidad era el estado real (viejo) del día 1 que ya tenías marcado de antes. Ahora la app guarda el último día que visitaste y te lleva directo ahí la próxima vez que entrás.

**Importante:** este arreglo agrega un campo nuevo (`ultimoDia`) al documento de cada usuario en Firestore. Por eso, además de subir los archivos a GitHub, tenés que **volver a publicar las reglas de Firestore** (el archivo `firestore.rules` cambió para permitir este campo nuevo) — repetí el Paso 1 de abajo aunque ya lo hayas hecho antes.

## Novedad: tildado independiente por lectura

Cada día puede tener hasta 3 lecturas (primera lectura, segunda lectura, salmo/proverbio). Ahora cada una se tilda por separado, y el día solo se cuenta como **completado** cuando todas sus lecturas están tildadas. En la pestaña "Lista completa" vas a ver tres estados visuales: círculo vacío (sin empezar), círculo con un punto celeste (a mitad de camino), círculo azul lleno con check (completo).

Si ya tenías usuarios con progreso guardado de antes de este cambio, sus días marcados como completos siguen contando como completos — no se pierde nada.

## Paso 1 — Pegar las reglas de seguridad en Firebase

1. Entrá a [console.firebase.google.com](https://console.firebase.google.com) → tu proyecto `biblia-asja-4aea4`.
2. Menú izquierdo → **Firestore Database** → pestaña **"Reglas" / "Rules"**.
3. Borrá lo que haya y pegá el contenido completo del archivo `firestore.rules` de esta carpeta.
4. Clic en **"Publicar" / "Publish"**.

Esto es importante: sin estas reglas, **cualquiera podría leer o escribir cualquier cosa** en tu base de datos (el modo de prueba que activaste al crear Firestore es totalmente abierto y caduca a los 30 días). Con estas reglas:
- Cualquiera puede leer el progreso de todos (lo necesita el panel).
- Cada persona puede crear/actualizar **solo su propio documento**, y solo con los campos esperados (no puede inyectar datos raros).
- Nadie puede borrar nada desde la app.

## Paso 2 — Subir los archivos a GitHub Pages

Igual que la vez anterior:

1. En tu repositorio de GitHub (el mismo `biblia365` de antes, o uno nuevo).
2. **Add file → Upload files** → arrastrá **todos los archivos de esta carpeta** (excepto `firestore.rules`, que no va en GitHub — ese se pega únicamente en la consola de Firebase).
3. Commit changes.
4. Confirmá que `index.html` esté en la raíz del repo (no dentro de una subcarpeta) para que GitHub Pages lo sirva como página principal.

A los 1-2 minutos, tu app va a estar en:
```
https://TU-USUARIO.github.io/biblia365/
```
y el panel de coordinador en:
```
https://TU-USUARIO.github.io/biblia365/coordinador.html
```

## Paso 3 — Cambiar la contraseña del panel de coordinador

Por defecto la contraseña es `asja2026`. Para cambiarla:

1. Abrí `coordinador.js`.
2. Buscá la línea:
   ```js
   const COORD_PASSWORD = "asja2026";
   ```
3. Cambiala por la que quieras y volvé a subir el archivo a GitHub.

**Importante:** esta contraseña es solo para que un visitante casual no entre por accidente al panel — cualquiera que mire el código fuente de la página puede verla. La protección real de los datos (que nadie pueda alterar el progreso de otra persona) la dan las reglas de Firestore del Paso 1, no esta contraseña. Si necesitás seguridad más fuerte en el futuro (por ejemplo, login con email y contraseña real), se puede agregar Firebase Authentication — avisame y lo armamos.

## Paso 4 — Autorizar tu dominio en Firebase (si hace falta)

Si al abrir la app en GitHub Pages ves un error de "dominio no autorizado":

1. Consola de Firebase → **Authentication** → pestaña **"Settings" → "Authorized domains"**.
2. Agregá `TU-USUARIO.github.io`.

(Esto normalmente no es necesario para Firestore solo, pero si en el futuro agregás login, sí.)

## Cómo probar que todo funciona

1. Abrí `index.html` en el celular, escribí un nombre de prueba, marcá un día.
2. Abrí `coordinador.html` en la computadora, entrá con la contraseña.
3. Deberías ver ese nombre de prueba en la tabla, con 1 día completado.
4. Si no aparece: revisá que las reglas de Firestore estén publicadas (Paso 1) y que no haya errores en la consola del navegador (F12 → pestaña "Console").

## Límites del plan gratuito (recordatorio)

- 50.000 lecturas y 20.000 escrituras por día — sin vencimiento, no caduca nunca.
- Para una comunidad de cientos de personas usando la app a diario, esto alcanza sin problema.
- Vinculaste una tarjeta para habilitar Firestore, pero mientras no superes esos límites diarios, no se cobra nada. Recomendado: poné una alerta de presupuesto en $1 en Google Cloud Billing por tranquilidad.
