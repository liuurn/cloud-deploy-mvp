# Build Stage for Backend
FROM 1111rz7idrsqdj.xuanyuan.run/maven:3.8.5-openjdk-17 AS build-be
WORKDIR /app/be
COPY be/pom.xml .
COPY be/src ./src
RUN mvn clean package -DskipTests

# Build Stage for Frontend
FROM 1111rz7idrsqdj.xuanyuan.run/node:20 AS build-fe
WORKDIR /app/fe
COPY fe/package.json fe/package-lock.json* ./
RUN npm install --registry https://registry.npmmirror.com/
COPY fe/ .
RUN npm run build

# Runtime Stage
FROM 1111rz7idrsqdj.xuanyuan.run/eclipse-temurin:17-jre
WORKDIR /app

# Set environment variables
ENV JAVA_OPTS=""
ENV PORT=5173

# Install Node.js in Runtime Stage (required for 'vite preview')
RUN apt-get update && apt-get install -y nginx && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy Backend Artifacts
COPY --from=build-be /app/be/target/*.jar /app/app.jar

# Copy Frontend Artifacts
# COPY --from=build-fe /app/fe/dist /app/fe/dist
# COPY --from=build-fe /app/fe/package.json /app/fe/
# COPY --from=build-fe /app/fe/vite.config.ts /app/fe/
# COPY --from=build-fe /app/fe/node_modules /app/fe/node_modules
copy --from=build-fe /app/fe /app/fe

# Copy Nginx Config
COPY nginx.conf /etc/nginx/nginx.conf
# Copy Start Script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose ports (Optional, for documentation)
# 8080 is for Backend, dynamic port is for Frontend
EXPOSE 8080
EXPOSE 8081
EXPOSE 5173

CMD ["/app/start.sh"]