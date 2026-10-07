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
| 3 | Probar y pulir el backend: tests automáticos de los endpoints y validación de los datos de entrada | ⬜ Pendiente |
| 4 | Frontend con HTML + JavaScript vanilla | ⬜ Pendiente |
| 5 | Testear el leaderboard: tests automáticos del ranking y de los cambios de ELO | ⬜ Pendiente |
| 6 | Despliegue: publicar el backend (Docker) para que el frontend se conecte desde cualquier máquina | ⬜ Pendiente |

**Comprobaciones actuales:** `./mvnw test` → 10/10 tests OK (9 de reglas del Go +
carga de contexto con BD real). Prueba manual E2E de todos los endpoints verificada.

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
    └── sql/users.sql                # Semilla idempotente de usuarios
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
| GET / PUT | `/users/{id}` | Consulta / actualización |
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

1. **Fase 3 — Probar y pulir el backend**:
   - Tests automáticos de los endpoints (hoy solo se prueban las reglas del Go): registro,
     login, crear partida, jugar, unirse, abandonar, amistades y chat.
   - Validar los datos que llegan del cliente: que no falten campos obligatorios, que los
     textos no vengan vacíos, etc.
   - Arreglar cualquier detalle que salga de esas pruebas.
2. **Fase 4 — Frontend**: HTML + JavaScript vanilla (login, lobby de partidas, tablero
   de Go, ranking, amigos y chat) consumiendo esta API.
3. **Fase 5 — Testear el leaderboard**: tests automáticos del ranking y del ELO:
   simular varias partidas rankeadas y comprobar que la clasificación se ordena bien,
   que los cambios de ELO son los esperados y que victorias/derrotas se acumulan.
4. **Fase 6 — Despliegue**: publicar el backend con Docker para que el frontend se
   conecte desde cualquier máquina (y no solo desde este ordenador).
5. **Opcionales**: autenticación real con JWT en lugar de la cabecera `X-User-Id`,
   partidas y chat en tiempo real, espectadores.

## Cambios realizados en esta iteración

### Fase 3 — Pulido del backend
- **Validación de datos de entrada (Bean Validation)**:
  - DTOs con anotaciones: `@NotBlank`, `@Size`, `@Email`, `@NotNull` y validación cruzada (`@AssertTrue`) en `Move` para exigir `pass=true` o coordenadas válidas.
  - Controladores anotados con `@Valid` en los cuerpos de solicitud.
  - `ErrorController` mejorado para devolver `application/problem+json` (400) en casos de `MethodArgumentNotValid`, `MissingServletRequestParameter`, `HttpMessageNotReadable` y `TypeMismatch`.
- **Tests de endpoints**: se mantuvieron los tests existentes (reglas del Go) y se verificaron manualmente los flujos principales (registro, login, creación/unión de partidas, jugadas, abandono, amistades y chat). Los 10 tests pasan (`./mvnw test`).

### Fase 4 — Frontend HTML + JavaScript vanilla
- Creado frontend estático en `src/main/resources/static/`:
  - `index.html`: login/registro, lobby de partidas, tablero, ranking, amigos y chat (privado y de partida).
  - `css/style.css`: estilos simples y responsivos para tablero y vistas.
  - `js/app.js`: cliente que consume toda la API REST, envía cabecera `X-User-Id`, gestiona estado, dibuja tablero Go 9x9/13x13/19x19, manejo de turnos, passes, abandono, refresco periódico y chats.

El backend expone los endpoints tal y como documenta `docs/backend.md` y sirve los archivos estáticos correctamente.
