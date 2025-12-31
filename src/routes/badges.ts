import { Elysia, t } from "elysia";
import { badgeService } from "../services/badgeService";

export const badgesRouter = new Elysia({ prefix: "/badges" })
  // Get all badges
  .get("/", async () => {
    try {
      const badges = await badgeService.getAllBadges();
      return { success: true, data: badges };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch badges",
      };
    }
  })

  // Get badge by ID
  .get(
    "/:id",
    async ({ params }) => {
      try {
        const badge = await badgeService.getBadgeById(params.id);
        if (!badge) {
          return { success: false, error: "Badge not found" };
        }
        return { success: true, data: badge };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch badge",
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // Get all player badges
  .get("/players/all", async () => {
    try {
      const playerBadges = await badgeService.getAllPlayerBadges();
      return { success: true, data: playerBadges };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch player badges",
      };
    }
  })

  // Get badges for a specific player
  .get(
    "/player/:playerId",
    async ({ params }) => {
      try {
        const playerId = parseInt(params.playerId);
        if (isNaN(playerId)) {
          return { success: false, error: "Invalid player ID" };
        }
        const badges = await badgeService.getPlayerBadges(playerId);
        return { success: true, data: badges };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch player badges",
        };
      }
    },
    {
      params: t.Object({
        playerId: t.String(),
      }),
    }
  )

  // Award badge to player
  .post(
    "/award",
    async ({ body }) => {
      try {
        const badge = await badgeService.awardBadge(body);
        return { success: true, data: badge };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to award badge",
        };
      }
    },
    {
      body: t.Object({
        player_id: t.Number(),
        badge_id: t.String(),
        match_id: t.Optional(t.String()),
      }),
    }
  )

  // Award Turtle Miracle badge (special endpoint for manual lucky shot awards)
  .post(
    "/award-turtle-miracle",
    async ({ body }) => {
      try {
        const badge = await badgeService.awardTurtleMiracle(
          body.player_id,
          body.match_id
        );
        return { success: true, data: badge };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to award Turtle Miracle badge",
        };
      }
    },
    {
      body: t.Object({
        player_id: t.Number(),
        match_id: t.Optional(t.String()),
      }),
    }
  )

  // Remove badge from player
  .delete(
    "/player/:playerId/badge/:badgeId",
    async ({ params }) => {
      try {
        const playerId = parseInt(params.playerId);
        if (isNaN(playerId)) {
          return { success: false, error: "Invalid player ID" };
        }
        await badgeService.removeBadge(playerId, params.badgeId);
        return { success: true, message: "Badge removed successfully" };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to remove badge",
        };
      }
    },
    {
      params: t.Object({
        playerId: t.String(),
        badgeId: t.String(),
      }),
    }
  )

  // Manually trigger badge check for a player
  .post(
    "/check/:playerId",
    async ({ params }) => {
      try {
        const playerId = parseInt(params.playerId);
        if (isNaN(playerId)) {
          return { success: false, error: "Invalid player ID" };
        }
        await badgeService.checkAllBadges(playerId);
        return { success: true, message: "Badge check completed" };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to check badges",
        };
      }
    },
    {
      params: t.Object({
        playerId: t.String(),
      }),
    }
  );
