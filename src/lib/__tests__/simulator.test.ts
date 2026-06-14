import { test } from "node:test";
import assert from "node:assert";
import { detectCycle, simulateFailures, ServiceNode } from "../simulator";

// Mock services graph
// D depends on A
// A depends on B
// B depends on C
// C has no dependencies
//
// Graph: D -> A -> B -> C
const mockServices: Record<string, ServiceNode> = {
  A: {
    id: "A",
    name: "Service A",
    tier: "TIER_1",
    status: "HEALTHY",
    dependencies: ["B"],
    dependents: ["D"],
  },
  B: {
    id: "B",
    name: "Service B",
    tier: "TIER_2",
    status: "HEALTHY",
    dependencies: ["C"],
    dependents: ["A"],
  },
  C: {
    id: "C",
    name: "Service C",
    tier: "TIER_3",
    status: "HEALTHY",
    dependencies: [],
    dependents: ["B"],
  },
  D: {
    id: "D",
    name: "Service D",
    tier: "TIER_3",
    status: "HEALTHY",
    dependencies: ["A"],
    dependents: [],
  },
};

test("Cycle Detection: finds simple direct cycle", () => {
  // Try adding A depends on A (self dependency)
  const selfCycle = detectCycle(mockServices, "A", "A");
  assert.deepStrictEqual(selfCycle, ["A"]);
});

test("Cycle Detection: finds transitive cycle", () => {
  // A depends on B depends on C.
  // Adding C depends on A creates a cycle: C -> A -> B -> C
  const cycle = detectCycle(mockServices, "C", "A");
  assert.ok(cycle !== null);
  assert.deepStrictEqual(cycle, ["C", "A", "B", "C"]);
});

test("Cycle Detection: returns null if no cycle created", () => {
  // Adding D depends on C does not create a cycle because C does not depend on D
  const noCycle = detectCycle(mockServices, "D", "C");
  assert.strictEqual(noCycle, null);
});

test("Failure Cascade: propagates failure to dependents", () => {
  // If C fails:
  // - B depends on C, so B is impacted.
  // - A depends on B, so A is impacted.
  // - D depends on A, so D is impacted.
  const result = simulateFailures(mockServices, ["C"]);

  assert.deepStrictEqual(result.failedServiceIds, ["C"]);
  // Impacted should include B, A, D
  assert.strictEqual(result.impactedServiceIds.length, 3);
  assert.ok(result.impactedServiceIds.includes("B"));
  assert.ok(result.impactedServiceIds.includes("A"));
  assert.ok(result.impactedServiceIds.includes("D"));
});

test("Failure Cascade: checks path trace accuracy", () => {
  const result = simulateFailures(mockServices, ["C"]);
  
  // Path for D should be C -> B -> A -> D
  assert.deepStrictEqual(result.paths["D"], ["C", "B", "A", "D"]);
  // Path for B should be C -> B
  assert.deepStrictEqual(result.paths["B"], ["C", "B"]);
});

test("Failure Cascade: fails isolated node without cascade", () => {
  // D has no dependents, so failing D should not impact any other service
  const result = simulateFailures(mockServices, ["D"]);

  assert.deepStrictEqual(result.failedServiceIds, ["D"]);
  assert.strictEqual(result.impactedServiceIds.length, 0);
});

test("Severity & Impact Score calculations", () => {
  // Tiers and weights:
  // A: TIER_1 (weight 3)
  // B: TIER_2 (weight 2)
  // C: TIER_3 (weight 1)
  // D: TIER_3 (weight 1)
  // Total weight: 3 + 2 + 1 + 1 = 7
  //
  // If we fail C, all nodes A, B, C, D are affected.
  // Affected weight = 7. Severity score = 7 / 7 = 100%
  const resultAll = simulateFailures(mockServices, ["C"]);
  assert.strictEqual(resultAll.severityScore, 100);
  assert.strictEqual(resultAll.systemImpactedPercent, 100);

  // If we fail D, only D is affected (weight 1).
  // Severity score = 1 / 7 = 14%
  const resultD = simulateFailures(mockServices, ["D"]);
  assert.strictEqual(resultD.severityScore, 14);
  assert.strictEqual(resultD.systemImpactedPercent, 25); // 1 of 4 nodes
});
