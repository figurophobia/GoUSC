# GoUSC

Juego de Go online (9×9, 13×13 y 19×19) con backend **Spring Boot 4** y base de datos
**PostgreSQL 17**. Estilo de código siguiendo el ejemplo de clase
[rest-example](https://gitlab.citius.gal/docencia/es/rest-example): capas
controller → service → repository → entity, DTOs como *records* y errores con
`ProblemDetail`.

## Resumen

- **Backend (Spring Boot 4.1 + Java 26 + PostgreSQL 17):** usuarios con registro, login y
  perfil editable; partidas de Go 9×9, 13×13 y 19×19 con capturas, regla de ko, pasar,
  abandonar y puntuación al terminar; modos Casual y Ranked con ELO (K=32) y ranking;
  amigos, mensajes privados y chat de partida. Las contraseñas no salen en la API.
- **Frontend propio (HTML/CSS/JS sin frameworks):** sello 碁 con la firma «USC», tablero
  de madera y piedras dibujados en el navegador, sonidos sintetizados, tema oscuro y claro,
  lobby con partida rápida, modo espectador, perfil con historial, actualización
  automática y un **tutorial interactivo** de 11 lecciones para aprender a jugar.
- **Calidad:** Lombok en todo el backend y 38 tests (reglas, ELO, ranking y endpoints).
- **Despliegue:** imagen Docker y `compose.prod.yaml` para jugar desde cualquier
  ordenador o móvil de la red con un solo comando.

## Estado del proyecto

| Fase | Contenido | Estado |
|------|-----------|--------|
| 1 | Base de datos, entidades, DTOs, repositorios, servicios, reglas del Go, ELO, test de reglas | ✅ Hecha |
| 2 | Controllers REST + manejo global de errores + prueba end-to-end | ✅ Hecha |
| 3 | Probar y pulir el backend: tests automáticos de los endpoints y validación de los datos de entrada | ✅ Hecha |
| 4 | Frontend con HTML + JavaScript vanilla | ✅ Hecha |
| 5 | Testear el leaderboard: tests automáticos del ranking y de los cambios de ELO | ✅ Hecha |
| 6 | Despliegue: publicar el backend (Docker) para que el frontend se conecte desde cualquier máquina | ✅ Hecha |

**Comprobaciones actuales:** `./mvnw test` → 38/38 tests OK: 9 de reglas del Go, 5 de
cálculo de ELO, 8 del leaderboard contra la BD real, 15 de endpoints (MockMvc) y la carga
de contexto. Prueba manual E2E de todos los endpoints
verificada y test end-to-end de navegador (Chrome CDP) con 41 comprobaciones OK:
navegación entre vistas, edición de perfil, actualización automática de lobby/ranking/
amigos/chats, snap del tablero, avisos, login, responsive móvil y 0 errores de consola.

## Puesta en marcha

Hay dos formas de arrancar GoUSC según lo que quieras hacer.

### Para jugar: despliegue con Docker

Solo hace falta **Docker con Compose** (no Java ni PostgreSQL):

```bash
docker compose -f compose.prod.yaml up -d --build
```

Arranca la base de datos y la aplicación en contenedores. Cuando
`docker compose -f compose.prod.yaml ps` muestre la app como `healthy`, abre
**http://localhost:8080** o, desde otro ordenador o móvil de la misma red,
**http://IP-de-la-máquina:8080** (la IP sale con `hostname -I`).

```bash
docker compose -f compose.prod.yaml logs -f app   # ver los logs de la aplicación
docker compose -f compose.prod.yaml down          # parar (los datos se conservan)
docker compose -f compose.prod.yaml down -v       # parar y borrar los datos (empezar de cero)
```

Usuarios de prueba: `deivi/deivi123`, `ana/ana123`, `joel/joel123`, `pepe/pepe123`.
Para cambiar el puerto o la contraseña de la base de datos: `cp .env.example .env` y
edita `.env`.

Configuración (puerto, contraseña de la base de datos), copias de seguridad,
actualizaciones y solución de problemas: **[docs/deploy.md](docs/deploy.md)**.

### Para programar: modo desarrollo

Requisitos: JDK 26+ y Docker con Compose.

```bash
./mvnw spring-boot:run   # arranca PostgreSQL (compose.yaml) y la app en http://localhost:8080
./mvnw test              # 38 tests (necesitan el PostgreSQL de compose.yaml en marcha)
```

`./mvnw spring-boot:run` levanta solo la base de datos de `compose.yaml` gracias al módulo
`spring-boot-docker-compose`; la aplicación corre en tu JDK con recarga de DevTools. Si
solo quieres la base de datos: `docker compose up -d`.

Al arrancar se crea el esquema (JPA `generate-ddl`) y se siembran 4 usuarios de prueba
(idempotente): `deivi/deivi123`, `ana/ana123`, `joel/joel123`, `pepe/pepe123`.

## Estructura del proyecto

```
GoUSC/
├── compose.yaml                     # Desarrollo: solo PostgreSQL 17 (lo arranca Spring Boot)
├── compose.prod.yaml                # Despliegue: PostgreSQL + aplicación en contenedores
├── Dockerfile                       # Imagen de la aplicación (build multi-etapa, JRE Alpine)
├── .env.example                     # Plantilla de configuración del despliegue (puerto, BD)
├── pom.xml                          # Spring Boot 4.1.1 + Lombok (lo mínimo, sin más librerías)
├── docs/
│   ├── backend.md                   # Guía técnica completa: capas, cada archivo, API y diagramas
│   ├── database.md                  # Diseño de la base de datos (entidades, columnas, decisiones)
│   ├── deploy.md                    # Guía de despliegue con Docker (Fase 6)
│   └── database.png / .svg          # Diagrama ER en imagen
├── src/main/java/com/usc/boardgames/gousc/
│   ├── GoUscApplication.java        # Arranque de la aplicación
│   ├── controller/                  # HTTP: users, games, friendships, messages + ErrorController
│   ├── service/                     # Lógica: UserService, GameService, GoRules, EloService,
│   │                                # FriendshipService, MessageService
│   ├── repository/                  # JPA: UserRepository, GameRepository, FriendshipRepository,
│   │                                # MessageRepository
│   ├── model/
│   │   ├── entity/                  # Tablas: User, Game, Friendship, Message + enums de dominio
│   │   └── dto/                     # Records expuestos por la API + @JsonView (Views)
│   ├── exception/                   # Excepciones de dominio (checked) → 404/409/400/401
│   └── ...
└── src/main/resources/
    ├── application.properties       # DataSource, JPA, Jackson (indent + JsonView)
    ├── sql/users.sql                # Semilla idempotente de usuarios
    └── static/                      # Frontend (se sirve en http://localhost:8080)
        ├── index.html               # Vista única: login, lobby, ranking, amigos, chat, aprender, perfil y partida
        ├── css/style.css            # Sistema de diseño (temas oscuro/claro, responsive)
        ├── js/app.js                # Toda la lógica del cliente (sin dependencias)
        └── favicon.svg              # Icono: sello rojo con piedras
```

## API REST (resumen)

Autenticación: sin spring-security. El cliente identifica al usuario con la cabecera
**`X-User-Id`** tras hacer login en `POST /users/login`.

| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/users` | Registro (201 + `Location`) |
| POST | `/users/login` | Login por usuario+contraseña (401 si no coinciden) |
| GET | `/users?page&size&sort` | Listado paginado |
| GET | `/users/ranking` | Clasificación por ELO |
| GET / PUT | `/users/{id}` | Consulta / actualización (nombre, email, contraseña) |
| POST | `/games` | Crear partida (WAITING) |
| GET | `/games?status&player` | Listar partidas (todas, por estado o por jugador) |
| GET | `/games/{id}` | Detalle (tablero serializado en JSON) |
| POST | `/games/{id}/join` | Unirse (pasa a ACTIVE) |
| POST | `/games/{id}/leave` | Abandonar (ABANDONED, gana el rival si había juego) |
| POST | `/games/{id}/moves` | Jugada: `{x,y,pass:false}` o `{pass:true}` |
| GET / POST | `/games/{id}/messages` | Chat de la partida |
| POST | `/friendships` | Enviar solicitud (`{addresseeId}`) |
| POST | `/friendships/{id}/accept` · `/reject` | Responder solicitud |
| GET | `/friendships` · `/friendships/pending` | Amigos / solicitudes recibidas |
| POST | `/messages?to={id}` | Mensaje privado |
| GET | `/messages?with={id}` | Conversación privada |

Errores en formato `application/problem+json` (`type`, `title`, `detail`, `status`,
`instance`): 404 inexistente, 409 duplicado/estado inválido, 400 jugada inválida,
401 credenciales. Detalle completo en la [guía de API](docs/backend.md#3-api-rest).

## Documentación

- **[docs/backend.md](docs/backend.md)** — guía técnica: arquitectura por capas, qué hace
  cada archivo, endpoints con ejemplos, reglas del Go, ELO y diagramas de funcionamiento
  (secuencias, flujo de jugada, fin de partida, amistades, chat).
- **[docs/database.md](docs/database.md)** — modelo de datos: diagrama ER, columnas de
  cada tabla y decisiones de diseño. Imagen: [database.png](docs/database.png).
- **[docs/deploy.md](docs/deploy.md)** — despliegue con Docker: arrancar en 3 pasos,
  conectarse desde otra máquina, configuración, copias de seguridad, cómo está hecha la
  imagen y solución de problemas.

## Qué queda por hacer

Las seis fases del plan están hechas. Lo que faltaría para ir más allá:

1. **Seguridad real.** Hoy cualquiera puede hacerse pasar por otro usuario con la cabecera
   `X-User-Id` y las contraseñas se guardan sin cifrar. Haría falta autenticación con
   JWT, contraseñas cifradas con BCrypt y HTTPS. Hasta entonces no conviene abrir GoUSC a
   Internet; para clase o una red local vale.
2. **Tiempo real.** Las partidas y el chat se refrescan consultando al servidor cada
   2,5 s; con WebSockets o SSE llegarían al instante.
3. **Extras opcionales:** reloj de partida y publicar la imagen en GitHub (GHCR)
   automáticamente con GitHub Actions.

## Funcionalidades del frontend

Diseño propio inspirado en la sobriedad de Lichess, con identidad de Go: sello *hanko*
rojo con el kanji 碁 y la firma «USC» en negro, tablero de madera de kaya, piedras de pizarra y concha y tipografía
Shippori Mincho. Todos los recursos (veta de la madera, piedras, sonidos, iconos) se
generan en el propio cliente: no se usan imágenes ni sonidos de terceros.

- **Acceso**: pantalla dividida con tablero decorativo y formulario de entrada/registro
  (al registrarse se inicia sesión automáticamente).
- **Lobby**: *partida rápida* con 6 botones (9×9/13×13/19×19 × Casual/Ranked), pestañas
  de salas abiertas / en juego / terminadas que se actualizan solas, tarjeta con tus
  estadísticas, top 5 del ranking y un proverbio de Go diferente cada día.
- **Partida**: goban en canvas con veta de madera procedural, fila 1 abajo como en un
  tablero real, piedra fantasma al pasar el ratón, última jugada marcada, lista de
  jugadas numerada, presas, pasar/abandonar con confirmación, pantalla de espera de
  rival, resultado con puntuación y cambio de ELO, chat de partida y modo espectador.
- **Aprender**: tutorial interactivo de 11 lecciones sobre un tablero 9×9: el tablero,
  libertades, capturas, grupos, atari, suicidio, la excepción de capturar, ko, dos ojos,
  territorio con komi y consejos para empezar. Cada lección tiene un ejercicio que se
  comprueba al momento (con reglas del Go propias en el cliente), marca las libertades o
  el territorio sobre el tablero y explica por qué una jugada no vale. El progreso se
  guarda en el navegador y desde el lobby hay un acceso «¿Nuevo en el Go?».
- **Sonido**: golpe de piedra, capturas y avisos sintetizados con WebAudio (se puede
  silenciar). La pestaña avisa con «● Tu turno».
- **Ranking**: podio de los tres primeros + tabla con ELO, victorias, derrotas y % de victorias.
- **Amigos y chat**: solicitudes por ID con contador en la navegación y conversaciones
  privadas estilo mensajería.
- **Perfil**: avatar con color propio, ID copiable, estadísticas, historial y edición.
- **Temas**: oscuro y claro (papel *washi*), recordado entre visitas.
- **Responsive**: sin scroll horizontal en móvil (probado a 390 px) y `prefers-reduced-motion`.

## Historial de cambios

### Iteración actual — Tutorial «Aprender»

- Nueva sección **Aprender** en la navegación (y acceso desde el lobby) con 11 lecciones
  interactivas para aprender las reglas y los movimientos básicos del Go.
- `js/app.js`: reglas del Go en el cliente (`LocalGo`: captura, suicidio, ko y territorio,
  con la misma lógica que `GoRules`) usadas solo por el tutorial; las partidas reales las
  sigue validando el servidor. `Board.draw` acepta marcas (libertades, territorio,
  objetivo y jugada rechazada).
- README con resumen del proyecto, comandos de Docker y lo que queda por hacer.
- **Verificado** con Chrome headless: las 11 lecciones se completan, las jugadas
  incorrectas e ilegales muestran su explicación, el progreso se guarda, funciona en tema
  claro, tablet y móvil (sin scroll horizontal) y 0 errores de consola.

### Fase 6: despliegue con Docker

- **`Dockerfile`** multi-etapa: compila con el JDK 26 y el Maven Wrapper, y la imagen
  final solo lleva el JRE 26 Alpine y el jar extraído por capas (≈ 414 MB). Corre con un
  usuario sin privilegios y tiene `HEALTHCHECK`.
- **`compose.prod.yaml`**: PostgreSQL + aplicación. La base de datos no publica puertos
  y sus datos van a un volumen propio, separado del de desarrollo. Arranque con un solo
  comando y reinicio automático.
- **`.env.example`**: puerto y credenciales configurables sin tocar código.
- `spring.jpa.open-in-view=false`: los servicios ya devuelven DTOs dentro de su transacción.
- **[docs/deploy.md](docs/deploy.md)**: guía completa de despliegue.
- **Verificado:** dos navegadores independientes conectados por la IP de red local
  (`http://192.168.1.236:8080`) se registran, se encuentran en el lobby, juegan, chatean y
  terminan una partida sin errores; los datos persisten tras `down` + `up`; la copia de
  seguridad con `pg_dump` se restaura correctamente; `./mvnw test` → 38/38.

### Fase 5, Lombok y nuevo diseño

**Fase 5 — Tests del leaderboard (38/38 tests OK):**
- `EloServiceTest`: cálculo del ELO sin BD (±16 entre iguales, +3 el favorito, +29 el
  débil, mínimo 1 punto, suma cero).
- `LeaderboardTest`: partidas Ranked completas contra PostgreSQL; comprueba ELO,
  victorias/derrotas, que las Casual no cuentan, el abandono y el orden del ranking.
  Cada test se deshace al acabar, así que no deja datos.
- `ApiTest`: endpoints con MockMvc (201, 400, 401, 404, 409) y que la contraseña nunca
  aparece en las respuestas.

**Backend:** Lombok en todas las capas (`@RequiredArgsConstructor` en servicios y
controladores, `@Getter` en excepciones, `@NoArgsConstructor` en entidades).

**Frontend:** rediseño completo inspirado en Lichess con identidad de Go (ver
[Funcionalidades del frontend](#funcionalidades-del-frontend)); el logo es un sello rojo
con el kanji 碁 y la firma «USC» en negro en la esquina inferior derecha.

### Rediseño de UI, perfil y auto-actualización

**Frontend (reescrito por completo):**
- `index.html`: vista única con tarjeta de acceso, cabecera fija con marca, navegación
  de 5 vistas con iconos (Lobby, Ranking, Amigos, Chat, Perfil), sección de partida con
  sidebar de estado/jugadores/acciones y contenedor de avisos.
- `css/style.css`: sistema de diseño *dark premium* con variables CSS (azul marino,
  radios, sombras, tablas con podios, burbujas de chat, toasts animados) y breakpoints
  a 1040/940/720/460 px.
- `js/app.js`: toasts, *polling* con detección de cambios por vista (lobby, ranking,
  amigos, historial, chat privado, chat de partida) para que todo se actualice sin
  recargar, vista de perfil, tablero con DPR/`ResizeObserver`, clic con **snap a la
  intersección más cercana** y envío con Enter.
- Nuevo `favicon.svg` (elimina el 404 de la pestaña).

**Backend (dos cambios mínimos):**
- `PUT /users/{id}` acepta cambiar el **nombre de usuario** (3–50 caracteres → 400 si
  no cumple, 409 si ya existe).
- `@JsonView(Views.Public.class)` en `GameController`, `MessageController` y
  `FriendshipController`: la contraseña **ya no se filtra** en respuestas como
  `GET /games` o `GET /friendships/pending` (antes salía en claro).

**Verificación:** `./mvnw test` → 10/10 OK; test E2E de navegador (Chrome headless + CDP)
→ 41/41 comprobaciones y 0 errores de consola; sin scroll horizontal en móvil.

### Fases 3 y 4

#### Fase 3 — Pulido del backend
- **Validación de datos de entrada (Bean Validation)**:
  - DTOs con anotaciones: `@NotBlank`, `@Size`, `@Email`, `@NotNull` y validación cruzada (`@AssertTrue`) en `Move` para exigir `pass=true` o coordenadas válidas.
  - Controladores anotados con `@Valid` en los cuerpos de solicitud.
  - `ErrorController` mejorado para devolver `application/problem+json` (400) en casos de `MethodArgumentNotValid`, `MissingServletRequestParameter`, `HttpMessageNotReadable` y `TypeMismatch`.
- **Tests de endpoints**: se mantuvieron los tests existentes (reglas del Go) y se verificaron manualmente los flujos principales (registro, login, creación/unión de partidas, jugadas,    abandono, amistades y chat). Todos los tests pasan (`./mvnw test`).

#### Fase 4 — Frontend HTML + JavaScript vanilla
- Creado frontend estático en `src/main/resources/static/`:
  - `index.html`: login/registro, lobby de partidas, tablero, ranking, amigos y chat (privado y de partida).
  - `css/style.css`: estilos simples y responsivos para tablero y vistas.
  - `js/app.js`: cliente que consume toda la API REST, envía cabecera `X-User-Id`, gestiona estado, dibuja tablero Go 9x9/13x13/19x19, manejo de turnos, passes, abandono, refresco periódico y chats.

El backend expone los endpoints tal y como documenta `docs/backend.md` y sirve los archivos estáticos correctamente.
