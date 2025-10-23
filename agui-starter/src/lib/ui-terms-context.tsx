"use client";

import { createContext, useContext, type ReactNode } from "react";

import { DEFAULT_UI_TERMS, type UiTerms } from "@/lib/ui-terms";

export const UiTermsContext = createContext<UiTerms>(DEFAULT_UI_TERMS);

export function UiTermsProvider({
  terms,
  children,
}: {
  terms: UiTerms;
  children: ReactNode;
}) {
  return <UiTermsContext.Provider value={terms}>{children}</UiTermsContext.Provider>;
}

export function useUiTerms(): UiTerms {
  return useContext(UiTermsContext);
}
