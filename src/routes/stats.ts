import { Elysia, t } from 'elysia';
import { playerService } from '../services/playerService';
import { matchService } from '../services/matchService';

export const statsRouter = new Elysia({ prefix: '/stats' })
    // Get all player statistics
    .get('/', async ({ query }) => {
        try {
            const timeframe = (query?.timeframe || 'all') as 'all' | 'today';
            const stats = await playerService.getAllStats(timeframe);
            return { success: true, data: stats };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to fetch statistics' 
            };
        }
    }, {
        query: t.Object({
            timeframe: t.Optional(t.Union([
                t.Literal('all'),
                t.Literal('daily'),
                t.Literal('today')
            ]))
        })
    })
    
    // Get statistics for a specific player
    .get('/player/:id', async ({ params }) => {
        try {
            const stats = await playerService.getPlayerStats(parseInt(params.id));
            if (!stats) {
                return { success: false, error: 'Player not found' };
            }
            return { success: true, data: stats };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to fetch player statistics' 
            };
        }
    }, {
        params: t.Object({
            id: t.String()
        })
    })
    
    // Get expenses by timeframe
    .get('/expenses', async ({ query }) => {
        try {
            const timeframe = (query.timeframe || 'month') as 'week' | 'month' | 'year' | 'all';
            const expenses = await matchService.getExpenses(timeframe);
            return { success: true, data: expenses };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to fetch expenses' 
            };
        }
    }, {
        query: t.Object({
            timeframe: t.Optional(t.Union([
                t.Literal('week'),
                t.Literal('month'),
                t.Literal('year'),
                t.Literal('all')
            ]))
        })
    })
    
    // Get leaderboard (top players by wins)
    .get('/leaderboard', async ({ query }) => {
        try {
            const limit = query.limit ? parseInt(query.limit) : 10;
            const allStats = await playerService.getAllStats();
            const leaderboard = allStats.slice(0, limit);
            return { success: true, data: leaderboard };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to fetch leaderboard' 
            };
        }
    }, {
        query: t.Object({
            limit: t.Optional(t.String())
        })
    });
