import { PlayerModel } from "../models/PlayerModel";
import { PayerRotationModel } from "../models/PayerRotationModel";
import { NotFoundError, ValidationError } from "../errors";
import { logger } from "../utils/logger";
import config from "../config";
import sql from "../db";
import type { Player, CreatePlayerDTO, PlayerStats } from "../types";

export class PlayerService {
  async getAllPlayers(): Promise<Player[]> {
    return await PlayerModel.findAll();
  }

  async getPlayerById(id: number): Promise<Player> {
    const player = await PlayerModel.findById(id);
    if (!player) {
      throw new NotFoundError("Player", id);
    }
    return player;
  }

  async getPlayerByName(name: string): Promise<Player | null> {
    if (!name || name.trim().length === 0) {
      throw new ValidationError("Player name is required", "name", name);
    }
    return await PlayerModel.findByName(name.trim());
  }

  async createPlayer(data: CreatePlayerDTO): Promise<Player> {
    if (!data || !data.name) {
      throw new ValidationError("Player name is required");
    }

    const player = await PlayerModel.create(data);

    // Initialize payer rotation if this is the first player
    try {
      const currentRotation = await PayerRotationModel.getCurrentPayer();
      if (!currentRotation) {
        await PayerRotationModel.initializeWithFirstPlayer();
        logger.info("Payer rotation initialized");
      }
    } catch (error) {
      logger.warn("Failed to initialize payer rotation", { error });
    }

    return player;
  }

  async deletePlayer(id: number): Promise<boolean> {
    return await PlayerModel.delete(id);
  }

  async getAllStats(timeframe: 'all' | 'daily' | 'today' = 'all'): Promise<PlayerStats[]> {
    // Use Daily Champion logic for 'daily' timeframe
    if (timeframe === 'daily') {
        return this.getDailyChampionStats();
    }
    
    // 'today' shows match stats for current date only
    const isToday = timeframe === 'today';
      
    try {
      const stats = await sql<PlayerStats[]>`
                SELECT 
                    p.id,
                    p.name,
                    COALESCE(ms.wins, 0) as wins,
                    COALESCE(ms.losses, 0) as losses,
                    COALESCE(s.total_spent, 0) as "totalSpent",
                    (COALESCE(ms.wins, 0) + COALESCE(ms.losses, 0)) as "matchesPlayed",
                    CASE 
                        WHEN (COALESCE(ms.wins, 0) + COALESCE(ms.losses, 0)) = 0 THEN 0
                        ELSE ROUND((COALESCE(ms.wins, 0)::DECIMAL / (COALESCE(ms.wins, 0) + COALESCE(ms.losses, 0))) * 100, 2)
                    END as "winRate"
                FROM players p
                LEFT JOIN (
                    SELECT ms.player_id, SUM(ms.wins) as wins, SUM(ms.losses) as losses
                    FROM match_stats ms
                    ${isToday ? sql`JOIN matches m ON ms.match_id = m.id` : sql``}
                    ${isToday ? sql`WHERE DATE(m.date) = CURRENT_DATE` : sql``}
                    GROUP BY ms.player_id
                ) ms ON p.id = ms.player_id
                LEFT JOIN (
                    SELECT payer_id, SUM(cost) as total_spent 
                    FROM matches 
                    ${isToday ? sql`WHERE DATE(date) = CURRENT_DATE` : sql``}
                    GROUP BY payer_id
                ) s ON p.id = s.payer_id
                ORDER BY wins DESC, "winRate" DESC
            `;
      return stats;
    } catch (error) {
      logger.error("Failed to get player stats", { error });
      throw error;
    }
  }

