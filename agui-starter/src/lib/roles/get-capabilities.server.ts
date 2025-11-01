// src/lib/roles/get-capabilities.server.ts
import { getCapabilities } from "@/lib/roles/capabilities";

export type BrandLite = { id: string; slug: string; name: string };

export type UserCapabilities = {
  isGM: boolean;
  loyaltyBrands: BrandLite[];
  employeeBrands: BrandLite[];
  ownerBrands: BrandLite[];
};

export async function getCapabilitiesForUser(
  userId: string,
  email?: string
): Promise<UserCapabilities> {
  const caps = await getCapabilities(userId, email);

  return {
    isGM: caps.isGM,
    loyaltyBrands: caps.loyaltyBrands.map((b) => ({ ...b })),
    employeeBrands: caps.employeeOf.map((b) => ({ ...b })),
    ownerBrands: caps.ownerOf.map((b) => ({ ...b })),
  };
}
