# Single-container build: Express backend serves the frontend
FROM node:20-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --omit=dev

COPY backend ./backend
COPY frontend ./frontend

ENV PORT=5000
EXPOSE 5000

WORKDIR /app/backend
CMD ["node", "server.js"]

