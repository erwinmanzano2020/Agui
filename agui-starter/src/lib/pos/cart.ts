import type { Cart, CartLine, Money } from "./types";

export function newCart(companyId: string, deviceId: string): Cart {
  return { companyId, deviceId, status: "OPEN", lines: [], grandTotal: 0, version: 0, localSeq: 0 };
}

export function computeLineTotal(unitPrice: Money, qty: number, multiplier: number): Money {
  return Math.max(0, Math.round(unitPrice * qty * multiplier));
}

export function priceLines(cart: Cart): Cart {
  for (const line of cart.lines) {
    line.lineTotal = computeLineTotal(line.unitPrice, line.qty, line.multiplier);
  }
  cart.grandTotal = cart.lines.reduce((s, l) => s + l.lineTotal, 0);
  return cart;
}

export function addOrBumpLine(cart: Cart, line: Omit<CartLine, "lineNo" | "lineTotal">): Cart {
  const existing = cart.lines.find(l => l.itemId === line.itemId && l.uom === line.uom && l.multiplier === line.multiplier);
  if (existing) {
    existing.qty += line.qty;
  } else {
    cart.lines.push({ ...line, lineNo: cart.lines.length + 1, lineTotal: 0 });
  }
  return priceLines(cart);
}

export function setQty(cart: Cart, lineNo: number, qty: number): Cart {
  const ln = cart.lines.find(l => l.lineNo === lineNo);
  if (ln) ln.qty = Math.max(0, qty);
  return priceLines(cart);
}

export function removeLine(cart: Cart, lineNo: number): Cart {
  cart.lines = cart.lines.filter(l => l.lineNo !== lineNo).map((l, i) => ({ ...l, lineNo: i + 1 }));
  return priceLines(cart);
}
