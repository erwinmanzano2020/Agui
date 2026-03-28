import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as featureGuard from "@/lib/auth/feature-guard";
import * as identityServer from "@/lib/identity/entity-server";
import * as payrollRunsServer from "@/lib/hr/payroll-runs-server";
import * as payslipServer from "@/lib/hr/payslip-server";
import * as supabaseServer from "@/lib/supabase/server";
import * as supabaseService from "@/lib/supabase-service";
import {
  assertCanonicalSafeHrRouteEntryOrder,
  assertUnauthenticatedSafeHrRouteDrift,
} from "@/app/api/hr/_shared/__tests__/safe-route-drift";
import {
  PAYROLL_ROUTE_AUTH_REQUIRED_MESSAGE,
  PAYROLL_ROUTE_FORBIDDEN_MESSAGE,
  PAYROLL_ROUTE_NOT_FOUND_MESSAGE,
  PAYROLL_ROUTE_UNEXPECTED_MESSAGE,
  PAYROLL_ROUTE_VALIDATION_MESSAGE,
} from "../route-boundary";
import { GET as listPayrollRuns, POST as createPayrollRun } from "../route";
import { GET as getPayrollRunById } from "../[id]/route";
import { POST as finalizePayrollRun } from "../[id]/finalize/route";
import { POST as markPayrollRunPaid } from "../[id]/mark-paid/route";
import { POST as createAdjustmentRun } from "../[id]/adjustments/route";
import { POST as createRunDeduction } from "../[id]/deductions/route";
import { POST as postPayrollRun } from "../[id]/post/route";

const HOUSE_ID = "33333333-3333-4333-8333-333333333333";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const EMPLOYEE_ID = "11111111-1111-4111-8111-111111111111";

async function assertCanonicalRouteError(response: Response, status: number, error: string) {
  assert.equal(response.status, status);
  const payload = await response.json();
  assert.equal(payload.error, error);
}

function mockSupabase(user: { id: string } | null = { id: "user-1" }) {
  mock.method(supabaseServer, "createServerSupabaseClient", async () =>
    ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) as never,
  );
}

function setupAuthOk() {
  mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
  mockSupabase();
  mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
  mock.method(identityServer, "resolveEntityIdForUser", async () => "entity-1");
}

function setupSafeRouteEntryOrderProbe(order: string[]) {
  mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => {
    order.push("feature");
    return null;
  });
  mock.method(supabaseServer, "createServerSupabaseClient", async () =>
    ({
      auth: {
        getUser: async () => {
          order.push("auth");
          return { data: { user: { id: "user-1" } }, error: null };
        },
      },
    }) as never,
  );
  mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
  mock.method(identityServer, "resolveEntityIdForUser", async () => {
    order.push("entity");
    return "entity-1";
  });
}

function setupUnauthenticatedFeatureProbe() {
  const probe = { featureCalls: 0 };
  mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => {
    probe.featureCalls += 1;
    return null;
  });
  mockSupabase(null);
  return probe;
}

afterEach(() => mock.restoreAll());

