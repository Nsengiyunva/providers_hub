FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/types/package*.json ./shared/types/
COPY shared/utils/package*.json ./shared/utils/
COPY services/user-service/package*.json ./services/user-service/

# Install dependencies
RUN npm install --workspace=services/user-service

# Copy source code
COPY shared/ ./shared/
COPY services/user-service/ ./services/user-service/

# Build shared packages
WORKDIR /app/shared/types
RUN npm run build

WORKDIR /app/shared/utils
RUN npm run build

# Build service
WORKDIR /app/services/user-service
RUN npx prisma generate
RUN npm run build

# Create logs directory
RUN mkdir -p /app/logs

EXPOSE 3001

CMD ["npm", "start"]
