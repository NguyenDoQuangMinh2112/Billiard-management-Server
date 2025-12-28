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

  async getAllStats(): Promise<PlayerStats[]> {
    try {
      const stats = await sql<PlayerStats[]>`
                SELECT 
                    p.id,
                    p.name,
                    COALESCE(w.wins, 0) as wins,
                    COALESCE(l.losses, 0) as losses,
                    COALESCE(s.total_spent, 0) as total_spent,
                    (COALESCE(w.wins, 0) + COALESCE(l.losses, 0)) as matches_played,
                    CASE 
                        WHEN (COALESCE(w.wins, 0) + COALESCE(l.losses, 0)) = 0 THEN 0
                        ELSE ROUND((COALESCE(w.wins, 0)::DECIMAL / (COALESCE(w.wins, 0) + COALESCE(l.losses, 0))) * 100, 2)
                    END as win_rate
                FROM players p
                LEFT JOIN (
                    SELECT winner_id, COUNT(*) as wins 
                    FROM matches 
                    GROUP BY winner_id
                ) w ON p.id = w.winner_id
                LEFT JOIN (
                    SELECT loser_id, COUNT(*) as losses 
                    FROM matches 
                    GROUP BY loser_id
                ) l ON p.id = l.loser_id
                LEFT JOIN (
                    SELECT payer_id, SUM(cost) as total_spent 
                    FROM matches 
                    GROUP BY payer_id
                ) s ON p.id = s.payer_id
                ORDER BY wins DESC, win_rate DESC
            `;
      return stats;
    } catch (error) {
      logger.error("Failed to get player stats", { error });
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
                    COALESCE(w.wins, 0) as wins,
                    COALESCE(l.losses, 0) as losses,
                    COALESCE(s.total_spent, 0) as total_spent,
                    (COALESCE(w.wins, 0) + COALESCE(l.losses, 0)) as matches_played,
                    CASE 
                        WHEN (COALESCE(w.wins, 0) + COALESCE(l.losses, 0)) = 0 THEN 0
                        ELSE ROUND((COALESCE(w.wins, 0)::DECIMAL / (COALESCE(w.wins, 0) + COALESCE(l.losses, 0))) * 100, 2)
                    END as win_rate
                FROM players p
                LEFT JOIN (
                    SELECT winner_id, COUNT(*) as wins 
                    FROM matches 
                    WHERE winner_id = ${id}
                    GROUP BY winner_id
                ) w ON p.id = w.winner_id
                LEFT JOIN (
                    SELECT loser_id, COUNT(*) as losses 
                    FROM matches 
                    WHERE loser_id = ${id}
                    GROUP BY loser_id
                ) l ON p.id = l.loser_id
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
          total_spent: 0,
          matches_played: 0,
          win_rate: 0,
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
