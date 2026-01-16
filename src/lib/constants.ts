export const ALLOWED_SHOPS = ["Klagon Shop", "Teshie Shop", "Online shop"] as const;
export type AllowedShop = typeof ALLOWED_SHOPS[number];
