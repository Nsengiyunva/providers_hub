FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/types/package*.json ./shared/types/
COPY shared/utils/package*.json ./shared/utils/
COPY services/api-gateway/package*.json ./services/api-gateway/

# Install dependencies
RUN npm install --workspace=services/api-gateway

# Copy source code
COPY shared/ ./shared/
COPY services/api-gateway/ ./services/api-gateway/

# Build shared packages
WORKDIR /app/shared/types
RUN npm run build

WORKDIR /app/shared/utils
RUN npm run build

# Build service
WORKDIR /app/services/api-gateway
RUN npm run build

# Create logs directory
RUN mkdir -p /app/logs

EXPOSE 3000

CMD ["npm", "start"]
