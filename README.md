# GoUSC

Juego de Go online (9×9, 13×13 y 19×19) con backend **Spring Boot 4** y base de datos
**PostgreSQL 17**. Estilo de código siguiendo el ejemplo de clase
[rest-example](https://gitlab.citius.gal/docencia/es/rest-example): capas
controller → service → repository → entity, DTOs como *records* y errores con
`ProblemDetail`.

## Estado del proyecto

| Fase | Contenido | Estado |
|------|-----------|--------|
| 1 | Base de datos, entidades, DTOs, repositorios, servicios, reglas del Go, ELO, test de reglas | ✅ Hecha |
| 2 | Controllers REST + manejo global de errores + prueba end-to-end | ✅ Hecha |
| 3 | Probar y pulir el backend: tests automáticos de los endpoints y validación de los datos de entrada | ✅ Hecha |
| 4 | Frontend con HTML + JavaScript vanilla | ✅ Hecha |
| 5 | Testear el leaderboard: tests automáticos del ranking y de los cambios de ELO | ⬜ Pendiente |
| 6 | Despliegue: publicar el backend (Docker) para que el frontend se conecte desde cualquier máquina | ⬜ Pendiente |

**Comprobaciones actuales:** `./mvnw test` → 11/11 tests OK (9 de reglas del Go +
carga de contexto con BD real + smoke test). Prueba manual E2E de todos los endpoints
verificada y test end-to-end de navegador (Chrome CDP) con 41 comprobaciones OK:
navegación entre vistas, edición de perfil, actualización automática de lobby/ranking/
amigos/chats, snap del tablero, avisos, login, responsive móvil y 0 errores de consola.

## Puesta en marcha

Requisitos: JDK 26+, Docker con Compose.

```bash
docker compose up -d     # PostgreSQL 17 en el puerto 5432 (gousc/gousc/gousc)
./mvnw spring-boot:run   # API en http://localhost:8080
./mvnw test              # tests (arranca la BD con docker-compose automáticamente)
```

Al arrancar se crea el esquema (JPA `generate-ddl`) y se siembran 4 usuarios de prueba
(idempotente): `deivi/deivi123`, `ana/ana123`, `joel/joel123`, `pepe/pepe123`.

## Estructura del proyecto

```
GoUSC/
├── compose.yaml                     # PostgreSQL 17
├── pom.xml                          # Spring Boot 4.1.1 + Lombok (lo mínimo, sin más librerías)
├── docs/
│   ├── backend.md                   # Guía técnica completa: capas, cada archivo, API y diagramas
│   ├── database.md                  # Diseño de la base de datos (entidades, columnas, decisiones)
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
        ├── index.html               # Vista única: login, lobby, ranking, amigos, chat, perfil y partida
        ├── css/style.css            # Diseño dark premium + responsive (variables CSS)
        ├── js/app.js                # Toda la lógica del cliente (sin dependencias)
        └── favicon.svg              # Icono de la pestaña
```

## API REST (resumen)

Autenticación: sin spring-security. El cliente identifica al usuario con la cabecera
**`X-User-Id`** tras hacer login en `POST /users/login`.

| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | `/users` | Registro (201 + `Location`) |
| POST | `/users/login` | Login por usuario+contraseña |
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

## Qué queda por hacer

1. **Fase 5 — Testear el leaderboard**: tests automáticos del ranking y del ELO:
   simular varias partidas rankeadas y comprobar que la clasificación se ordena bien,
   que los cambios de ELO son los esperados y que victorias/derrotas se acumulan.
2. **Fase 6 — Despliegue**: publicar el backend con Docker para que el frontend se
   conecte desde cualquier máquina (y no solo desde este ordenador).
3. **Opcionales**: autenticación real con JWT en lugar de la cabecera `X-User-Id`,
   partidas y chat en tiempo real (WebSockets/SSE), espectadores.

## Funcionalidades del frontend

- **Login/registro** con validaciones y avisos de error en el propio formulario.
- **Lobby**: crear partida (9×9/13×13/19×19, casual/ranked), unirse, abandonar y lista
  de partidas **que se actualiza sola** sin recargar la página.
- **Partida**: tablero de Go dibujado en canvas con snap a la intersección más cercana,
  estrellas, etiquetas A-T/1-N, marca de último movimiento, turno, pasar, abandonar,
  resultado final y chat de la partida en vivo.
- **Ranking**: podios + tabla con ELO, victorias/derrotas y fila propia destacada.
- **Amigos**: enviar solicitud por ID, aceptar/rechazar y acceso directo al chat.
- **Chat**: conversaciones privadas con actualización automática y envío con Enter.
- **Perfil**: avatar, ID copiable, ELO, estadísticas, historial de partidas con badge
  de victoria/derrota y edición de nombre, email y contraseña.
- **Avisos**: sistema de toasts (info/éxito/error) en lugar de `alert()`, con mapeo de
  los errores de jugada del backend (turno, casilla ocupada, suicidio, ko).
- **Responsive**: sin scroll horizontal en móvil (probado a 390 px) y `prefers-reduced-motion`.

## Historial de cambios

### Iteración actual — Rediseño de UI, perfil y auto-actualización

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

**Verificación:** `./mvnw test` → 11/11 OK; test E2E de navegador (Chrome headless + CDP)
→ 41/41 comprobaciones y 0 errores de consola; sin scroll horizontal en móvil.

### Iteración anterior — Fase 3 y 4

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
