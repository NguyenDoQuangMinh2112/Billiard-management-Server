import { Elysia, t } from 'elysia';
import { matchService } from '../services/matchService';

export const matchesRouter = new Elysia({ prefix: '/matches' })
    // Get all matches
    .get('/', async () => {
        try {
            const matches = await matchService.getAllMatches();
            return { success: true, data: matches };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to fetch matches' 
            };
        }
    })
    
    // Get recent matches
    .get('/recent', async ({ query }) => {
        try {
            const limit = query.limit ? parseInt(query.limit) : 10;
            const matches = await matchService.getRecentMatches(limit);
            return { success: true, data: matches };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to fetch recent matches' 
            };
        }
    }, {
        query: t.Object({
            limit: t.Optional(t.String())
        })
    })
    
    // Get match by ID
    .get('/:id', async ({ params }) => {
        try {
            const match = await matchService.getMatchById(params.id);
            if (!match) {
                return { success: false, error: 'Match not found' };
            }
            return { success: true, data: match };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to fetch match' 
            };
        }
    }, {
        params: t.Object({
            id: t.String()
        })
    })
    
    // Create a new match
    .post('/', async ({ body }) => {
        try {
            const match = await matchService.createMatch(body);
            return { success: true, data: match };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to create match' 
            };
        }
    }, {
        body: t.Object({
            winner: t.String({ minLength: 1 }),
            loser: t.String({ minLength: 1 }),
            cost: t.Number({ minimum: 0 })
        })
    })
    
    // Delete a match
    .delete('/:id', async ({ params }) => {
        try {
            const deleted = await matchService.deleteMatch(params.id);
            if (!deleted) {
                return { success: false, error: 'Match not found' };
            }
            return { success: true, message: 'Match deleted successfully' };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to delete match' 
            };
        }
    }, {
        params: t.Object({
            id: t.String()
        })
    })
    
    // Get next payer
    .get('/payer/next', async () => {
        try {
            const payer = await matchService.getNextPayer();
            return { success: true, data: payer };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to get next payer' 
            };
        }
    });
