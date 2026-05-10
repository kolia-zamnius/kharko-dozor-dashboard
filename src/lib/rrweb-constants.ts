export const RRWEB_EVENT_TYPE = {
  FullSnapshot: 2,
  IncrementalSnapshot: 3,
  Meta: 4,
  Custom: 5,
  Plugin: 6,
} as const;

export const DOZOR_MARKER_TAG = {
  url: "dozor:url",
  identity: "dozor:identity",
} as const;

export type DozorMarkerTag = (typeof DOZOR_MARKER_TAG)[keyof typeof DOZOR_MARKER_TAG];
