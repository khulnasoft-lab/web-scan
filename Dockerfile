# Multi-stage production-optimized Dockerfile for Web-Scan API
# Specify the Node.js version to use
ARG NODE_VERSION=18

# Specify the Debian version to use, the default is "bullseye"
ARG DEBIAN_VERSION=bullseye-slim

# Build stage
FROM node:${NODE_VERSION}-${DEBIAN_VERSION} AS build

# Set the container's default shell to Bash and enable some options
SHELL ["/bin/bash", "-euo", "pipefail", "-c"]

# Install Chromium browser and Download and verify Google Chrome’s signing key
RUN apt-get update -qq --fix-missing && \
    apt-get -qqy install --allow-unauthenticated gnupg wget && \
    wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list && \
    apt-get update -qq && \
    apt-get -qqy --no-install-recommends install chromium traceroute python make g++ && \
    rm -rf /var/lib/apt/lists/* 

# Run the Chromium browser's version command and redirect its output to the /etc/chromium-version file
RUN /usr/bin/chromium --no-sandbox --version > /etc/chromium-version

# Set the working directory to /app
WORKDIR /app

# Copy package.json and yarn.lock to the working directory
COPY package.json yarn.lock ./

# Run yarn install to install dependencies and clear yarn cache
RUN apt-get update && \
    yarn install --frozen-lockfile --network-timeout 100000 && \
    rm -rf /app/node_modules/.cache

# Copy all files to working directory
COPY . .

# Run yarn build to build the application
RUN yarn build --production

# Production stage
FROM node:${NODE_VERSION}-${DEBIAN_VERSION} AS production

# Create non-root user for security
RUN groupadd --gid 1001 --system nodejs && \
    useradd --uid 1001 --system --gid nodejs --create-home --shell /bin/bash nodejs

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        chromium \
        traceroute \
        curl \
        dumb-init && \
    chmod 755 /usr/bin/chromium && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install production dependencies only
RUN yarn install --frozen-lockfile --production --network-timeout 100000 && \
    yarn cache clean && \
    rm -rf /tmp/* /var/tmp/* /app/node_modules/.cache

# Copy application code from build stage
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/api ./api
COPY --from=build --chown=nodejs:nodejs /app/src ./src
COPY --from=build --chown=nodejs:nodejs /app/server-dev.js ./
COPY --from=build --chown=nodejs:nodejs /app/server.js ./

# Create necessary directories
RUN mkdir -p /app/logs /app/test-results /app/docs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3001}/health || exit 1

# Environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    CHROME_PATH='/usr/bin/chromium' \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH='/usr/bin/chromium'

# Expose port
EXPOSE ${PORT:-3001}

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server-dev.js"]
