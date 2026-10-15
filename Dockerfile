# syntax=docker/dockerfile:1
#
# Imagen de GoUSC (backend + frontend estático) en dos etapas:
#   1. build   -> compila el jar con el JDK y el Maven Wrapper del proyecto.
#   2. runtime -> solo el JRE (Alpine) y la aplicación: imagen pequeña y sin herramientas de compilación.
#
# Construir:  docker build -t gousc .
# Desplegar:  docker compose -f compose.prod.yaml up -d --build   (ver docs/deploy.md)

# ---------------------------------------------------------------- 1. build --
FROM eclipse-temurin:26-jdk AS build
WORKDIR /build

# Primero solo lo necesario para descargar dependencias: mientras el pom.xml no
# cambie, Docker reutiliza esta capa y no vuelve a descargar nada.
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN --mount=type=cache,target=/root/.m2 ./mvnw -q dependency:go-offline

# Después el código. Los tests no se ejecutan aquí porque necesitan PostgreSQL:
# se lanzan aparte con ./mvnw test (ver README).
COPY src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -q -DskipTests package \
 && cp target/*.jar application.jar \
 && java -Djarmode=tools -jar application.jar extract --layers --destination extracted

# -------------------------------------------------------------- 2. runtime --
FROM eclipse-temurin:26-jre-alpine
WORKDIR /app

# La aplicación no se ejecuta como root.
RUN addgroup -S gousc && adduser -S -G gousc -u 1001 gousc

# El jar va por capas (de la que menos cambia a la que más): al publicar una
# versión nueva solo se reconstruye la capa "application", no las librerías.
COPY --from=build /build/extracted/dependencies/ ./
COPY --from=build /build/extracted/spring-boot-loader/ ./
COPY --from=build /build/extracted/snapshot-dependencies/ ./
COPY --from=build /build/extracted/application/ ./

USER gousc
EXPOSE 8080

# Memoria de la JVM proporcional a la que tenga el contenedor.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"

# Docker marca el contenedor como "healthy" cuando la API responde.
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/users/ranking || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar application.jar"]
