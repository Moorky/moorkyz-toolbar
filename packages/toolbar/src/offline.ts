export const CONNECTIVITY_STATUSES = Object.freeze([
  "unknown",
  "online",
  "offline",
] as const);

export type ToolbarConnectivityStatus = (typeof CONNECTIVITY_STATUSES)[number];

export function isToolbarConnectivityStatus(
  value: unknown,
): value is ToolbarConnectivityStatus {
  return CONNECTIVITY_STATUSES.some((status) => status === value);
}
