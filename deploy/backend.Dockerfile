# syntax=docker/dockerfile:1.7

# ============================================
# Backend: Spring Boot + CDC Debezium embebido
# ============================================
FROM eclipse-temurin:17-jdk-alpine AS build

WORKDIR /workspace

COPY backend/pom.xml backend/mvnw ./
COPY backend/.mvn .mvn
COPY backend/seguimientocuentas-common/pom.xml seguimientocuentas-common/pom.xml
COPY backend/seguimientocuentas-contratos/pom.xml seguimientocuentas-contratos/pom.xml
COPY backend/seguimientocuentas-cdc/pom.xml seguimientocuentas-cdc/pom.xml
COPY backend/seguimientocuentas-app/pom.xml seguimientocuentas-app/pom.xml

RUN chmod +x mvnw

COPY backend/seguimientocuentas-common/src seguimientocuentas-common/src
COPY backend/seguimientocuentas-contratos/src seguimientocuentas-contratos/src
COPY backend/seguimientocuentas-cdc/src seguimientocuentas-cdc/src
COPY backend/seguimientocuentas-app/src seguimientocuentas-app/src

RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -B -q -DskipTests package

# ============================================
# Runtime
# ============================================
FROM eclipse-temurin:17-jre-alpine AS runtime

RUN apk add --no-cache curl tzdata \
    && addgroup -S app \
    && adduser -S app -G app

WORKDIR /app

RUN mkdir -p /app/data && chown -R app:app /app

COPY --from=build --chown=app:app \
    /workspace/seguimientocuentas-app/target/seguimientocuentas-app-*.jar /app/app.jar

ENV SPRING_PROFILES_ACTIVE=docker \
    TZ=America/Bogota \
    JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -Duser.timezone=America/Bogota"

USER app

VOLUME ["/app/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD curl -fsSI http://127.0.0.1:8080/api/contratos >/dev/null || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
