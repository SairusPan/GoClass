# Multi-stage build: compile the frontend, embed it as Spring Boot static resources, package
# the backend, then ship a slim runtime image with nothing but a JRE + the one JAR. Railway
# (and most PaaS platforms) auto-detect this file and build from it directly.

# --- Stage 1: frontend build -------------------------------------------------------------
FROM node:20-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts vitest.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public ./public
COPY src ./src
RUN npm run build

# --- Stage 2: backend build, with the frontend's build output baked in as static resources ---
FROM maven:3.9-eclipse-temurin-17 AS backend-build
WORKDIR /app
COPY backend/pom.xml ./
RUN mvn -q -B dependency:go-offline
COPY backend/src ./src
COPY --from=frontend-build /app/dist ./src/main/resources/static
RUN mvn -q -B package -DskipTests

# --- Stage 3: runtime -----------------------------------------------------------------------
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=backend-build /app/target/tutortime-backend-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
