import sql from "../db";
import { BaseModel } from "./BaseModel";
import { NotFoundError } from "../errors";
import { logger } from "../utils/logger";
import type { Badge, PlayerBadge, AwardBadgeDTO } from "../types";

export class BadgeModel extends BaseModel {
  protected static override tableName = "badges";

  static override async createTable(): Promise<void> {
    try {
      // Create badges table
      await sql`
        CREATE TABLE IF NOT EXISTS badges (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          criterion TEXT NOT NULL,
          short_description TEXT NOT NULL,
          icon VARCHAR(10) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create player_badges junction table
      await sql`
        CREATE TABLE IF NOT EXISTS player_badges (
          id SERIAL PRIMARY KEY,
          player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
          badge_id VARCHAR(50) NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
          match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
          awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(player_id, badge_id, match_id)
        )
      `;

      // Create indexes
      await sql`
        CREATE INDEX IF NOT EXISTS idx_player_badges_player ON player_badges(player_id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_player_badges_badge ON player_badges(badge_id)
      `;

      logger.info("Badge tables created successfully");
    } catch (error) {
      this.handleDatabaseError(error, "create badge tables");
    }
  }

  // Seed initial badges
  static async seedBadges(): Promise<void> {
    try {
      const badges = [
        {
          id: "turtle-miracle",
          name: "Thần Rùa",
          criterion:
            "Người chơi bắn bi không chủ đích nhưng cuối cùng vẫn vào lỗ",
          short_description: "Ghi nhận pha bắn 'may mắn' dẫn đến chiến thắng.",
          icon: "🐢",
        },
        {
          id: "annihilator",
          name: "Kẻ Hủy Diệt",
          criterion: "Chuỗi chiến thắng liên tiếp >= 5 trận",
          short_description: "Trao cho người chơi có chuỗi thắng mạnh mẽ.",
          icon: "🔥",
        },
        {
          id: "bullet-warden",
          name: "Chúa Tể Chạy Đạn",
          criterion:
            "Lối chơi phòng thủ/an toàn xuất sắc (ít lỗi, nhiều phòng thủ thành công)",
          short_description: "Ghi nhận phong cách chơi phòng thủ và kiểm soát.",
          icon: "🛡️",
        },
      ];

      for (const badge of badges) {
        await sql`
          INSERT INTO badges (id, name, criterion, short_description, icon)
          VALUES (${badge.id}, ${badge.name}, ${badge.criterion}, ${badge.short_description}, ${badge.icon})
          ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name,
              criterion = EXCLUDED.criterion,
              short_description = EXCLUDED.short_description,
              icon = EXCLUDED.icon
        `;
      }

      logger.info("Badges seeded successfully");
    } catch (error) {
      this.handleDatabaseError(error, "seed badges");
    }
  }

  // Get all badges
  static async findAll(): Promise<Badge[]> {
    try {
      return await sql<Badge[]>`
        SELECT * FROM badges ORDER BY id
      `;
    } catch (error) {
      return this.handleDatabaseError(error, "find all badges");
    }
  }

  // Get badge by ID
  static async findById(id: string): Promise<Badge | null> {
    try {
      const [badge] = await sql<Badge[]>`
        SELECT * FROM badges WHERE id = ${id}
      `;
      return badge || null;
    } catch (error) {
      return this.handleDatabaseError(error, "find badge by id");
    }
  }

  // Award badge to player
  static async awardBadge(data: AwardBadgeDTO): Promise<PlayerBadge> {
    try {
      // Check if badge exists
      const badge = await this.findById(data.badge_id);
      if (!badge) {
        throw new NotFoundError("Badge", data.badge_id);
      }

      const [playerBadge] = await sql<PlayerBadge[]>`
        INSERT INTO player_badges (player_id, badge_id, match_id)
        VALUES (${data.player_id}, ${data.badge_id}, ${data.match_id || null})
        ON CONFLICT (player_id, badge_id, match_id) DO NOTHING
        RETURNING *
      `;

      if (!playerBadge) {
        // Badge already awarded
        const [existing] = await sql<PlayerBadge[]>`
          SELECT * FROM player_badges 
          WHERE player_id = ${data.player_id} 
          AND badge_id = ${data.badge_id}
          AND (match_id = ${data.match_id || null} OR (match_id IS NULL AND ${
          data.match_id
        } IS NULL))
        `;
        return existing;
      }

      logger.info("Badge awarded", {
        player_id: data.player_id,
        badge_id: data.badge_id,
      });

      return playerBadge;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      return this.handleDatabaseError(error, "award badge");
    }
  }

  // Get player badges
  static async getPlayerBadges(
    playerId: number
  ): Promise<(PlayerBadge & Badge)[]> {
    try {
      return await sql<(PlayerBadge & Badge)[]>`
        SELECT 
          pb.id,
          pb.player_id,
          pb.badge_id,
          pb.match_id,
          pb.awarded_at,
          b.name,
          b.criterion,
          b.short_description,
          b.icon
        FROM player_badges pb
        JOIN badges b ON pb.badge_id = b.id
        WHERE pb.player_id = ${playerId}
        ORDER BY pb.awarded_at DESC
      `;
    } catch (error) {
      return this.handleDatabaseError(error, "get player badges");
    }
  }

  // Get all player badges with player info
  static async getAllPlayerBadges(): Promise<any[]> {
    try {
      return await sql<any[]>`
        SELECT 
          pb.id,
          pb.player_id,
          pb.badge_id,
          pb.match_id,
          pb.awarded_at,
          p.name as player_name,
          b.name as badge_name,
          b.icon,
          b.short_description
        FROM player_badges pb
        JOIN players p ON pb.player_id = p.id
        JOIN badges b ON pb.badge_id = b.id
        ORDER BY pb.awarded_at DESC
      `;
    } catch (error) {
      return this.handleDatabaseError(error, "get all player badges");
    }
  }

  // Check if player has specific badge
  static async hasPlayerBadge(
    playerId: number,
    badgeId: string
  ): Promise<boolean> {
    try {
      const [result] = await sql<{ count: number }[]>`
        SELECT COUNT(*) as count
        FROM player_badges
        WHERE player_id = ${playerId} AND badge_id = ${badgeId}
      `;
      return result ? result.count > 0 : false;
    } catch (error) {
      this.handleDatabaseError(error, "check player badge");
      return false;
    }
  }

  // Remove badge from player
  static async removeBadge(playerId: number, badgeId: string): Promise<void> {
    try {
      await sql`
        DELETE FROM player_badges
        WHERE player_id = ${playerId} AND badge_id = ${badgeId}
      `;
      logger.info("Badge removed", { player_id: playerId, badge_id: badgeId });
    } catch (error) {
      this.handleDatabaseError(error, "remove badge");
    }
  }
}
