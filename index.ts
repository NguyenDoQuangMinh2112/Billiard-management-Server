import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { playersRouter } from "./src/routes/players";
import { matchesRouter } from "./src/routes/matches";
import { statsRouter } from "./src/routes/stats";
import { Migration, PlayerModel } from "./src/models";
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
      credentials: false,
    })
  )

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
    
    // Check if players table exists
    const playersTableExists = dbHealthy 
      ? await PlayerModel.tableExists().catch(() => false)
      : false;

    const status = (dbHealthy && playersTableExists) ? "healthy" : "unhealthy";

    return {
      success: true,
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? "up" : "down",
        tables: {
          players: playersTableExists ? "exists" : "missing"
        },
        server: "up",
      },
    };
  })

  // API routes
  .group("/api", (app) =>
    app
      .use(playersRouter)
      .use(matchesRouter)
      .use(statsRouter)
      // Temporary migration endpoint
      .post("/migrate", async () => {
        try {
          await Migration.runMigrations();
          return { success: true, message: "Migrations run successfully" };
        } catch (error) {
          logger.error("Migration failed manually", { error });
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Migration failed",
          };
        }
      })
  )

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

  .listen({
    port: config.server.port,
    hostname: config.server.host,
  });

// Server startup success message
logger.info(
  `Server is running at http://${config.server.host}:${config.server.port}`
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
