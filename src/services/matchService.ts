import { MatchModel } from "../models/MatchModel";
import { PayerRotationModel } from "../models/PayerRotationModel";
import { MatchStatsModel } from "../models/MatchStatsModel";
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

  // Create a new match with enhanced validation and error handling
  async createMatch(data: CreateMatchDTO): Promise<MatchWithNames> {
    // Validate input data
    if (!data.winners || data.winners.length === 0) {
      throw new Error("At least one winner is required");
    }

    if (!data.loser) {
      throw new Error("Loser name is required");
    }

    if (typeof data.cost !== "number" || data.cost < 0) {
      throw new Error("Cost must be a non-negative number");
    }

    // Trim and normalize names
    const winnerNames = data.winners.map((name) => name.trim());
    const loserName = data.loser.trim();

    // Validate that winners don't include the loser
    if (winnerNames.includes(loserName)) {
      throw new Error("Winners cannot include the loser");
    }

    // Get player objects with better error messages
    const winners = [];
    for (const winnerName of winnerNames) {
      const winner = await playerService.getPlayerByName(winnerName);
      if (!winner) {
        throw new Error(
          `Player "${winnerName}" not found. Please check the name and try again.`
        );
      }
      winners.push(winner);
    }

    const loser = await playerService.getPlayerByName(loserName);
    if (!loser) {
      throw new Error(
        `Player "${loserName}" not found. Please check the name and try again.`
      );
    }

    // Validate no duplicates in winners
    const uniqueWinnerIds = new Set(winners.map((w) => w.id));
    if (uniqueWinnerIds.size !== winners.length) {
      throw new Error("Duplicate winners are not allowed");
    }

    // Get current payer from rotation
    const currentPayer = await PayerRotationModel.getCurrentPayer();
    if (!currentPayer) {
      // Initialize payer rotation if not set
      await PayerRotationModel.initializeWithFirstPlayer();
      const newPayer = await PayerRotationModel.getCurrentPayer();
      if (!newPayer) {
        throw new Error("Failed to initialize payer rotation system");
      }
    }

    const payer = await PayerRotationModel.getCurrentPayer();
    if (!payer) {
      throw new Error("Payer rotation not properly initialized");
    }

    try {
      // Create the match with validated data
      const match = await MatchModel.create(
        winnerNames,
        loserName,
        payer.current_payer_id,
        data.cost,
        data.participants
      );

      // Rotate to next payer after successful match creation
      await PayerRotationModel.rotateToNextPayer();

      // Save detailed stats if available
      if (data.details && data.details.length > 0) {
        for (const detail of data.details) {
          try {
            const player = await playerService.getPlayerByName(detail.name);
            if (player) {
              await MatchStatsModel.addStats(
                match.id,
                player.id,
                detail.wins,
                detail.losses
              );
            }
          } catch (e) {
            console.error("Error saving stats for player:", detail.name, e);
          }
        }
      } else if (data.participants && data.participants.length > 0) {
        // Fallback: If no details but participants exist
        // Winners get 1-0, Loser gets 0-1, others 0-0.
        for (const pName of data.participants) {
          try {
            const player = await playerService.getPlayerByName(pName);
            if (player) {
              const isWinner = winnerNames.includes(pName);
              const isLoser = pName === loserName;
              const wins = isWinner ? 1 : 0;
              const losses = isLoser ? 1 : 0;
              await MatchStatsModel.addStats(match.id, player.id, wins, losses);
            }
          } catch (e) {}
        }
      }

      // Get the match with names for response
      const matchWithNames = await this.getMatchById(match.id);
      if (!matchWithNames) {
        throw new Error("Failed to retrieve created match details");
      }

      const matchType = winnerNames.length > 1 ? "Draw" : "Win";
      console.log(
        `✅ Match created (${matchType}): ${winnerNames.join(
          ", "
        )} vs ${loserName}, Cost: ${data.cost}`
      );
      return matchWithNames;
    } catch (error) {
      console.error("Error creating match:", error);
      throw new Error(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while creating the match"
      );
    }
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
