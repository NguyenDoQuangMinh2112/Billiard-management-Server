// API Integration Helper for Billiard Management Frontend
// This file can be used in the React frontend to connect to the backend

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// API Response Type
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// API Client Class
class BilliardAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      const data = (await response.json()) as ApiResponse<T>;
      return data;
    } catch (error) {
      console.error("API Error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  // Players
  async getPlayers() {
    return this.request("/players");
  }

  async createPlayer(name: string) {
    return this.request("/players", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async deletePlayer(id: number) {
    return this.request(`/players/${id}`, {
      method: "DELETE",
    });
  }

  // Matches
  async getMatches() {
    return this.request("/matches");
  }

  async getRecentMatches(limit: number = 10) {
    return this.request(`/matches/recent?limit=${limit}`);
  }

  async createMatch(winner: string, loser: string, cost: number) {
    return this.request("/matches", {
      method: "POST",
      body: JSON.stringify({ winner, loser, cost }),
    });
  }

  async deleteMatch(id: string) {
    return this.request(`/matches/${id}`, {
      method: "DELETE",
    });
  }

  async getNextPayer() {
    return this.request("/matches/payer/next");
  }

  // Statistics
  async getStats() {
    return this.request("/stats");
  }

  async getPlayerStats(id: number) {
    return this.request(`/stats/player/${id}`);
  }

  async getExpenses(timeframe: "week" | "month" | "year" | "all" = "month") {
    return this.request(`/stats/expenses?timeframe=${timeframe}`);
  }

  async getLeaderboard(limit: number = 10) {
    return this.request(`/stats/leaderboard?limit=${limit}`);
  }
}

// Export singleton instance
export const billiardAPI = new BilliardAPI();

// Example usage in React components:
/*
import { billiardAPI } from './api-helper';

// In a component:
const { data: players } = await billiardAPI.getPlayers();
const { data: stats } = await billiardAPI.getStats();
const { data: nextPayer } = await billiardAPI.getNextPayer();

// Create a match
await billiardAPI.createMatch('Minh', 'Toàn', 100000);

// Get expenses
const { data: expenses } = await billiardAPI.getExpenses('month');
*/
