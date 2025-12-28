import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { playersRouter } from "./src/routes/players";
import { matchesRouter } from "./src/routes/matches";
import { statsRouter } from "./src/routes/stats";
import { playerService } from "./src/services/playerService";
import { Migration } from "./src/models";
import { ErrorHandler, AppError } from "./src/errors";
import { logger } from "./src/utils/logger";
import config from "./src/config";
import sql from "./src/db";

const app = new Elysia()
  .use(
    cors({
      origin: config.server.corsOrigin,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  )

  // Request logging
  .onRequest(({ request }) => {
    const start = Date.now();
    logger.info("Incoming request", {
      method: request.method,
      url: request.url,
      timestamp: new Date().toISOString(),
    });
    (request as any).startTime = start;
  })

  // Health check endpoint
  .get("/", () => ({
    success: true,
    message: "Billiard Management API Server",
    version: "2.0.0",
    environment: config.server.isProduction ? "production" : "development",
    timestamp: new Date().toISOString(),
    status: "healthy",
  }))

  // Health check endpoint for monitoring
  .get("/health", async () => {
    const dbHealthy = await sql`SELECT 1 as health`
      .then(() => true)
      .catch(() => false);
    const status = dbHealthy ? "healthy" : "unhealthy";

    return {
      success: true,
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? "up" : "down",
        server: "up",
      },
    };
  })

  // API routes
  .group("/api", (app) =>
    app.use(playersRouter).use(matchesRouter).use(statsRouter)
  )

  // Initialize database and run migrations on server start
  .onStart(async () => {
    const mode = config.server.isProduction ? "PRODUCTION" : "DEVELOPMENT";
    logger.info(`Starting Billiard Management Server v2.0.0 in ${mode} mode`, {
      port: config.server.port,
      host: config.server.host,
      logLevel: config.server.logLevel,
    });

    try {
      // Test database connection
      await sql`SELECT 1`;
      logger.info("Database connection established");

      // Run database migrations
      await Migration.runMigrations();
      logger.info("Database migrations completed");

      // Initialize default players in development
      if (config.features.autoInitPlayers) {
        await playerService.initializeDefaultPlayers();
        logger.info("Default players initialized");
      }
    } catch (error) {
      logger.error("Database initialization failed", { error });

      if (config.server.isProduction) {
        logger.error("CRITICAL: Database required for production server");
        process.exit(1);
      }

      logger.warn(
        "Development mode: Server running with limited functionality"
      );
    }
  })

  // Enhanced error handling
  .onError(({ code, error, set }) => {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error("Request error occurred", {
      code,
      error: errorMessage,
      stack: errorStack,
    });

    // Handle different error types
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return ErrorHandler.handle(error);
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return ErrorHandler.handle(new Error("Route not found"));
    }

    if (code === "VALIDATION") {
      set.status = 400;
      return ErrorHandler.handle(
        error instanceof Error ? error : new Error(errorMessage)
      );
    }

    // Generic error handling
    set.status = 500;
    return ErrorHandler.handle(
      error instanceof Error ? error : new Error(errorMessage)
    );
  })

  // Graceful shutdown
  .onStop(async () => {
    logger.info("Shutting down server gracefully...");
    // Don't close database connections on startup failures
    // Only close when server is actually stopping
  })

  .listen(config.server.port);

// Server startup success message
logger.info(
  `Server is running at http://${config.server.host}:${config.server.port}`,
  {
    endpoints: {
      health: "/health",
      api: "/api",
      players: "/api/players",
      matches: "/api/matches",
      stats: "/api/stats",
    },
    database: "PostgreSQL",
    features: config.features,
  }
);

// Handle process termination
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  sql.end().finally(() => process.exit(0));
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  sql.end().finally(() => process.exit(0));
});

export default app;
