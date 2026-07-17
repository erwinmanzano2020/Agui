import assert from "node:assert/strict";
import test from "node:test";

import {
  PosOrderCheckoutExecutionCoordinatorError,
  createOrderCheckoutExecutionCoordinatorRepository,
  getCurrentSessionOrderCheckoutExecutionCoordinator,
} from "./order-checkout-execution-coordinator";
import type { OrderCheckoutContainerLifecycleResult } from "./order-checkout-container-lifecycle";

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

function makeLifecycle(overrides: Partial<OrderCheckoutContainerLifecycleResult> = {}): OrderCheckoutContainerLifecycleResult {
  return {
    containerLifecycleState: "ACTIVE",
    canActivateContainer: false,
    invalidationReasons: [],
    lifecycleSummary: { ...SCOPE, foundationStatus: "FOUNDATIONAL" },
    ...overrides,
  };
}

function createRepository(input?: { lifecycle?: OrderCheckoutContainerLifecycleResult; lifecycleScope?: Scope }) {
  const lifecycle = input?.lifecycle ?? makeLifecycle();
  const lifecycleScope = input?.lifecycleScope ?? SCOPE;

  return {
    async getCheckoutExecutionCoordinatorSnapshot() {
      return { lifecycle, lifecycleScope: { ...lifecycleScope } };
    },
  };
}

test("missing repository throws a structured Slice 8 coordinator error", async () => {
  await assert.rejects(
    () => getCurrentSessionOrderCheckoutExecutionCoordinator(SCOPE),
    (error: unknown) =>
      error instanceof PosOrderCheckoutExecutionCoordinatorError &&
      error.code === "ORDER_CHECKOUT_EXECUTION_COORDINATOR_REPOSITORY_REQUIRED" &&
      error.status === 500,
  );
});

test("FOUNDATIONAL + ACTIVE produces the sole READY coordinator result", async () => {
  const result = await getCurrentSessionOrderCheckoutExecutionCoordinator(SCOPE, createRepository());

  assert.deepEqual(result, {
    checkoutExecutionStatus: "READY",
    canContinueCheckoutExecution: true,
    executionScopeSummary: { ...SCOPE, foundationStatus: "FOUNDATIONAL", containerLifecycleState: "ACTIVE" },
    blockingIssues: [],
  });
});

test("factory preserves an ACTIVE lifecycle context and produces READY", async () => {
  const lifecycleRepository = {
    async getCheckoutContainerLifecycleSnapshot() {
      return {
        foundation: {
          containerFoundationStatus: "FOUNDATIONAL" as const,
          canDefineCheckoutContainer: true,
          containerAnchorSummary: { ...SCOPE },
          blockingIssues: [],
        },
        foundationScope: { ...SCOPE },
        lifecycleContext: { containerLifecycleState: "ACTIVE" as const },
      };
    },
  };
  const repository = createOrderCheckoutExecutionCoordinatorRepository(lifecycleRepository);

  const result = await getCurrentSessionOrderCheckoutExecutionCoordinator(SCOPE, repository);

  assert.equal(result.checkoutExecutionStatus, "READY");
  assert.equal(result.canContinueCheckoutExecution, true);
});

test("factory preserves an inactive lifecycle context and returns BLOCKED", async () => {
  const lifecycleRepository = {
    async getCheckoutContainerLifecycleSnapshot() {
      return {
        foundation: {
          containerFoundationStatus: "FOUNDATIONAL" as const,
          canDefineCheckoutContainer: true,
          containerAnchorSummary: { ...SCOPE },
          blockingIssues: [],
        },
        foundationScope: { ...SCOPE },
        lifecycleContext: { containerLifecycleState: "ENTERABLE" as const },
      };
    },
  };
  const repository = createOrderCheckoutExecutionCoordinatorRepository(lifecycleRepository);

  const result = await getCurrentSessionOrderCheckoutExecutionCoordinator(SCOPE, repository);

  assert.equal(result.checkoutExecutionStatus, "BLOCKED");
  assert.deepEqual(result.blockingIssues.map((issue) => issue.code), ["CHECKOUT_EXECUTION_LIFECYCLE_NOT_ACTIVE"]);
});

test("non-ACTIVE lifecycle blocks without changing lifecycle semantics", async () => {
  const result = await getCurrentSessionOrderCheckoutExecutionCoordinator(
    SCOPE,
    createRepository({ lifecycle: makeLifecycle({ containerLifecycleState: "ENTERABLE" }) }),
  );

  assert.equal(result.checkoutExecutionStatus, "BLOCKED");
  assert.equal(result.canContinueCheckoutExecution, false);
  assert.deepEqual(result.blockingIssues, [{
    code: "CHECKOUT_EXECUTION_LIFECYCLE_NOT_ACTIVE",
    severity: "BLOCKER",
    message: "Checkout execution is blocked because container lifecycle is not active.",
  }]);
});

test("non-FOUNDATIONAL foundation blocks even if lifecycle is ACTIVE", async () => {
  const result = await getCurrentSessionOrderCheckoutExecutionCoordinator(
    SCOPE,
    createRepository({ lifecycle: makeLifecycle({ lifecycleSummary: { ...SCOPE, foundationStatus: "BLOCKED" } }) }),
  );

  assert.equal(result.checkoutExecutionStatus, "BLOCKED");
  assert.deepEqual(result.blockingIssues.map((issue) => issue.code), ["CHECKOUT_EXECUTION_FOUNDATION_NOT_FOUNDATIONAL"]);
});

test("foreign lifecycle anchor blocks with a safe non-leaking reason", async () => {
  const result = await getCurrentSessionOrderCheckoutExecutionCoordinator(
    SCOPE,
    createRepository({ lifecycleScope: { ...SCOPE, sessionId: "session-foreign" } }),
  );

  assert.equal(result.checkoutExecutionStatus, "BLOCKED");
  assert.equal(result.blockingIssues[0]?.code, "CHECKOUT_EXECUTION_ANCHOR_SESSION_MISMATCH");
  assert.equal(result.blockingIssues[0]?.message.includes("session-foreign"), false);
});

test("repeated coordinator evaluation is deterministic and does not leak mutations", async () => {
  const repository = createRepository();
  const first = await getCurrentSessionOrderCheckoutExecutionCoordinator(SCOPE, repository);
  first.executionScopeSummary.orderId = "mutated";

  const second = await getCurrentSessionOrderCheckoutExecutionCoordinator(SCOPE, repository);
  assert.deepEqual(second.executionScopeSummary, { ...SCOPE, foundationStatus: "FOUNDATIONAL", containerLifecycleState: "ACTIVE" });
});

test("repository operational errors are rethrown", async () => {
  await assert.rejects(
    () => getCurrentSessionOrderCheckoutExecutionCoordinator(SCOPE, {
      async getCheckoutExecutionCoordinatorSnapshot() {
        throw new Error("repository unavailable");
      },
    }),
    (error: unknown) => error instanceof Error && error.message === "repository unavailable",
  );
});