describe("POST /api/hr/payroll-runs", () => {
  it("returns auth-required boundary", async () => {
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
    mockSupabase(null);
    const response = await createPayrollRun(new Request("http://localhost/api/hr/payroll-runs", { method: "POST", body: "{}" }) as never);
    await assertCanonicalRouteError(response, 401, PAYROLL_ROUTE_AUTH_REQUIRED_MESSAGE);
  });

  it("returns validation boundary", async () => {
    setupAuthOk();
    const response = await createPayrollRun(
      new Request("http://localhost/api/hr/payroll-runs", { method: "POST", body: JSON.stringify({ houseId: "bad" }) }) as never,
    );
    await assertCanonicalRouteError(response, 400, PAYROLL_ROUTE_VALIDATION_MESSAGE);
  });

  it("returns forbidden boundary", async () => {
    setupAuthOk();
    mock.method(payrollRunsServer, "createDraftPayrollRunFromPreview", async () => {
      throw new payrollRunsServer.PayrollRunAccessError("denied");
    });
    const response = await createPayrollRun(
      new Request("http://localhost/api/hr/payroll-runs", {
        method: "POST",
        body: JSON.stringify({ houseId: HOUSE_ID, periodStart: "2026-01-01", periodEnd: "2026-01-15" }),
      }) as never,
    );
    await assertCanonicalRouteError(response, 403, PAYROLL_ROUTE_FORBIDDEN_MESSAGE);
  });

  it("returns unexpected-failure boundary", async () => {
    setupAuthOk();
    mock.method(payrollRunsServer, "createDraftPayrollRunFromPreview", async () => {
      throw new payrollRunsServer.PayrollRunMutationError("db down");
    });
    const response = await createPayrollRun(
      new Request("http://localhost/api/hr/payroll-runs", {
        method: "POST",
        body: JSON.stringify({ houseId: HOUSE_ID, periodStart: "2026-01-01", periodEnd: "2026-01-15" }),
      }) as never,
    );
    await assertCanonicalRouteError(response, 500, PAYROLL_ROUTE_UNEXPECTED_MESSAGE);
  });

  it("maps domain validation failures to canonical validation boundary", async () => {
    setupAuthOk();
    mock.method(payrollRunsServer, "createDraftPayrollRunFromPreview", async () => {
      throw new payrollRunsServer.PayrollRunValidationError("periodStart must be on or before periodEnd.");
    });

    const response = await createPayrollRun(
      new Request("http://localhost/api/hr/payroll-runs", {
        method: "POST",
        body: JSON.stringify({ houseId: HOUSE_ID, periodStart: "2026-01-15", periodEnd: "2026-01-01" }),
      }) as never,
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.error, PAYROLL_ROUTE_VALIDATION_MESSAGE);
    assert.match(String(payload.details?.message ?? ""), /periodStart must be on or before periodEnd/i);
  });

  it("returns success boundary", async () => {
    setupAuthOk();
    mock.method(payrollRunsServer, "createDraftPayrollRunFromPreview", async () => ({ runId: RUN_ID }));
    const response = await createPayrollRun(
      new Request("http://localhost/api/hr/payroll-runs", {
        method: "POST",
        body: JSON.stringify({ houseId: HOUSE_ID, periodStart: "2026-01-01", periodEnd: "2026-01-15" }),
      }) as never,
    );
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.message, "Payroll run created.");
    assert.equal(payload.runId, RUN_ID);
  });

  it("resolves identity before mutation", async () => {
    setupAuthOk();
    const calls: string[] = [];
    mock.method(identityServer, "resolveEntityIdForUser", async () => {
      calls.push("resolve");
      return "entity-1";
    });
    mock.method(payrollRunsServer, "createDraftPayrollRunFromPreview", async () => {
      calls.push("mutate");
      return { runId: RUN_ID };
    });

    await createPayrollRun(
      new Request("http://localhost/api/hr/payroll-runs", {
        method: "POST",
        body: JSON.stringify({ houseId: HOUSE_ID, periodStart: "2026-01-01", periodEnd: "2026-01-15" }),
      }) as never,
    );

    assert.deepEqual(calls, ["resolve", "mutate"]);
  });

  it("applies canonical auth -> entity -> feature ordering", async () => {
    const order: string[] = [];
    setupSafeRouteEntryOrderProbe(order);

    const response = await createPayrollRun(
      new Request("http://localhost/api/hr/payroll-runs", {
        method: "POST",
        body: JSON.stringify({ houseId: "bad" }),
      }) as never,
    );

    assert.equal(response.status, 400);
    assertCanonicalSafeHrRouteEntryOrder(order);
  });
});

