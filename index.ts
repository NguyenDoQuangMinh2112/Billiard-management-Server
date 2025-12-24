import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { playersRouter } from './src/routes/players';
import { matchesRouter } from './src/routes/matches';
import { statsRouter } from './src/routes/stats';
import { playerService } from './src/services/playerService';
import { config } from './src/config';
import sql from './src/db';

const app = new Elysia()
    .use(
        cors({
            origin: config.corsOrigin,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true,
        })
    )
    
    // Health check endpoint
    .get('/', () => ({
        success: true,
        message: 'Billiard Management API Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    }))
    
    // API routes
    .group('/api', (app) =>
        app
            .use(playersRouter)
            .use(matchesRouter)
            .use(statsRouter)
    )
    
    // Initialize database
    .onStart(async () => {
        const mode = config.isProduction ? 'PRODUCTION' : 'DEVELOPMENT';
        console.log(`🎱 Starting Billiard Management Server in ${mode} mode...`);
        
        try {
            // Test database connection
            await sql`SELECT 1`;
            console.log('✅ Database connection established');
            
            // In development, auto-initialize players
            if (!config.isProduction) {
                await playerService.initializeDefaultPlayers();
                console.log('✅ Default players initialized (Development Mode)');
            } else {
                console.log('ℹ️  Production mode: Skipping default player initialization');
            }
            
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            if (config.isProduction) {
                console.error('CRITICAL: Database is required for production server to start');
                process.exit(1); // Exit in production if DB is down
            }
            console.log('⚠️  Development mode: Server running with limited functionality');
        }
    })
    
    // Error handling
    .onError(({ code, error, set }) => {
        console.error('Error:', error);
        
        if (code === 'NOT_FOUND') {
            set.status = 404;
            return { success: false, error: 'Route not found' };
        }
        
        if (code === 'VALIDATION') {
            set.status = 400;
            return { success: false, error: 'Validation error', details: error.message };
        }
        
        set.status = 500;
        return { 
            success: false, 
            error: 'Internal server error',
            message: config.isProduction ? 'An unexpected error occurred' : (error instanceof Error ? error.message : 'Unknown error')
        };
    })
    
    .listen(config.port);

console.log(`
🚀 Server is running at http://${app.server?.hostname}:${app.server?.port}

📚 API Documentation:
   GET    /                           - Health check
   GET    /api/players                - Get all players
   POST   /api/players                - Create player
   GET    /api/players/:id            - Get player by ID
   DELETE /api/players/:id            - Delete player
   
   GET    /api/matches                - Get all matches
   GET    /api/matches/recent         - Get recent matches
   POST   /api/matches                - Create match
   GET    /api/matches/:id            - Get match by ID
   DELETE /api/matches/:id            - Delete match
   GET    /api/matches/payer/next     - Get next payer
   
   GET    /api/stats                  - Get all player stats
   GET    /api/stats/player/:id       - Get player stats
   GET    /api/stats/expenses         - Get expenses (query: timeframe)
   GET    /api/stats/leaderboard      - Get leaderboard (query: limit)

💾 Database: PostgreSQL
🎯 Ready to track your billiard games!
`);