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
