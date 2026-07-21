import { apiClient } from './client';

export type PlanAudience = 'USER_PREMIUM' | 'VENDOR' | 'CREATOR';

export interface Entitlements {
  isPremium: boolean;
  showAds: boolean;
  premiumBadge: string | null;
  premiumTheme: boolean;
  premiumExpiresAt: string | null;
  premiumPlan: any;
  vendorSubscription: any;
  creatorMembership: any;
  subscriptions: any[];
}

export const monetizationApi = {
  async getEntitlements(): Promise<Entitlements> {
    const res = await apiClient.get<Entitlements>('/monetization/entitlements/me');
    return (res as any).data ?? res;
  },

  async listPlans(audience: PlanAudience) {
    const res = await apiClient.get(`/monetization/plans?audience=${audience}`);
    return (res as any).data ?? res;
  },

  async getAdConfig(params?: { country?: string; appVersion?: string; platform?: string }) {
    const q = new URLSearchParams();
    if (params?.country) q.set('country', params.country);
    if (params?.appVersion) q.set('appVersion', params.appVersion);
    if (params?.platform) q.set('platform', params.platform);
    const res = await apiClient.get(`/monetization/ads/config?${q.toString()}`);
    return (res as any).data ?? res;
  },

  async createRazorpayOrder(planId: string, period: 'MONTHLY' | 'SEMIANNUAL' | 'YEARLY') {
    const res = await apiClient.post('/monetization/razorpay/order', { planId, period });
    return (res as any).data ?? res;
  },

  async verifyRazorpayPayment(body: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    planId: string;
    period: 'MONTHLY' | 'SEMIANNUAL' | 'YEARLY';
  }) {
    const res = await apiClient.post('/monetization/razorpay/verify', body);
    return (res as any).data ?? res;
  },

  async verifyIap(body: {
    platform: 'android' | 'ios';
    productId: string;
    purchaseToken: string;
    transactionId?: string;
    planId: string;
    period: 'MONTHLY' | 'SEMIANNUAL' | 'YEARLY';
  }) {
    const res = await apiClient.post('/monetization/iap/verify', body);
    return (res as any).data ?? res;
  },

  async listTransactions(page = 1) {
    const res = await apiClient.get(`/monetization/transactions/me?page=${page}`);
    return res;
  },

  async listInvoices(page = 1) {
    const res = await apiClient.get(`/monetization/invoices/me?page=${page}`);
    return res;
  },

  async getPlan(id: string) {
    const res = await apiClient.get(`/monetization/plans/${id}`);
    return (res as any).data ?? res;
  },

  async exportVendorCustomersCsv() {
    return apiClient.get('/monetization/vendor/customers/export.csv');
  },

  /** Absolute or relative PDF URL for GST invoice download */
  async getInvoiceUrl(invoiceOrTxId: string): Promise<{ url: string } | string> {
    const res = await apiClient.get(`/monetization/invoices/${invoiceOrTxId}/pdf`);
    return (res as any).data ?? res;
  },

  async vendorCustomers(q?: string, page = 1) {
    const qs = new URLSearchParams({ page: String(page) });
    if (q) qs.set('q', q);
    const res = await apiClient.get(`/monetization/vendor/customers?${qs}`);
    return res;
  },

  async uploadVendorDocument(type: string, fileUrl: string, fileName?: string) {
    const res = await apiClient.post('/monetization/vendor/documents', { type, fileUrl, fileName });
    return (res as any).data ?? res;
  },

  async listVendorDocuments() {
    const res = await apiClient.get('/monetization/vendor/documents');
    return (res as any).data ?? res;
  },

  async createVendorCoupon(body: {
    code: string;
    type: 'PERCENTAGE' | 'FLAT' | 'BOGO';
    value: number;
  }) {
    const res = await apiClient.post('/monetization/vendor/coupons', body);
    return (res as any).data ?? res;
  },
};
