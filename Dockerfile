FROM oven/bun:1
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install

# Copy all source files
COPY . .

# Build the Vite frontend
RUN bun run build

# Expose port and start server.ts
EXPOSE 3000
ENV NODE_ENV=production
CMD ["bun", "run", "server.ts"]
