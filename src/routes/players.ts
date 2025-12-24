import { Elysia, t } from 'elysia';
import { playerService } from '../services/playerService';

export const playersRouter = new Elysia({ prefix: '/players' })
    // Get all players
    .get('/', async () => {
        try {
            const players = await playerService.getAllPlayers();
            return { success: true, data: players };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to fetch players' 
            };
        }
    })
    
    // Get player by ID
    .get('/:id', async ({ params }) => {
        try {
            const player = await playerService.getPlayerById(parseInt(params.id));
            if (!player) {
                return { success: false, error: 'Player not found' };
            }
            return { success: true, data: player };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to fetch player' 
            };
        }
    }, {
        params: t.Object({
            id: t.String()
        })
    })
    
    // Create a new player
    .post('/', async ({ body }) => {
        try {
            const player = await playerService.createPlayer(body);
            return { success: true, data: player };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to create player' 
            };
        }
    }, {
        body: t.Object({
            name: t.String({ minLength: 1, maxLength: 100 })
        })
    })
    
    // Delete a player
    .delete('/:id', async ({ params }) => {
        try {
            const deleted = await playerService.deletePlayer(parseInt(params.id));
            if (!deleted) {
                return { success: false, error: 'Player not found' };
            }
            return { success: true, message: 'Player deleted successfully' };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Failed to delete player' 
            };
        }
    }, {
        params: t.Object({
            id: t.String()
        })
    });