describe("payroll run id-based write routes", () => {
  const routeCases = [
    {
      name: "finalize",
      call: (request: Request) => finalizePayrollRun(request as never, { params: Promise.resolve({ id: RUN_ID }) }),
      mutate: "finalizePayrollRunForHouse" as const,
      successMessage: "Payroll run finalized.",
    },
    {
      name: "mark-paid",
      call: (request: Request) => markPayrollRunPaid(request as never, { params: Promise.resolve({ id: RUN_ID }) }),
      mutate: "markPayrollRunPaidForHouse" as const,
      successMessage: "Payroll run marked as paid.",
    },
    {
      name: "adjustments",
      call: (request: Request) => createAdjustmentRun(request as never, { params: Promise.resolve({ id: RUN_ID }) }),
      mutate: "createAdjustmentRunForHouse" as const,
      successMessage: "Adjustment payroll run created.",
    },
  ];

  for (const routeCase of routeCases) {
    describe(`POST /api/hr/payroll-runs/:id/${routeCase.name}`, () => {
      it("returns validation boundary", async () => {
        setupAuthOk();
        const response = await routeCase.call(new Request(`http://localhost/${routeCase.name}?houseId=bad`, { method: "POST", body: "{}" }));
        await assertCanonicalRouteError(response, 400, PAYROLL_ROUTE_VALIDATION_MESSAGE);
      });

      it("returns auth-required boundary", async () => {
        mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
        mockSupabase(null);
        const response = await routeCase.call(new Request(`http://localhost/${routeCase.name}?houseId=${HOUSE_ID}`, { method: "POST", body: "{}" }));
        await assertCanonicalRouteError(response, 401, PAYROLL_ROUTE_AUTH_REQUIRED_MESSAGE);
      });

      it("applies canonical auth -> entity -> feature ordering", async () => {
        const order: string[] = [];
        setupSafeRouteEntryOrderProbe(order);

        const response = await routeCase.call(
          new Request(`http://localhost/${routeCase.name}?houseId=bad`, { method: "POST", body: "{}" }),
        );

        assert.equal(response.status, 400);
        assertCanonicalSafeHrRouteEntryOrder(order);
      });

      it("returns unauthenticated response without invoking feature guard", async () => {
        const probe = setupUnauthenticatedFeatureProbe();

        const response = await routeCase.call(
          new Request(`http://localhost/${routeCase.name}?houseId=${HOUSE_ID}`, { method: "POST", body: "{}" }),
        );

        await assertUnauthenticatedSafeHrRouteDrift({
          response,
          expectedStatus: 401,
          expectedError: PAYROLL_ROUTE_AUTH_REQUIRED_MESSAGE,
          featureGuardCalls: probe.featureCalls,
        });
      });

      it("returns forbidden boundary", async () => {
        setupAuthOk();
        mock.method(payrollRunsServer, "resolvePayrollRunWriteTargetForHouseWithAccess", async () => {
          throw new payrollRunsServer.PayrollRunAccessError("denied");
        });
        const response = await routeCase.call(new Request(`http://localhost/${routeCase.name}?houseId=${HOUSE_ID}`, { method: "POST", body: "{}" }));
        await assertCanonicalRouteError(response, 403, PAYROLL_ROUTE_FORBIDDEN_MESSAGE);
      });

      it("returns not-found boundary", async () => {
        setupAuthOk();
        let mutateCalls = 0;
        mock.method(payrollRunsServer, "resolvePayrollRunWriteTargetForHouseWithAccess", async () => null);
        mock.method(payrollRunsServer, routeCase.mutate, async () => {
          mutateCalls += 1;
          return routeCase.mutate === "createAdjustmentRunForHouse" ? { runId: RUN_ID } : ({ run: {} } as never);
        });
        const response = await routeCase.call(new Request(`http://localhost/${routeCase.name}?houseId=${HOUSE_ID}`, { method: "POST", body: "{}" }));
        await assertCanonicalRouteError(response, 404, PAYROLL_ROUTE_NOT_FOUND_MESSAGE);
        assert.equal(mutateCalls, 0);
      });

      it("returns unexpected boundary", async () => {
        setupAuthOk();
        mock.method(payrollRunsServer, "resolvePayrollRunWriteTargetForHouseWithAccess", async () => ({
          id: RUN_ID,
          houseId: HOUSE_ID,
          status: "posted",
          periodStart: "2026-01-01",
          periodEnd: "2026-01-15",
        }));
        mock.method(payrollRunsServer, routeCase.mutate, async () => {
          throw new payrollRunsServer.PayrollRunMutationError("db fail");
        });
        const response = await routeCase.call(new Request(`http://localhost/${routeCase.name}?houseId=${HOUSE_ID}`, { method: "POST", body: "{}" }));
        await assertCanonicalRouteError(response, 500, PAYROLL_ROUTE_UNEXPECTED_MESSAGE);
      });

      it("returns success boundary", async () => {
        setupAuthOk();
        const order: string[] = [];
        mock.method(payrollRunsServer, "resolvePayrollRunWriteTargetForHouseWithAccess", async () => {
          order.push("resolve");
          return {
            id: RUN_ID,
            houseId: HOUSE_ID,
            status: "posted",
            periodStart: "2026-01-01",
            periodEnd: "2026-01-15",
          };
        });
        mock.method(payrollRunsServer, routeCase.mutate, async () => {
          order.push("mutate");
          return routeCase.mutate === "createAdjustmentRunForHouse" ? { runId: RUN_ID } : ({ run: {} } as never);
        });

        const response = await routeCase.call(new Request(`http://localhost/${routeCase.name}?houseId=${HOUSE_ID}`, { method: "POST", body: "{}" }));
        assert.equal(response.status, 200);
        assert.equal((await response.json()).message, routeCase.successMessage);
        assert.deepEqual(order, ["resolve", "mutate"]);
      });

      it("passes resolved target into mutation options", async () => {
        setupAuthOk();
        const resolvedTarget = {
          id: RUN_ID,
          houseId: HOUSE_ID,
          status: "posted" as const,
          periodStart: "2026-01-01",
          periodEnd: "2026-01-15",
        };
        mock.method(payrollRunsServer, "resolvePayrollRunWriteTargetForHouseWithAccess", async () => resolvedTarget);

        let capturedOptions: unknown;
        mock.method(payrollRunsServer, routeCase.mutate, async (...args: unknown[]) => {
          capturedOptions = args[args.length - 1];
          return routeCase.mutate === "createAdjustmentRunForHouse" ? { runId: RUN_ID } : ({ run: {} } as never);
        });

        const response = await routeCase.call(
          new Request(`http://localhost/${routeCase.name}?houseId=${HOUSE_ID}`, { method: "POST", body: "{}" }),
        );

        assert.equal(response.status, 200);
        assert.deepEqual(capturedOptions, { resolvedTarget });
      });
    });
  }
});

