import { DuelModel } from "../models/DuelModel";
import type {
  CreateDuelSessionDTO,
  CreateDuelRoundDTO,
  CompleteDuelSessionDTO,
} from "../types";

export const duelService = {
  // ── Sessions ────────────────────────────────────────────────────────────────

  async getAllSessions(limit = 20) {
    return DuelModel.getSessions(limit);
  },

  async getSessionById(id: string) {
    const session = await DuelModel.getSessionById(id);
    if (!session) throw new Error(`Duel session not found: ${id}`);
    return session;
  },

  async createSession(dto: CreateDuelSessionDTO) {
    const p1 = await DuelModel.findOrCreatePlayer(dto.player1Name);
    const p2 = await DuelModel.findOrCreatePlayer(dto.player2Name);

    if (p1.id === p2.id) {
      throw new Error("Player 1 and Player 2 must be different");
    }

    return DuelModel.createSession(p1.id, p2.id);
  },

  async completeSession(dto: CompleteDuelSessionDTO) {
    const session = await DuelModel.getSessionById(dto.sessionId);
    if (!session) throw new Error(`Duel session not found: ${dto.sessionId}`);

    // Resolve payer_id from payer_type
    let payerId: number | null = null;
    if (dto.payerType === "player1") payerId = session.player1_id;
    else if (dto.payerType === "player2") payerId = session.player2_id;
    // 'split' → payerId stays null

    return DuelModel.completeSession(
      dto.sessionId,
      dto.totalCost,
      dto.payerType,
      payerId,
    );
  },

  async deleteSession(id: string) {
    const session = await DuelModel.getSessionById(id);
    if (!session) throw new Error(`Duel session not found: ${id}`);
    await DuelModel.deleteSession(id);
  },

  // ── Rounds ──────────────────────────────────────────────────────────────────

  async addRound(dto: CreateDuelRoundDTO) {
    const session = await DuelModel.getSessionById(dto.sessionId);
    if (!session) throw new Error(`Duel session not found: ${dto.sessionId}`);
    if (session.status === "completed") {
      throw new Error("Cannot add rounds to a completed session");
    }

    // Determine winner based on score differentials
    const diff1 = dto.player1Wins - dto.player1Losses;
    const diff2 = dto.player2Wins - dto.player2Losses;
    let winnerId: number | null = null;
    if (diff1 > diff2) winnerId = session.player1_id;
    else if (diff2 > diff1) winnerId = session.player2_id;
    // diff1 === diff2 → draw → winnerId stays null

    // Resolve payer_id
    let payerId: number | null = null;
    if (dto.payerType === "player1") payerId = session.player1_id;
    else if (dto.payerType === "player2") payerId = session.player2_id;

    return DuelModel.addRound(
      dto.sessionId,
      winnerId,
      dto.player1Wins,
      dto.player1Losses,
      dto.player2Wins,
      dto.player2Losses,
      dto.cost,
      dto.payerType,
      payerId,
    );
  },

  async getRoundsForSession(sessionId: string) {
    return DuelModel.getRoundsBySession(sessionId);
  },

  async deleteRound(id: string) {
    await DuelModel.deleteRound(id);
  },

  // ── Players ─────────────────────────────────────────────────────────────────

  async getAllPlayers() {
    return DuelModel.getAllPlayers();
  },

  async getPlayerDirectory() {
    return DuelModel.getPlayerDirectory();
  },

  async getLeaderboard(limit = 20) {
    return DuelModel.getLeaderboard(limit);
  },

  async getHistory(limit = 50) {
    return DuelModel.getHistory(limit);
  },
};
