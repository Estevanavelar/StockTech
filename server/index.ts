import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import wsManager from "./_core/websocket";
import healthMonitor from "./_core/health";
import { requestLogger } from "./middleware/requestLogger";
import { cleanupOrphanImages } from "./_core/orphanCleanup";
import { startCartCleanupJob } from "./_core/cartCleanup";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // CORS: permite AxCellOS, StockTech, AvAdmin, App e localhost
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : process.env.NODE_ENV === "production"
      ? [
          "https://stocktech.avelarcompany.com.br",
          "https://axcellos.avelarcompany.com.br",
          "https://avadmin.avelarcompany.com.br",
          "https://app.avelarcompany.com.br",
        ]
      : ["http://localhost:5173", "http://localhost:3000", "http://localhost:3002", "http://localhost:3004"];
  app.use(cors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  }));

  app.use(express.json({ limit: "10mb" }));

  // Request logging
  app.use(requestLogger);

  // tRPC middleware
  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }: any) => ({ req, res }),
    })
  );

  // Health check
  app.get("/health", async (req, res) => {
    try {
      const health = await healthMonitor.checkHealth();
      const statusCode = health.status === 'healthy' ? 200 :
                        health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  // WebSocket server
  wsManager.init(server);

  // Cart cleanup job
  startCartCleanupJob();

  const cleanupEnabled = (process.env.CLEANUP_ORPHAN_IMAGES ?? "true") !== "false";
  if (cleanupEnabled) {
    const runCleanup = async () => {
      try {
        const result = await cleanupOrphanImages({ dryRun: false, maxDelete: 5000 });
        console.log("[Cleanup] Orphan images:", result);
      } catch (error) {
        console.error("[Cleanup] Failed to cleanup orphan images:", error);
      }
    };
    setTimeout(runCleanup, 30000);
    setInterval(runCleanup, 24 * 60 * 60 * 1000);
  }

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    wsManager.cleanup();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    wsManager.cleanup();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`🚀 StockTech Server running on http://localhost:${port}`);
    console.log(`📡 WebSocket server initialized`);
    console.log(`🔗 tRPC endpoints available at http://localhost:${port}/trpc`);
  });
}

startServer().catch(console.error);
