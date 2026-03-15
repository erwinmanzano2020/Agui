import type { Cart } from "./types";

const KEY = (companyId: string, deviceId: string) => `agui:pos:${companyId}:${deviceId}`;

export function loadLocalCart(companyId: string, deviceId: string): Cart | null {
  try {
    const raw = localStorage.getItem(KEY(companyId, deviceId));
    return raw ? JSON.parse(raw) as Cart : null;
  } catch {
    return null;
  }
}

export function saveLocalCart(cart: Cart) {
  try {
    localStorage.setItem(KEY(cart.companyId, cart.deviceId), JSON.stringify(cart));
  } catch {
    // ignore quota errors
  }
}
