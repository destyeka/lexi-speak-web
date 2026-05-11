export const CATEGORY_MAP = {
  music: "MUS",
  identity: "ID",
  education: "EDU",
  culinary: "CUL",
  travel: "TRV",
  art: "ART",
  sports: "SPT",
  technology: "TECH",
  health: "HLT",
  business: "BUS",
} as const;

export type CategoryName = keyof typeof CATEGORY_MAP;