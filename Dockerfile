FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Environment variables will be injected by Railway
CMD ["node", "src/app.js"]