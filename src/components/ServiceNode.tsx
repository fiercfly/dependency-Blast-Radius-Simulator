import React from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import styles from "../app/page.module.css";
import { Users } from "lucide-react";

export type ServiceNodeData = {
  name: string;
  owner: string;
  tier: string;
  status: string;
  dependencyCount: number;
  dependentCount: number;
  isSelected?: boolean;
};

export type ServiceNodeProps = NodeProps<Node<ServiceNodeData>>;

export function CustomServiceNode({ data }: ServiceNodeProps) {
  const statusLower = (data.status || "healthy").toLowerCase();

  return (
    <div
      className={`${styles.customNode} ${
        statusLower === "failed"
          ? styles.failed
          : statusLower === "degraded"
          ? styles.degraded
          : styles.healthy
      } ${data.isSelected ? styles.selected : ""}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className={styles.nodeHandle}
      />

      <div className={styles.nodeTitle} title={data.name}>
        {data.name}
      </div>

      <div className={styles.nodeSub}>
        <span className={styles.ownerText}>
          <Users size={10} />
          {data.owner}
        </span>
        <span className={`${styles.badge} ${
          data.tier === "TIER_1" ? styles.tier1 : data.tier === "TIER_2" ? styles.tier2 : styles.tier3
        }`}>
          T{data.tier.replace("TIER_", "")}
        </span>
      </div>

      <div className={styles.nodeSub} style={{ marginTop: "2px", fontSize: "10px" }}>
        <span>Deps: {data.dependencyCount}</span>
        <span>Dep'd by: {data.dependentCount}</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className={styles.nodeHandle}
      />
    </div>
  );
}
