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

# Expose the port
EXPOSE 3000

# Run the app using CMD (more compatible with Koyeb)
# We use the full path just to be absolutely safe
CMD ["/usr/local/bin/bun", "run", "index.ts"]
