// Build-time config. NEXT_PUBLIC_* values are baked into the static export.
export const config = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8020").replace(/\/+$/, ""),
  /** The A8 screens (users, action log, announcements, current affairs, daily quiz) have no backend routes yet, so they answer from the browser until this is set to "false". */
  useMocks: process.env.NEXT_PUBLIC_USE_MOCKS !== "false",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
} as const;

export const API_PREFIX = "/api/v1";
