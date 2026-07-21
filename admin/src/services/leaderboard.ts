import client from "./client";

export async function getLeaderboard(params?: { page?: number; limit?: number }) {
  const res = await client.get("/wallet/leaderboard", { params });
  return res.data;
}