  async getDailyChampionStats(): Promise<PlayerStats[]> {
    try {
        // 1. Get all matches with their participants
        const matchesData = await sql`
            SELECT 
                m.id as match_id,
                m.participants as participants
            FROM matches m
            WHERE m.participants IS NOT NULL AND array_length(m.participants, 1) > 0
            ORDER BY m.date
        `;

        // 2. Initialize player aggregation map
        const playerAgg = new Map<string, {
            name: string;
            wins: number;
            losses: number;
            matchesPlayed: number;
        }>();

        const allPlayers = await this.getAllPlayers();
        allPlayers.forEach(p => {
            playerAgg.set(p.name, { 
                name: p.name, 
                wins: 0, 
                losses: 0,
                matchesPlayed: 0
            });
        });

        // 3. Process each match: First person wins, others lose
        matchesData.forEach((row: any) => {
            const participants = row.participants || [];
            
            if (participants.length > 0) {
                // First person in participants array is the winner
                const winner = String(participants[0] || '');
                
                // Process all participants
                participants.forEach((playerName: any, index: number) => {
                    const name = String(playerName || '');
                    const stats = playerAgg.get(name);
                    
                    if (stats) {
                        stats.matchesPlayed++;
                        if (index === 0) {
                            stats.wins++;  // Winner
                        } else {
                            stats.losses++; // Loser
                        }
                    }
                });
            }
        });

        // 4. Get total spent (remains global)
        const expenseStats = await sql`
            SELECT p.name, SUM(m.cost) as total_spent 
            FROM matches m
            JOIN players p ON m.payer_id = p.id
            GROUP BY p.name
        `;
        const expenseMap = new Map<string, number>();
        expenseStats.forEach((row: any) => {
            expenseMap.set(row.name, parseFloat(row.total_spent || '0'));
        });

        // 5. Transform to PlayerStats format
        const results: PlayerStats[] = [];
        const playerIdMap = new Map<string, number>();
        allPlayers.forEach(p => playerIdMap.set(p.name, p.id));

        playerAgg.forEach((stats, playerName) => {
            const totalSpent = expenseMap.get(playerName) || 0;
            const totalGames = stats.wins + stats.losses;
            const winRate = totalGames > 0 ? parseFloat(((stats.wins / totalGames) * 100).toFixed(2)) : 0;
            const playerId = playerIdMap.get(playerName) || 0;

            results.push({
                id: playerId,
                name: playerName,
                wins: stats.wins,
                losses: stats.losses,
                totalSpent: totalSpent,
                matchesPlayed: totalGames,
                winRate: winRate
            });
        });

        // 6. Sort by wins, then win rate
        return results.sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.winRate - a.winRate;
        });

    } catch (error) {
        logger.error("Failed to calculate daily champion stats", { error });
        throw error;
    }
  }

  async getPlayerStats(id: number): Promise<PlayerStats> {
    const player = await this.getPlayerById(id);

    try {
      const [stats] = await sql<PlayerStats[]>`
                SELECT 
                    p.id,
                    p.name,
                    COALESCE(ms.wins, 0) as wins,
                    COALESCE(ms.losses, 0) as losses,
                    COALESCE(s.total_spent, 0) as "totalSpent",
                    (COALESCE(ms.wins, 0) + COALESCE(ms.losses, 0)) as "matchesPlayed",
                    CASE 
                        WHEN (COALESCE(ms.wins, 0) + COALESCE(ms.losses, 0)) = 0 THEN 0
                        ELSE ROUND((COALESCE(ms.wins, 0)::DECIMAL / (COALESCE(ms.wins, 0) + COALESCE(ms.losses, 0))) * 100, 2)
                    END as "winRate"
                FROM players p
                LEFT JOIN (
                    SELECT player_id, SUM(wins) as wins, SUM(losses) as losses
                    FROM match_stats 
                    WHERE player_id = ${id}
                    GROUP BY player_id
                ) ms ON p.id = ms.player_id
                LEFT JOIN (
                    SELECT payer_id, SUM(cost) as total_spent 
                    FROM matches 
                    WHERE payer_id = ${id}
                    GROUP BY payer_id
                ) s ON p.id = s.payer_id
                WHERE p.id = ${id}
            `;

      return (
        stats || {
          id: player.id,
          name: player.name,
          wins: 0,
          losses: 0,
          totalSpent: 0,
          matchesPlayed: 0,
          winRate: 0,
        }
      );
    } catch (error) {
      logger.error("Failed to get player stats", { error, playerId: id });
      throw error;
    }
  }

  async initializeDefaultPlayers(): Promise<void> {
    if (!config.features.autoInitPlayers) {
      logger.info("Auto-initialization disabled");
      return;
    }

    for (const name of config.features.defaultPlayers) {
      try {
        const existing = await this.getPlayerByName(name);
        if (!existing) {
          await this.createPlayer({ name });
          logger.info("Created default player", { name });
        }
      } catch (error) {
        logger.warn("Failed to create default player", { name, error });
      }
    }
  }
}

export const playerService = new PlayerService();
