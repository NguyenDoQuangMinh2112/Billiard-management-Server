import { Elysia, t } from "elysia";
import { duelService } from "../services/duelService";

export const duelRouter = new Elysia({ prefix: "/duel" })
  // ── Sessions ────────────────────────────────────────────────────────────────

  // GET /api/duel/sessions — list all sessions
  .get(
    "/sessions",
    async ({ query }) => {
      try {
        const limit = query.limit ? parseInt(query.limit) : 20;
        const sessions = await duelService.getAllSessions(limit);
        return { success: true, data: sessions };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch sessions",
        };
      }
    },
    {
      query: t.Object({ limit: t.Optional(t.String()) }),
    },
  )

  // GET /api/duel/sessions/:id — single session with rounds
  .get(
    "/sessions/:id",
    async ({ params }) => {
      try {
        const session = await duelService.getSessionById(params.id);
        const rounds = await duelService.getRoundsForSession(params.id);
        return { success: true, data: { ...session, rounds } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Session not found",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // POST /api/duel/sessions — create new session
  .post(
    "/sessions",
    async ({ body }) => {
      try {
        const session = await duelService.createSession(body);
        return { success: true, data: session };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to create session",
        };
      }
    },
    {
      body: t.Object({
        player1Name: t.String({ minLength: 1 }),
        player2Name: t.String({ minLength: 1 }),
      }),
    },
  )

  // PATCH /api/duel/sessions/:id/complete — mark session as completed
  .patch(
    "/sessions/:id/complete",
    async ({ params, body }) => {
      try {
        const session = await duelService.completeSession({
          sessionId: params.id,
          totalCost: body.totalCost,
          payerType: body.payerType,
        });
        return { success: true, data: session };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to complete session",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        totalCost: t.Number({ minimum: 0 }),
        payerType: t.Union([
          t.Literal("player1"),
          t.Literal("player2"),
          t.Literal("split"),
        ]),
      }),
    },
  )

  // DELETE /api/duel/sessions/:id — delete session and all its rounds
  .delete(
    "/sessions/:id",
    async ({ params }) => {
      try {
        await duelService.deleteSession(params.id);
        return { success: true, message: "Session deleted" };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to delete session",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // ── Rounds ──────────────────────────────────────────────────────────────────

  // POST /api/duel/rounds — add a round to a session
  .post(
    "/rounds",
    async ({ body }) => {
      try {
        const round = await duelService.addRound(body);
        return { success: true, data: round };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to add round",
        };
      }
    },
    {
      body: t.Object({
        sessionId: t.String(),
        player1Wins: t.Number({ minimum: 0 }),
        player1Losses: t.Number({ minimum: 0 }),
        player2Wins: t.Number({ minimum: 0 }),
        player2Losses: t.Number({ minimum: 0 }),
        cost: t.Number({ minimum: 0 }),
        payerType: t.Union([
          t.Literal("player1"),
          t.Literal("player2"),
          t.Literal("split"),
        ]),
      }),
    },
  )

  // GET /api/duel/sessions/:id/rounds — get all rounds for a session
  .get(
    "/sessions/:id/rounds",
    async ({ params }) => {
      try {
        const rounds = await duelService.getRoundsForSession(params.id);
        return { success: true, data: rounds };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch rounds",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // DELETE /api/duel/rounds/:id — delete a single round
  .delete(
    "/rounds/:id",
    async ({ params }) => {
      try {
        await duelService.deleteRound(params.id);
        return { success: true, message: "Round deleted" };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to delete round",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // ── Players ─────────────────────────────────────────────────────────────────

  // GET /api/duel/players/directory — lightweight player list for selects
  .get("/players/directory", async () => {
    try {
      const players = await duelService.getPlayerDirectory();
      return { success: true, data: players };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch player directory",
      };
    }
  })

  // GET /api/duel/players — get all 1v1 players with stats
  .get("/players", async () => {
    try {
      const players = await duelService.getAllPlayers();
      return { success: true, data: players };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch players",
      };
    }
  })

  // GET /api/duel/leaderboard?limit=20 — ranked players by wins
  .get(
    "/leaderboard",
    async ({ query }) => {
      try {
        const limit = query.limit ? parseInt(query.limit) : 20;
        const players = await duelService.getLeaderboard(limit);
        return { success: true, data: players };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch leaderboard",
        };
      }
    },
    {
      query: t.Object({ limit: t.Optional(t.String()) }),
    },
  )

  // GET /api/duel/history?limit=50 — sessions with rounds (completed + active)
  .get(
    "/history",
    async ({ query }) => {
      try {
        const limit = query.limit ? parseInt(query.limit) : 50;
        const sessions = await duelService.getHistory(limit);
        return { success: true, data: sessions };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch history",
        };
      }
    },
    {
      query: t.Object({ limit: t.Optional(t.String()) }),
    },
  );