describe("POST /api/hr/payroll-runs/:id/deductions", () => {
  const callRoute = (request: Request) => createRunDeduction(request as never, { params: Promise.resolve({ id: RUN_ID }) });

  it("returns validation boundary", async () => {
    setupAuthOk();
    const response = await callRoute(new Request("http://localhost/deductions", { method: "POST", body: JSON.stringify({}) }));
    await assertCanonicalRouteError(response, 400, PAYROLL_ROUTE_VALIDATION_MESSAGE);
  });

  it("returns auth-required boundary", async () => {
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
    mockSupabase(null);
    const response = await callRoute(new Request("http://localhost/deductions", { method: "POST", body: JSON.stringify({}) }));
    await assertCanonicalRouteError(response, 401, PAYROLL_ROUTE_AUTH_REQUIRED_MESSAGE);
  });

  it("applies canonical auth -> entity -> feature ordering", async () => {
    const order: string[] = [];
    setupSafeRouteEntryOrderProbe(order);

    const response = await callRoute(
      new Request("http://localhost/deductions", {
        method: "POST",
        body: JSON.stringify({ houseId: "bad" }),
      }),
    );

    assert.equal(response.status, 400);
    assertCanonicalSafeHrRouteEntryOrder(order);
  });

  it("returns unauthenticated response without invoking feature guard", async () => {
    const probe = setupUnauthenticatedFeatureProbe();

    const response = await callRoute(new Request("http://localhost/deductions", { method: "POST", body: JSON.stringify({}) }));

    await assertUnauthenticatedSafeHrRouteDrift({
      response,
      expectedStatus: 401,
      expectedError: PAYROLL_ROUTE_AUTH_REQUIRED_MESSAGE,
      featureGuardCalls: probe.featureCalls,
    });
  });

  it("returns forbidden boundary", async () => {
    setupAuthOk();
    let mutateCalls = 0;
    mock.method(payslipServer, "resolvePayrollRunDeductionWriteContext", async () => {
      throw new payslipServer.PayslipAccessError("denied");
    });
    mock.method(payslipServer, "createPayrollRunDeduction", async () => {
      mutateCalls += 1;
      return { id: "deduction-1" };
    });
    const response = await callRoute(
      new Request("http://localhost/deductions", {
        method: "POST",
        body: JSON.stringify({ employeeId: EMPLOYEE_ID, label: "Cash advance", amount: 100 }),
      }),
    );
    await assertCanonicalRouteError(response, 403, PAYROLL_ROUTE_FORBIDDEN_MESSAGE);
    assert.equal(mutateCalls, 0);
  });

  it("returns not-found boundary", async () => {
    setupAuthOk();
    let mutateCalls = 0;
    mock.method(payslipServer, "resolvePayrollRunDeductionWriteContext", async () => null);
    mock.method(payslipServer, "createPayrollRunDeduction", async () => {
      mutateCalls += 1;
      return { id: "deduction-1" };
    });
    const response = await callRoute(
      new Request("http://localhost/deductions", {
        method: "POST",
        body: JSON.stringify({ employeeId: EMPLOYEE_ID, label: "Cash advance", amount: 100 }),
      }),
    );
    await assertCanonicalRouteError(response, 404, PAYROLL_ROUTE_NOT_FOUND_MESSAGE);
    assert.equal(mutateCalls, 0);
  });

  it("returns conflict boundary when payroll run is locked after posting", async () => {
    setupAuthOk();
    mock.method(payslipServer, "resolvePayrollRunDeductionWriteContext", async () => ({ runId: RUN_ID, houseId: HOUSE_ID }));
    mock.method(payslipServer, "createPayrollRunDeduction", async () => {
      throw new payslipServer.PayrollRunDeductionLockedError("Payroll run is posted");
    });

    const response = await callRoute(
      new Request("http://localhost/deductions", {
        method: "POST",
        body: JSON.stringify({ employeeId: EMPLOYEE_ID, label: "Cash advance", amount: 100 }),
      }),
    );

    assert.equal(response.status, 409);
    const payload = await response.json();
    assert.equal(payload.error, "Payroll run is locked");
  });

  it("returns unexpected boundary", async () => {
    setupAuthOk();
    mock.method(payslipServer, "resolvePayrollRunDeductionWriteContext", async () => ({ runId: RUN_ID, houseId: HOUSE_ID }));
    mock.method(payslipServer, "createPayrollRunDeduction", async () => {
      throw new payslipServer.PayrollRunDeductionMutationError("db down");
    });

    const response = await callRoute(
      new Request("http://localhost/deductions", {
        method: "POST",
        body: JSON.stringify({ employeeId: EMPLOYEE_ID, label: "Cash advance", amount: 100 }),
      }),
    );
    await assertCanonicalRouteError(response, 500, PAYROLL_ROUTE_UNEXPECTED_MESSAGE);
  });

  it("returns success boundary and resolver-before-mutation ordering", async () => {
    setupAuthOk();
    const order: string[] = [];
    mock.method(payslipServer, "resolvePayrollRunDeductionWriteContext", async () => {
      order.push("resolve");
      return { runId: RUN_ID, houseId: HOUSE_ID };
    });
    mock.method(payslipServer, "createPayrollRunDeduction", async () => {
      order.push("mutate");
      return { id: "deduction-1" };
    });

    const response = await callRoute(
      new Request("http://localhost/deductions", {
        method: "POST",
        body: JSON.stringify({ employeeId: EMPLOYEE_ID, label: "Cash advance", amount: 100 }),
      }),
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, "Deduction added.");
    assert.deepEqual(order, ["resolve", "mutate"]);
  });
});

