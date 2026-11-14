# Container for hosting the office system as a website (Railway / Render / any Docker host).
FROM node:24-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .
RUN npm run build
ENV NODE_ENV=production OFFICE_HOSTED=1 OFFICE_DATA_DIR=/data
EXPOSE 3000
CMD ["npm", "start"]
