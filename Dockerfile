# Use the official Bun image
FROM oven/bun:1.1 as base
WORKDIR /usr/src/app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --production

# Copy source code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PATH="/usr/local/bin:${PATH}"

# Expose the port
EXPOSE 3000

# Use standard bun command
ENTRYPOINT ["bun", "run", "index.ts"]
