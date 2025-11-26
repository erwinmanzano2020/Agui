import { useMemo, useReducer } from "react";

export type CartUom = { id: string; code: string; label: string | null; factorToBase: number };

export type PosCartLine = {
  id: string;
  itemId: string;
  itemName: string;
  barcode?: string | null;
  uomId: string | null;
  uomCode: string;
  uomLabel: string | null;
  quantity: number;
  unitPrice: number;
  tierTag: string | null;
  lineTotal: number;
  uoms: CartUom[];
};

export type PosCartState = {
  lines: PosCartLine[];
  subtotal: number;
  lastLineId: string | null;
};

export type AddOrUpdateLineInput = Omit<PosCartLine, "lineTotal" | "id"> & { id?: string };

export type PriceInfo = { unitPrice: number; tierTag: string | null };

export type CartAction =
  | { type: "add"; payload: AddOrUpdateLineInput }
  | { type: "remove"; id: string }
  | { type: "reset" }
  | { type: "quantity"; id: string; quantity: number; price?: PriceInfo }
  | { type: "uom"; id: string; uom: CartUom; price?: PriceInfo }
  | { type: "repeat" };

function computeLineTotal(unitPrice: number, quantity: number): number {
  return Math.max(0, Math.round(unitPrice * quantity));
}

function findExistingIndex(lines: PosCartLine[], payload: AddOrUpdateLineInput): number {
  return lines.findIndex((line) => line.itemId === payload.itemId && line.uomId === payload.uomId);
}

function recalcSubtotal(lines: PosCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.lineTotal, 0);
}

export function cartReducer(state: PosCartState, action: CartAction): PosCartState {
  switch (action.type) {
    case "add": {
      const incomingId = action.payload.id ?? crypto.randomUUID();
      const nextLines = [...state.lines];
      const idx = findExistingIndex(state.lines, action.payload);

      if (idx >= 0) {
        const existing = nextLines[idx]!;
        const quantity = action.payload.quantity;
        const unitPrice = action.payload.unitPrice;
        nextLines[idx] = {
          ...existing,
          quantity,
          unitPrice,
          tierTag: action.payload.tierTag,
          lineTotal: computeLineTotal(unitPrice, quantity),
          barcode: action.payload.barcode ?? existing.barcode,
          uoms: action.payload.uoms ?? existing.uoms,
        };
      } else {
        const lineTotal = computeLineTotal(action.payload.unitPrice, action.payload.quantity);
        nextLines.push({
          ...action.payload,
          id: incomingId,
          lineTotal,
        });
      }

      return {
        lines: nextLines,
        subtotal: recalcSubtotal(nextLines),
        lastLineId: nextLines.length > 0 ? nextLines[nextLines.length - 1]!.id : null,
      };
    }
    case "quantity": {
      const nextLines = state.lines.map((line) => {
        if (line.id !== action.id) return line;
        const quantity = Math.max(0, action.quantity);
        const unitPrice = action.price?.unitPrice ?? line.unitPrice;
        return {
          ...line,
          quantity,
          unitPrice,
          tierTag: action.price?.tierTag ?? line.tierTag,
          lineTotal: computeLineTotal(unitPrice, quantity),
        };
      });
      return { lines: nextLines, subtotal: recalcSubtotal(nextLines), lastLineId: state.lastLineId };
    }
    case "uom": {
      const nextLines = state.lines.map((line) => {
        if (line.id !== action.id) return line;
        const unitPrice = action.price?.unitPrice ?? line.unitPrice;
        const quantity = line.quantity;
        return {
          ...line,
          uomId: action.uom.id,
          uomCode: action.uom.code,
          uomLabel: action.uom.label,
          unitPrice,
          tierTag: action.price?.tierTag ?? line.tierTag,
          lineTotal: computeLineTotal(unitPrice, quantity),
        };
      });
      return { lines: nextLines, subtotal: recalcSubtotal(nextLines), lastLineId: state.lastLineId };
    }
    case "remove": {
      const remaining = state.lines.filter((line) => line.id !== action.id);
      return {
        lines: remaining,
        subtotal: recalcSubtotal(remaining),
        lastLineId: remaining.length > 0 ? remaining[remaining.length - 1]!.id : null,
      };
    }
    case "repeat": {
      const last = state.lines.find((line) => line.id === state.lastLineId);
      if (!last) return state;
      const clone: PosCartLine = {
        ...last,
        id: crypto.randomUUID(),
      };
      const lines = [...state.lines, clone];
      return { lines, subtotal: recalcSubtotal(lines), lastLineId: clone.id };
    }
    case "reset": {
      return { lines: [], subtotal: 0, lastLineId: null };
    }
    default:
      return state;
  }
}

export function createCartState(initial?: Partial<PosCartState>): PosCartState {
  return {
    lines: initial?.lines ?? [],
    subtotal: initial?.subtotal ?? 0,
    lastLineId: initial?.lastLineId ?? null,
  };
}

export function usePosCart(initial?: Partial<PosCartState>) {
  const [state, dispatch] = useReducer(cartReducer, createCartState(initial));

  const actions = useMemo(
    () => ({
      addOrUpdateLine: (payload: AddOrUpdateLineInput) => dispatch({ type: "add", payload }),
      updateQuantity: (id: string, quantity: number, price?: PriceInfo) =>
        dispatch({ type: "quantity", id, quantity, price }),
      changeUom: (id: string, uom: CartUom, price?: PriceInfo) => dispatch({ type: "uom", id, uom, price }),
      removeLine: (id: string) => dispatch({ type: "remove", id }),
      repeatLastLine: () => dispatch({ type: "repeat" }),
      resetCart: () => dispatch({ type: "reset" }),
    }),
    [],
  );

  return { state, ...actions };
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(
    amount / 100,
  );
}
