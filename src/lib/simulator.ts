export interface ServiceNode {
  id: string;
  name: string;
  tier: string;
  status: string;
  dependencies: string[];
  dependents: string[];
}

export function detectCycle(
  services: Record<string, ServiceNode>,
  fromId: string,
  toId: string
): string[] | null {
  if (fromId === toId) {
    return [fromId];
  }

  const visited = new Set<string>();
  const parent: Record<string, string> = {};

  const queue: string[] = [toId];
  visited.add(toId);

  let found = false;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === fromId) {
      found = true;
      break;
    }

    const node = services[curr];
    if (node) {
      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          visited.add(depId);
          parent[depId] = curr;
          queue.push(depId);
        }
      }
    }
  }

  if (!found) {
    return null;
  }

  const path: string[] = [];
  let curr = fromId;
  while (curr !== toId) {
    path.push(curr);
    curr = parent[curr];
  }
  path.push(toId);
  path.reverse();

  return [fromId, ...path];
}

export interface SimulationResult {
  failedServiceIds: string[];
  impactedServiceIds: string[];
  severityScore: number;
  systemImpactedPercent: number;
  paths: Record<string, string[]>;
}

export function simulateFailures(
  services: Record<string, ServiceNode>,
  failedServiceIds: string[]
): SimulationResult {
  const impacted = new Set<string>();
  const paths: Record<string, string[]> = {};
  const queue: string[] = [];

  for (const id of failedServiceIds) {
    if (services[id]) {
      queue.push(id);
      paths[id] = [id];
    }
  }

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const currNode = services[currId];
    if (!currNode) continue;

    const currentPath = paths[currId];

    for (const depId of currNode.dependents) {
      if (!paths[depId]) {
        paths[depId] = [...currentPath, depId];
        impacted.add(depId);
        queue.push(depId);
      }
    }
  }

  const getWeight = (tier: string) => {
    switch (tier.toUpperCase()) {
      case "TIER_1":
      case "1":
        return 3;
      case "TIER_2":
      case "2":
        return 2;
      case "TIER_3":
      case "3":
      default:
        return 1;
    }
  };

  const allServiceIds = Object.keys(services);
  const totalServices = allServiceIds.length;

  if (totalServices === 0) {
    return {
      failedServiceIds,
      impactedServiceIds: [],
      severityScore: 0,
      systemImpactedPercent: 0,
      paths: {},
    };
  }

  let totalWeight = 0;
  for (const id of allServiceIds) {
    totalWeight += getWeight(services[id].tier);
  }

  const allAffectedIds = new Set([...failedServiceIds, ...impacted]);
  let affectedWeight = 0;
  for (const id of allAffectedIds) {
    if (services[id]) {
      affectedWeight += getWeight(services[id].tier);
    }
  }

  const severityScore = Math.round((affectedWeight / totalWeight) * 100);
  const systemImpactedPercent = Math.round((allAffectedIds.size / totalServices) * 100);

  return {
    failedServiceIds,
    impactedServiceIds: Array.from(impacted),
    severityScore,
    systemImpactedPercent,
    paths,
  };
}
