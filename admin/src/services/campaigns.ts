import client from "./client";

export const getCampaigns = async (params: any = {}) => {
  const res = await client.get("/campaigns", { params });
  return res.data;
};

export const getCampaignById = async (id: string) => {
  const res = await client.get(`/campaigns/${id}`);
  return res.data;
};

export const createCampaign = async (data: any) => {
  const res = await client.post("/campaigns", data);
  return res.data;
};

export const updateCampaign = async (id: string, data: any) => {
  const res = await client.patch(`/campaigns/${id}`, data);
  return res.data;
};

export const deleteCampaign = async (id: string) => {
  const res = await client.delete(`/campaigns/${id}`);
  return res.data;
};

export const getClaims = async (params: any = {}) => {
  const res = await client.get("/campaigns/admin/claims", { params });
  return res.data;
};

export const updateClaimStatus = async (id: string, status: string) => {
  const res = await client.patch(`/campaigns/admin/claims/${id}/status`, { status });
  return res.data;
};