describe("payroll route boundary drift guard", () => {
  it("keeps GET /api/hr/payroll-runs aligned with canonical route boundaries", async () => {
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);
    mockSupabase(null);
    const unauthenticated = await listPayrollRuns(new Request(`http://localhost/api/hr/payroll-runs?houseId=${HOUSE_ID}`) as never);
    await assertCanonicalRouteError(unauthenticated, 401, PAYROLL_ROUTE_AUTH_REQUIRED_MESSAGE);

    setupAuthOk();
    const invalidHouse = await listPayrollRuns(new Request("http://localhost/api/hr/payroll-runs?houseId=bad") as never);
    await assertCanonicalRouteError(invalidHouse, 400, PAYROLL_ROUTE_VALIDATION_MESSAGE);
  });
});

describe("GET /api/hr/payroll-runs/:id guard ordering", () => {
  it("applies canonical auth -> entity -> feature ordering", async () => {
    const order: string[] = [];
    setupSafeRouteEntryOrderProbe(order);

    const response = await getPayrollRunById(
      new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}?houseId=bad`) as never,
      { params: Promise.resolve({ id: RUN_ID }) },
    );

    assert.equal(response.status, 400);
    assertCanonicalSafeHrRouteEntryOrder(order);
  });

  it("returns unauthenticated response without invoking feature guard", async () => {
    const probe = setupUnauthenticatedFeatureProbe();

    const response = await getPayrollRunById(
      new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}?houseId=${HOUSE_ID}`) as never,
      { params: Promise.resolve({ id: RUN_ID }) },
    );

    await assertUnauthenticatedSafeHrRouteDrift({
      response,
      expectedStatus: 401,
      expectedError: "Not authenticated",
      featureGuardCalls: probe.featureCalls,
    });
  });
});

