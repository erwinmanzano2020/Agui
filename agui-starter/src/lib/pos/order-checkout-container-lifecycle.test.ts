import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  PosOrderCheckoutContainerLifecycleError,
  getCurrentSessionOrderCheckoutContainerLifecycle,
} from "./order-checkout-container-lifecycle";
import type { OrderCheckoutContainerFoundationResult } from "./order-checkout-container-foundation";

type Scope = {
  houseId: string;
  branchId: string;
  sessionId: string;
  deviceId: string;
  orderId: string;
};

const SCOPE: Scope = {
  houseId: "house-1",
  branchId: "branch-1",
  sessionId: "session-1",
  deviceId: "device-1",
  orderId: "order-1",
};

function makeFoundation(overrides: Partial<OrderCheckoutContainerFoundationResult> = {}): OrderCheckoutContainerFoundationResult {
  return {
    containerFoundationStatus: "FOUNDATIONAL",
    canDefineCheckoutContainer: true,
    containerAnchorSummary: { ...SCOPE },
    blockingIssues: [],
    ...overrides,
  };
}

function createRepository(input?: {
  foundation?: OrderCheckoutContainerFoundationResult;
  foundationScope?: Scope;
  lifecycleState?: "ACTIVE" | "INVALIDATED" | null;
}) {
  const foundation = input?.foundation ?? makeFoundation();
  const foundationScope = input?.foundationScope ?? SCOPE;

  return {
    async getCheckoutContainerLifecycleSnapshot() {
      return {
        foundation,
        foundationScope: { ...foundationScope },
        lifecycleContext:
          input?.lifecycleState == null
            ? null
            : { containerLifecycleState: input.lifecycleState },
      };
    },
  };
}

test("missing repository throws structured Slice 7B lifecycle error", async () => {
  await assert.rejects(
    () => getCurrentSessionOrderCheckoutContainerLifecycle(SCOPE),
    (error: unknown) =>
      error instanceof PosOrderCheckoutContainerLifecycleError &&
      error.code === "ORDER_CHECKOUT_CONTAINER_LIFECYCLE_REPOSITORY_REQUIRED" &&
      error.status === 500,
  );
});

test("FOUNDATIONAL + clean snapshot => ENTERABLE and activatable", async () => {
  const result = await getCurrentSessionOrderCheckoutContainerLifecycle(SCOPE, createRepository());

  assert.equal(result.containerLifecycleState, "ENTERABLE");
  assert.equal(result.canActivateContainer, true);
  assert.deepEqual(result.invalidationReasons, []);
  assert.equal(result.lifecycleSummary.foundationStatus, "FOUNDATIONAL");
});

test("Slice 7A BLOCKED => INVALIDATED and non-activatable", async () => {
  const result = await getCurrentSessionOrderCheckoutContainerLifecycle(
    SCOPE,
    createRepository({
      foundation: makeFoundation({
        containerFoundationStatus: "BLOCKED",
        canDefineCheckoutContainer: false,
      }),
    }),
  );

  assert.equal(result.containerLifecycleState, "INVALIDATED");
  assert.equal(result.canActivateContainer, false);
  assert.equal(result.invalidationReasons[0]?.code, "CHECKOUT_CONTAINER_LIFECYCLE_FOUNDATION_BLOCKED");
});

test("ACTIVE only when explicit lifecycle context marks ACTIVE and foundation is FOUNDATIONAL", async () => {
  const activeResult = await getCurrentSessionOrderCheckoutContainerLifecycle(
    SCOPE,
    createRepository({ lifecycleState: "ACTIVE" }),
  );
  assert.equal(activeResult.containerLifecycleState, "ACTIVE");
  assert.equal(activeResult.canActivateContainer, false);

  const invalidWhenBlocked = await getCurrentSessionOrderCheckoutContainerLifecycle(
    SCOPE,
    createRepository({
      lifecycleState: "ACTIVE",
      foundation: makeFoundation({ containerFoundationStatus: "BLOCKED", canDefineCheckoutContainer: false }),
    }),
  );
  assert.equal(invalidWhenBlocked.containerLifecycleState, "INVALIDATED");
});

test("anchor mismatch => INVALIDATED with safe bounded reason", async () => {
  const result = await getCurrentSessionOrderCheckoutContainerLifecycle(
    SCOPE,
    createRepository({ foundationScope: { ...SCOPE, sessionId: "session-foreign" } }),
  );

  assert.equal(result.containerLifecycleState, "INVALIDATED");
  assert.equal(result.canActivateContainer, false);
  assert.equal(result.invalidationReasons[0]?.code, "CHECKOUT_CONTAINER_LIFECYCLE_ANCHOR_SESSION_MISMATCH");
  assert.equal(result.invalidationReasons[0]?.message.includes("session-foreign"), false);
});

test("lifecycleContext INVALIDATED + FOUNDATIONAL clean scope => INVALIDATED and non-activatable", async () => {
  const result = await getCurrentSessionOrderCheckoutContainerLifecycle(
    SCOPE,
    createRepository({ lifecycleState: "INVALIDATED" }),
  );

  assert.equal(result.containerLifecycleState, "INVALIDATED");
  assert.equal(result.canActivateContainer, false);
});

test("invalidated context includes safe bounded reason", async () => {
  const result = await getCurrentSessionOrderCheckoutContainerLifecycle(
    SCOPE,
    createRepository({ lifecycleState: "INVALIDATED" }),
  );

  assert.equal(result.invalidationReasons[0]?.code, "CHECKOUT_CONTAINER_LIFECYCLE_CONTEXT_INVALIDATED");
  assert.equal(result.invalidationReasons[0]?.message, "Checkout container lifecycle context is invalidated.");
});

test("repeated evaluation is deterministic", async () => {
  const repository = createRepository({ lifecycleState: "ACTIVE" });
  const first = await getCurrentSessionOrderCheckoutContainerLifecycle(SCOPE, repository);
  const second = await getCurrentSessionOrderCheckoutContainerLifecycle(SCOPE, repository);

  assert.deepEqual(first, second);
});

test("mutation leakage is prevented", async () => {
  const repository = createRepository({ foundationScope: { ...SCOPE, orderId: "order-foreign" } });

  const first = await getCurrentSessionOrderCheckoutContainerLifecycle(SCOPE, repository);
  first.invalidationReasons[0]!.message = "mutated";

  const second = await getCurrentSessionOrderCheckoutContainerLifecycle(SCOPE, repository);
  assert.equal(second.invalidationReasons[0]?.message, "Checkout container lifecycle order anchor is out of scope.");
});

test("operational error rethrows", async () => {
  const repository = {
    async getCheckoutContainerLifecycleSnapshot() {
      throw new Error("repository unavailable");
    },
  };

  await assert.rejects(
    () => getCurrentSessionOrderCheckoutContainerLifecycle(SCOPE, repository),
    (error: unknown) => error instanceof Error && error.message === "repository unavailable",
  );
});

test("no direct Slice 6 dependency", async () => {
  const source = await readFile(path.join(process.cwd(), "src/lib/pos/order-checkout-container-lifecycle.ts"), "utf8");

  assert.equal(source.includes("./order-checkout-transition"), false);
  assert.equal(source.includes("./order-checkout-entry"), false);
});

test("no payment, execution, or finalization behavior introduced", async () => {
  const source = await readFile(path.join(process.cwd(), "src/lib/pos/order-checkout-container-lifecycle.ts"), "utf8");

  assert.equal(/payment|finalization|finalize|execute|receipt|inventory/i.test(source), false);
});
