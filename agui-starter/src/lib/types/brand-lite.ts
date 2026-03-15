// src/lib/types/brand-lite.ts
export type BrandLite = { id: string; slug: string; name: string };

export type UserCapabilities = {
  isGM: boolean;
  loyaltyBrands: BrandLite[];
  employeeBrands: BrandLite[];
  ownerBrands: BrandLite[];
};