describe("POST /api/hr/payroll-runs/:id/post guard ordering", () => {
  it("applies canonical auth -> entity -> feature ordering", async () => {
    const order: string[] = [];
    setupSafeRouteEntryOrderProbe(order);

    const response = await postPayrollRun(
      new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}/post?houseId=bad`, { method: "POST", body: "{}" }) as never,
      { params: Promise.resolve({ id: RUN_ID }) },
    );

    assert.equal(response.status, 400);
    assertCanonicalSafeHrRouteEntryOrder(order);
  });

  it("returns unauthenticated response without invoking feature guard", async () => {
    const probe = setupUnauthenticatedFeatureProbe();

    const response = await postPayrollRun(
      new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}/post?houseId=${HOUSE_ID}`, { method: "POST", body: "{}" }) as never,
      { params: Promise.resolve({ id: RUN_ID }) },
    );

    await assertUnauthenticatedSafeHrRouteDrift({
      response,
      expectedStatus: 401,
      expectedError: "Not authenticated",
      featureGuardCalls: probe.featureCalls,
    });
  });

  it("returns validation error when houseId is omitted (deny-by-default)", async () => {
    setupAuthOk();
    let mutateCalls = 0;
    mock.method(payrollRunsServer, "postPayrollRunForHouse", async () => {
      mutateCalls += 1;
      return {} as never;
    });

    const response = await postPayrollRun(
      new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}/post`, { method: "POST", body: "{}" }) as never,
      { params: Promise.resolve({ id: RUN_ID }) },
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.error, "Fix the highlighted fields and try again.");
    assert.equal(mutateCalls, 0);
  });

  it("returns forbidden boundary for cross-house or out-of-scope post mutations", async () => {
    setupAuthOk();
    mock.method(payrollRunsServer, "postPayrollRunForHouse", async () => {
      throw new payrollRunsServer.PayrollRunAccessError("Not allowed to mutate payroll runs for this house.");
    });

    const response = await postPayrollRun(
      new Request(`http://localhost/api/hr/payroll-runs/${RUN_ID}/post?houseId=${HOUSE_ID}`, { method: "POST", body: "{}" }) as never,
      { params: Promise.resolve({ id: RUN_ID }) },
    );

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.error, "Not allowed");
    assert.equal(payload.details?.runId, undefined);
    assert.equal(payload.details?.houseId, undefined);
  });
});
