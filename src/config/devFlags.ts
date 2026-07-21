export const DEV_FLAGS = {
  SHOW_DEV_GPS_PANEL: __DEV__,
  SHOW_ADMIN_ACCESS: __DEV__,
  SHOW_PARTNER_ACCESS: __DEV__,
  ENABLE_MANUAL_REDEMPTION_CODE: __DEV__,
  USE_SERVER_API: true,
  /** Keep false so login hits production API where credentials are seeded. Set true only when local server is running. */
  USE_LOCAL_API: false,
  /** When true (dev only), always show onboarding after splash so you can re-test the flow. */
  FORCE_SHOW_ONBOARDING: true,
};
