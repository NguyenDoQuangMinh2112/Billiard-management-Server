import { BadgeModel } from "../models/BadgeModel";
import { MatchModel } from "../models/MatchModel";
import { logger } from "../utils/logger";
import sql from "../db";
import type { Badge, PlayerBadge, AwardBadgeDTO } from "../types";

export class BadgeService {
  // Get all badges
  async getAllBadges(): Promise<Badge[]> {
    return await BadgeModel.findAll();
  }

  // Get badge by ID
  async getBadgeById(id: string): Promise<Badge | null> {
    return await BadgeModel.findById(id);
  }

  // Get player badges
  async getPlayerBadges(playerId: number): Promise<(PlayerBadge & Badge)[]> {
    return await BadgeModel.getPlayerBadges(playerId);
  }

  // Get all player badges
  async getAllPlayerBadges(): Promise<any[]> {
    return await BadgeModel.getAllPlayerBadges();
  }

  // Award badge manually
  async awardBadge(data: AwardBadgeDTO): Promise<PlayerBadge> {
    return await BadgeModel.awardBadge(data);
  }

  // Remove badge from player
  async removeBadge(playerId: number, badgeId: string): Promise<void> {
    await BadgeModel.removeBadge(playerId, badgeId);
  }

  // Check and award "Annihilator" badge (5+ win streak)
  async checkAnnihilatorBadge(playerId: number): Promise<void> {
    try {
      // Check if player already has this badge
      const hasBadge = await BadgeModel.hasPlayerBadge(playerId, "annihilator");
      if (hasBadge) return;

      // Get recent matches for the player
      const matches = await sql<{ winner_id: number; date: Date }[]>`
        SELECT winner_id, date
        FROM matches
        WHERE winner_id = ${playerId} OR loser_id = ${playerId}
        ORDER BY date DESC
        LIMIT 10
      `;

      // Check for 5 consecutive wins
      let winStreak = 0;
      for (const match of matches) {
        if (match.winner_id === playerId) {
          winStreak++;
          if (winStreak >= 5) {
            await BadgeModel.awardBadge({
              player_id: playerId,
              badge_id: "annihilator",
            });
            logger.info("Annihilator badge awarded", { player_id: playerId });
            break;
          }
        } else {
          break; // Streak broken
        }
      }
    } catch (error) {
      logger.error("Error checking Annihilator badge", { error, playerId });
    }
  }

  // Check and award "Bullet Warden" badge (defensive play style)
  async checkBulletWardenBadge(playerId: number): Promise<void> {
    try {
      // Check if player already has this badge
      const hasBadge = await BadgeModel.hasPlayerBadge(
        playerId,
        "bullet-warden"
      );
      if (hasBadge) return;

      // Get player stats
      const [stats] = await sql<
        { wins: number; losses: number; matches_played: number }[]
      >`
        SELECT 
          COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN 1 ELSE 0 END), 0) as wins,
          COALESCE(SUM(CASE WHEN loser_id = ${playerId} THEN 1 ELSE 0 END), 0) as losses,
          COUNT(*) as matches_played
        FROM matches
        WHERE winner_id = ${playerId} OR loser_id = ${playerId}
      `;

      if (!stats || stats.matches_played < 10) return;

      // Award badge if win rate is >= 60% (defensive/controlled play)
      const winRate = (stats.wins / stats.matches_played) * 100;
      if (winRate >= 60) {
        await BadgeModel.awardBadge({
          player_id: playerId,
          badge_id: "bullet-warden",
        });
        logger.info("Bullet Warden badge awarded", { player_id: playerId });
      }
    } catch (error) {
      logger.error("Error checking Bullet Warden badge", { error, playerId });
    }
  }

  // Award "Turtle Miracle" badge (manual award for lucky shots)
  async awardTurtleMiracle(
    playerId: number,
    matchId?: string
  ): Promise<PlayerBadge> {
    return await BadgeModel.awardBadge({
      player_id: playerId,
      badge_id: "turtle-miracle",
      match_id: matchId,
    });
  }

  // Check all badges for a player after a match
  async checkAllBadges(playerId: number): Promise<void> {
    try {
      await Promise.all([
        this.checkAnnihilatorBadge(playerId),
        this.checkBulletWardenBadge(playerId),
      ]);
    } catch (error) {
      logger.error("Error checking badges", { error, playerId });
    }
  }

  // Check badges for both players after a match
  async checkBadgesAfterMatch(
    winnerId: number,
    loserId: number
  ): Promise<void> {
    try {
      await Promise.all([
        this.checkAllBadges(winnerId),
        this.checkAllBadges(loserId),
      ]);
    } catch (error) {
      logger.error("Error checking badges after match", { error });
    }
  }
}

export const badgeService = new BadgeService();
