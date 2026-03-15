import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasAllianceRole,
  hasGuildRole,
  hasHouseRole,
  type AllianceRoleLike,
  type GuildRoleLike,
  type HouseRoleLike,
} from "./roles";

describe("role helpers", () => {
  const allianceRoles: AllianceRoleLike[] = [
    {
      alliance_id: "alliance-1",
      entity_id: "entity-1",
      role: "LEADER",
    },
    {
      alliance_id: "alliance-1",
      entity_id: "entity-2",
      role: "SCRIBE",
    },
  ];

  const guildRoles: GuildRoleLike[] = [
    {
      guild_id: "guild-1",
      entity_id: "entity-1",
      role: "CAPTAIN",
    },
  ];

  const houseRoles: HouseRoleLike[] = [
    {
      house_id: "house-1",
      entity_id: "entity-1",
      role: "STEWARD",
    },
  ];

  it("detects alliance role membership with case-insensitive match", () => {
    assert.equal(
      hasAllianceRole({ roles: allianceRoles, entityId: "entity-1", allianceId: "alliance-1", role: "leader" }),
      true,
    );
  });

  it("supports checking against multiple allowed roles", () => {
    assert.equal(
      hasAllianceRole({
        roles: allianceRoles,
        entityId: "entity-2",
        allianceId: "alliance-1",
        role: ["leader", "scribe"],
      }),
      true,
    );
  });

  it("returns false when the entity does not hold the requested alliance role", () => {
    assert.equal(
      hasAllianceRole({ roles: allianceRoles, entityId: "entity-2", allianceId: "alliance-1", role: "leader" }),
      false,
    );
  });

  it("detects guild role membership", () => {
    assert.equal(
      hasGuildRole({ roles: guildRoles, entityId: "entity-1", guildId: "guild-1", role: "captain" }),
      true,
    );
  });

  it("returns false for guild role checks when entity is missing", () => {
    assert.equal(
      hasGuildRole({ roles: guildRoles, entityId: "entity-2", guildId: "guild-1", role: "captain" }),
      false,
    );
  });

  it("detects house role membership without specifying a role", () => {
    assert.equal(hasHouseRole({ roles: houseRoles, entityId: "entity-1", houseId: "house-1" }), true);
  });

  it("respects scope filtering for house roles", () => {
    assert.equal(hasHouseRole({ roles: houseRoles, entityId: "entity-1", houseId: "house-2" }), false);
  });
});
