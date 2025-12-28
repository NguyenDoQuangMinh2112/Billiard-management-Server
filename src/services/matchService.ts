import { MatchModel } from "../models/MatchModel";
import { PayerRotationModel } from "../models/PayerRotationModel";
import sql from "../db";
import type {
  Match,
  MatchWithNames,
  CreateMatchDTO,
  ExpenseData,
} from "../types";
import { playerService } from "./playerService";

export class MatchService {
  // Get all matches with player names
  async getAllMatches(): Promise<MatchWithNames[]> {
    return await MatchModel.findAll();
  }

  // Get match by ID
  async getMatchById(id: string): Promise<MatchWithNames | null> {
    return await MatchModel.findById(id);
  }

  // Create a new match
  async createMatch(data: CreateMatchDTO): Promise<MatchWithNames> {
    // Get player IDs
    const winner = await playerService.getPlayerByName(data.winner);
    const loser = await playerService.getPlayerByName(data.loser);

    if (!winner || !loser) {
      throw new Error("Winner or loser not found");
    }

    if (winner.id === loser.id) {
      throw new Error("Winner and loser must be different players");
    }

    // Get current payer from rotation
    const currentPayer = await PayerRotationModel.getCurrentPayer();
    if (!currentPayer) {
      throw new Error("Payer rotation not initialized");
    }

    // Create the match
    const match = await MatchModel.create(
      data.winner,
      data.loser,
      currentPayer.current_payer_id,
      data.cost
    );

    // Rotate to next payer
    await PayerRotationModel.rotateToNextPayer();

    // Get the match with names
    const matchWithNames = await this.getMatchById(match.id);
    if (!matchWithNames) {
      throw new Error("Failed to retrieve created match");
    }

    return matchWithNames;
  }

  // Delete a match
  async deleteMatch(id: string): Promise<boolean> {
    return await MatchModel.delete(id);
  }

  // Get next payer information
  async getNextPayer(): Promise<{ id: number; name: string }> {
    const result = await PayerRotationModel.getCurrentPayerWithName();

    if (!result) {
      // Initialize with first player if not set
      const players = await playerService.getAllPlayers();
      if (players.length === 0) {
        throw new Error("No players available");
      }

      await PayerRotationModel.initializeWithFirstPlayer();
      const newResult = await PayerRotationModel.getCurrentPayerWithName();

      if (!newResult) {
        throw new Error("Failed to initialize payer rotation");
      }

      return newResult;
    }

    return result;
  }

  // Rotate to next payer (private method - no longer needed, moved to model)
  // private async rotateNextPayer(): Promise<void> { ... }

  // Get expenses by timeframe
  async getExpenses(
    timeframe: "week" | "month" | "year" | "all" = "month"
  ): Promise<ExpenseData> {
    return await MatchModel.getExpensesByTimeframe(timeframe);
  }

  // Get recent matches (limit)
  async getRecentMatches(limit: number = 10): Promise<MatchWithNames[]> {
    return await MatchModel.getRecentMatches(limit);
  }
}

export const matchService = new MatchService();
