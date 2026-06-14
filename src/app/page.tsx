"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import styles from "./page.module.css";
import { CustomServiceNode, ServiceNodeData } from "@/components/ServiceNode";
import { simulateFailures, detectCycle, ServiceNode } from "@/lib/simulator";
import {
  Plus,
  Network,
  Activity,
  History,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  User,
  Shield,
  Layers,
  ArrowRight,
  Save,
  CheckCircle,
  X,
  Play,
  RotateCcw,
  Sun,
  Moon,
} from "lucide-react";


const nodeTypes = {
  serviceNode: CustomServiceNode,
};

interface DBService {
  id: string;
  name: string;
  description: string;
  owner: string;
  tier: string;
  status: string;
  dependencies: { id: string; name: string }[];
  dependents: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

interface DBSimulation {
  id: string;
  failedServiceIds: string[];
  impactedServiceIds: string[];
  severityScore: number;
  systemImpactedPercent: number;
  notes: string;
  createdAt: string;
}

export default function Dashboard() {
  
  const [services, setServices] = useState<DBService[]>([]);
  const [history, setHistory] = useState<DBSimulation[]>([]);
  const [loading, setLoading] = useState(true);

  
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [isAddDependencyOpen, setIsAddDependencyOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [cycleDetails, setCycleDetails] = useState<string[] | null>(null);

  
  const [newService, setNewService] = useState({
    name: "",
    description: "",
    owner: "",
    tier: "TIER_3",
  });
  const [newDependencyId, setNewDependencyId] = useState("");

  
  const [simulationActive, setSimulationActive] = useState(false);
  const [failedServiceIds, setFailedServiceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  
  const [activeTab, setActiveTab] = useState<"services" | "history">("services");

  
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as "dark" | "light";
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  
  const [defaultViewport, setDefaultViewport] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rf-viewport");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return { x: 0, y: 0, zoom: 1 };
  });

  const hasSavedViewport = useMemo(() => {
    if (typeof window !== "undefined") {
      return !!localStorage.getItem("rf-viewport");
    }
    return false;
  }, []);

  const onMoveEnd = useCallback((event: any, viewportData: any) => {
    if (viewportData) {
      localStorage.setItem("rf-viewport", JSON.stringify(viewportData));
    }
  }, []);

  
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  
  const fetchServices = async () => {
    try {
      const res = await fetch("/api/services");
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch (err) {
      console.error("Error fetching services:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/simulations");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await Promise.all([fetchServices(), fetchHistory()]);
      setLoading(false);
    };
    initData();
  }, []);

  
  const servicesMap = useMemo(() => {
    const map: Record<string, ServiceNode> = {};
    services.forEach((s) => {
      map[s.id] = {
        id: s.id,
        name: s.name,
        tier: s.tier,
        status: s.status,
        dependencies: s.dependencies.map((d) => d.id),
        dependents: s.dependents.map((d) => d.id),
      };
    });
    return map;
  }, [services]);

  
  const simulationResult = useMemo(() => {
    if (!simulationActive || failedServiceIds.length === 0) {
      return {
        failedServiceIds: [],
        impactedServiceIds: [],
        severityScore: 0,
        systemImpactedPercent: 0,
        paths: {},
      };
    }
    return simulateFailures(servicesMap, failedServiceIds);
  }, [simulationActive, failedServiceIds, servicesMap]);

  
  const getServiceStatus = useCallback(
    (id: string, dbStatus: string) => {
      if (simulationActive) {
        if (failedServiceIds.includes(id)) {
          return "FAILED";
        }
        if (simulationResult.impactedServiceIds.includes(id)) {
          return "FAILED"; 
        }
        return "HEALTHY";
      }
      return dbStatus;
    },
    [simulationActive, failedServiceIds, simulationResult]
  );

  
  const generateGraphLayout = useCallback(() => {
    setNodes((prevNodes) => {
      const tierXMap: Record<string, number> = {
        TIER_1: 100,
        TIER_2: 380,
        TIER_3: 660,
      };

      const countMap: Record<string, number> = {
        TIER_1: 0,
        TIER_2: 0,
        TIER_3: 0,
      };

      return services.map((s) => {
        const tier = s.tier;
        const existingNode = prevNodes.find((n) => n.id === s.id);
        const position = existingNode
          ? existingNode.position
          : {
              x: tierXMap[tier] || 380,
              y: countMap[tier] * 130 + 50,
            };

        if (!existingNode) {
          countMap[tier]++;
        }

        const isSelected = selectedServiceId === s.id;
        const computedStatus = getServiceStatus(s.id, s.status);

        return {
          id: s.id,
          type: "serviceNode",
          position,
          data: {
            name: s.name,
            owner: s.owner,
            tier: s.tier,
            status: computedStatus,
            dependencyCount: s.dependencies.length,
            dependentCount: s.dependents.length,
            isSelected,
          },
        };
      });
    });

    const newEdges: Edge[] = [];
    services.forEach((s) => {
      s.dependencies.forEach((dep) => {
        
        let edgeClass = "";
        const sourceFailed = getServiceStatus(dep.id, services.find((x) => x.id === dep.id)?.status || "HEALTHY") === "FAILED";
        const targetFailed = getServiceStatus(s.id, s.status) === "FAILED";
        
        if (simulationActive) {
          if (sourceFailed && targetFailed) {
            edgeClass = "failed";
          } else {
            edgeClass = "active";
          }
        }

        newEdges.push({
          id: `edge-${s.id}-${dep.id}`,
          source: dep.id,
          target: s.id, 
          className: edgeClass,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
            color: edgeClass === "failed" ? "#ef4444" : edgeClass === "active" ? "#3b82f6" : "#6b7280",
          },
        });
      });
    });

    setEdges(newEdges);
  }, [services, selectedServiceId, getServiceStatus, simulationActive, setNodes, setEdges]);

  
  useEffect(() => {
    generateGraphLayout();
  }, [services, selectedServiceId, simulationActive, failedServiceIds, generateGraphLayout]);

  
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTier = tierFilter === "ALL" || s.tier === tierFilter;
      
      const computedStatus = getServiceStatus(s.id, s.status);
      const matchesStatus = statusFilter === "ALL" || computedStatus === statusFilter;

      return matchesSearch && matchesTier && matchesStatus;
    });
  }, [services, searchQuery, tierFilter, statusFilter, getServiceStatus]);

  
  const selectedService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || null;
  }, [services, selectedServiceId]);

  
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newService),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create service");
      }

      await fetchServices();
      setNewService({ name: "", description: "", owner: "", tier: "TIER_3" });
      setIsAddServiceOpen(false);
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setCycleDetails(null);
    if (!selectedServiceId || !newDependencyId) return;

    try {
      const res = await fetch(`/api/services/${selectedServiceId}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependencyId: newDependencyId }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.cycleNames) {
          setCycleDetails(data.cycleNames);
        }
        throw new Error(data.error || "Failed to add dependency");
      }

      await fetchServices();
      setNewDependencyId("");
      setIsAddDependencyOpen(false);
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const onConnect = useCallback(
    async (connection: any) => {
      const { source, target } = connection;
      if (!source || !target) return;

      setErrorBanner(null);
      setCycleDetails(null);

      try {
        const res = await fetch(`/api/services/${target}/dependencies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencyId: source }),
        });

        const data = await res.json();
        if (!res.ok) {
          if (data.cycleNames) {
            setCycleDetails(data.cycleNames);
          }
          throw new Error(data.error || "Failed to add dependency connection");
        }

        await fetchServices();
      } catch (err: any) {
        setErrorBanner(err.message);
      }
    },
    [fetchServices]
  );

  const handleRemoveDependency = async (dependencyId: string) => {
    if (!selectedServiceId) return;
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/services/${selectedServiceId}/dependencies`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependencyId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove dependency");
      }

      await fetchServices();
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const handleDeleteService = async (id: string) => {
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/services/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete service");
      }

      if (selectedServiceId === id) {
        setSelectedServiceId(null);
      }
      await fetchServices();
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update service status");
      }

      await fetchServices();
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  };

  
  const toggleFailedService = (id: string) => {
    setFailedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const startSimulation = () => {
    if (failedServiceIds.length === 0) {
      setErrorBanner("Please select at least one failed service to simulate.");
      return;
    }
    setErrorBanner(null);
    setSimulationActive(true);
  };

  const stopSimulation = () => {
    setSimulationActive(false);
    setFailedServiceIds([]);
    setNotes("");
    setSaveSuccess(false);
  };

  const handleSaveSimulation = async () => {
    if (!simulationActive || failedServiceIds.length === 0) return;
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          failedServiceIds,
          impactedServiceIds: simulationResult.impactedServiceIds,
          severityScore: simulationResult.severityScore,
          systemImpactedPercent: simulationResult.systemImpactedPercent,
          notes,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setNotes("");
        fetchHistory();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save simulation history:", err);
    }
  };

  
  const systemStats = useMemo(() => {
    const total = services.length;
    let healthy = 0;
    let degraded = 0;
    let failed = 0;

    services.forEach((s) => {
      const status = getServiceStatus(s.id, s.status);
      if (status === "FAILED") failed++;
      else if (status === "DEGRADED") degraded++;
      else healthy++;
    });

    
    
    const tier1Count = services.filter((s) => s.tier === "TIER_1").length;
    const circularDeps = false; 

    return { total, healthy, degraded, failed, tier1Count };
  }, [services, getServiceStatus]);

  
  const globalCircularStatus = useMemo(() => {
    
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (id: string): boolean => {
      if (recStack.has(id)) return true;
      if (visited.has(id)) return false;

      visited.add(id);
      recStack.add(id);

      const node = servicesMap[id];
      if (node) {
        for (const depId of node.dependencies) {
          if (dfs(depId)) return true;
        }
      }

      recStack.delete(id);
      return false;
    };

    for (const s of services) {
      if (dfs(s.id)) {
        return true;
      }
    }
    return false;
  }, [services, servicesMap]);

  return (
    <div className={styles.container}>
      {}
      <header className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <Network className={styles.headerIcon} size={28} />
          <div>
            <h1 className={styles.headerTitle}>Dependency Blast Radius Simulator</h1>
            <p className={styles.headerSubtitle}>Model & analyze distributed system failures</p>
          </div>
        </div>

        {}
        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={toggleTheme}
          style={{
            padding: "0.5rem",
            borderRadius: "50%",
            width: "38px",
            height: "38px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: "auto",
            marginRight: "1rem",
            border: "1px solid hsl(var(--border-color))",
            cursor: "pointer",
            background: "none"
          }}
          title={!mounted ? "Loading Theme" : theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          type="button"
        >
          {!mounted ? (
            <div style={{ width: 16, height: 16 }} />
          ) : theme === "dark" ? (
            <Sun size={16} />
          ) : (
            <Moon size={16} />
          )}
        </button>

        {}
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={`${styles.statVal} ${styles.info}`}>{systemStats.total}</span>
            <span className={styles.statLabel}>Total</span>
          </div>
          <div className={styles.statItem}>
            <span className={`${styles.statVal} ${styles.healthy}`}>{systemStats.healthy}</span>
            <span className={styles.statLabel}>Healthy</span>
          </div>
          <div className={styles.statItem}>
            <span className={`${styles.statVal} ${styles.degraded}`}>{systemStats.degraded}</span>
            <span className={styles.statLabel}>Degraded</span>
          </div>
          <div className={styles.statItem}>
            <span className={`${styles.statVal} ${styles.failed}`}>{systemStats.failed}</span>
            <span className={styles.statLabel}>Failed</span>
          </div>
        </div>
      </header>

      {}
      <div className={styles.workspace}>
        {}
        <aside className={styles.sidebar}>
          <div className={styles.tabHeader}>
            <button
              className={`${styles.tabBtn} ${activeTab === "services" ? styles.active : ""}`}
              onClick={() => setActiveTab("services")}
            >
              <Layers size={16} /> Services Registry
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === "history" ? styles.active : ""}`}
              onClick={() => setActiveTab("history")}
            >
              <History size={16} /> Simulations History
            </button>
          </div>

          <div className={styles.tabContent}>
            {}
            {activeTab === "services" && (
              <>
                {}
                <div className={styles.searchBarGroup}>
                  <div style={{ position: "relative" }}>
                    <Search
                      size={16}
                      style={{
                        position: "absolute",
                        left: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "hsl(var(--text-muted))",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Search services, owner..."
                      className={styles.input}
                      style={{ paddingLeft: "32px", width: "100%" }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className={styles.searchFilters}>
                    <select
                      className={styles.select}
                      value={tierFilter}
                      onChange={(e) => setTierFilter(e.target.value)}
                    >
                      <option value="ALL">All Tiers</option>
                      <option value="TIER_1">Tier 1 (Critical)</option>
                      <option value="TIER_2">Tier 2 (Important)</option>
                      <option value="TIER_3">Tier 3 (Standard)</option>
                    </select>

                    <select
                      className={styles.select}
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="HEALTHY">Healthy</option>
                      <option value="DEGRADED">Degraded</option>
                      <option value="FAILED">Failed</option>
                    </select>
                  </div>
                </div>

                {}
                {globalCircularStatus && (
                  <div className={styles.vulnerabilityBadge}>
                    <AlertTriangle size={18} />
                    <span>Circular dependency detected in system registry! Resolve relationships to fix.</span>
                  </div>
                )}

                {}
                <button
                  className={styles.btn}
                  onClick={() => {
                    setErrorBanner(null);
                    setIsAddServiceOpen(true);
                  }}
                >
                  <Plus size={16} /> Register New Service
                </button>

                {}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <h3 className={styles.sectionTitle}>
                    <span>Registered Services ({filteredServices.length})</span>
                  </h3>

                  {loading ? (
                    <div style={{ color: "hsl(var(--text-muted))", textAlign: "center", padding: "2rem" }}>
                      Loading Registry...
                    </div>
                  ) : filteredServices.length === 0 ? (
                    <div style={{ color: "hsl(var(--text-muted))", textAlign: "center", padding: "2rem" }}>
                      No services match filters.
                    </div>
                  ) : (
                    filteredServices.map((s) => (
                      <div
                        key={s.id}
                        className={`${styles.card} ${selectedServiceId === s.id ? styles.selectedCard : ""}`}
                        style={{
                          cursor: "pointer",
                          borderColor: selectedServiceId === s.id ? "hsl(var(--color-primary))" : "",
                        }}
                        onClick={() => setSelectedServiceId(s.id)}
                      >
                        <div className={styles.cardHeader}>
                          <span className={styles.cardTitle}>{s.name}</span>
                          <span
                            className={`${styles.badge} ${
                              s.tier === "TIER_1"
                                ? styles.tier1
                                : s.tier === "TIER_2"
                                ? styles.tier2
                                : styles.tier3
                            }`}
                          >
                            T{s.tier.replace("TIER_", "")}
                          </span>
                        </div>
                        {s.description && <p className={styles.cardDesc}>{s.description}</p>}

                        <div className={styles.metaRow}>
                          <span className={styles.ownerText}>
                            <User size={12} /> {s.owner}
                          </span>
                          <span
                            className={`${styles.badge} ${
                              getServiceStatus(s.id, s.status) === "FAILED"
                                ? styles.failed
                                : getServiceStatus(s.id, s.status) === "DEGRADED"
                                ? styles.degraded
                                : styles.healthy
                            }`}
                          >
                            {getServiceStatus(s.id, s.status)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {}
            {activeTab === "history" && (
              <div className={styles.historyList}>
                <h3 className={styles.sectionTitle}>Simulation Logs</h3>
                {history.length === 0 ? (
                  <div style={{ color: "hsl(var(--text-muted))", textAlign: "center", padding: "2rem" }}>
                    No simulations logged yet.
                  </div>
                ) : (
                  history.map((h) => {
                    const date = new Date(h.createdAt).toLocaleString();
                    return (
                      <div key={h.id} className={styles.historyItem}>
                        <div className={styles.historyHeader}>
                          <span className={styles.historyTime}>{date}</span>
                          <span
                            className={`${styles.badge} ${
                              h.severityScore >= 60
                                ? styles.failed
                                : h.severityScore >= 25
                                ? styles.degraded
                                : styles.healthy
                            }`}
                          >
                            Sev: {h.severityScore}%
                          </span>
                        </div>
                        <div>
                          <strong>Failed:</strong>{" "}
                          {h.failedServiceIds
                            .map((id) => services.find((x) => x.id === id)?.name || id)
                            .join(", ")}
                        </div>
                        <div>
                          <strong>Cascaded Impact:</strong>{" "}
                          {h.impactedServiceIds.length > 0
                            ? h.impactedServiceIds
                                .map((id) => services.find((x) => x.id === id)?.name || id)
                                .join(", ")
                            : "None"}
                        </div>
                        <div>
                          <strong>System Affected:</strong> {h.systemImpactedPercent}%
                        </div>
                        {h.notes && <p className={styles.historyNotes}>"{h.notes}"</p>}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </aside>

        {}
        <main className={styles.canvasContainer}>
          {}
          <div className={styles.canvasToolbar}>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={fetchServices}>
              <RefreshCw size={14} /> Refetch
            </button>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => {
              setSelectedServiceId(node.id);
            }}
            defaultViewport={defaultViewport}
            onMoveEnd={onMoveEnd}
            fitView={!hasSavedViewport}
            style={{ width: "100%", height: "100%" }}
          >
            <Background color="#334155" gap={16} size={1} />
            <Controls />
          </ReactFlow>

          {}
          <div className={styles.canvasLegend}>
            <div className={styles.legendItem}>
              <div className={styles.legendDot} style={{ backgroundColor: "#10b981" }} />
              <span>Healthy</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendDot} style={{ backgroundColor: "#f59e0b" }} />
              <span>Degraded</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendDot} style={{ backgroundColor: "#ef4444" }} />
              <span>Failed</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendDot} style={{ backgroundColor: "#3b82f6" }} />
              <span>Failure Cascade Pathway</span>
            </div>
          </div>
        </main>

        {}
        <section className={styles.rightPanel}>
          {}
          {selectedService ? (
            <div className={styles.card} style={{ borderColor: "hsl(var(--border-color))", cursor: "default" }}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{selectedService.name} Details</h3>
                <button className={styles.closeBtn} onClick={() => setSelectedServiceId(null)}>
                  <X size={14} />
                </button>
              </div>

              <div className={styles.formGroup} style={{ gap: "2px", fontSize: "0.78rem" }}>
                <div>
                  <strong>Owner:</strong> {selectedService.owner}
                </div>
                <div>
                  <strong>Tier:</strong> {selectedService.tier.replace("TIER_", "Tier ")}
                </div>
                <div>
                  <strong>Description:</strong> {selectedService.description || "No description"}
                </div>
              </div>

              <hr style={{ borderColor: "hsl(var(--border-color))", margin: "0.5rem 0" }} />

              {}
              {!simulationActive && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Status Management</label>
                  <select
                    className={styles.select}
                    value={selectedService.status}
                    onChange={(e) => handleUpdateStatus(selectedService.id, e.target.value)}
                  >
                    <option value="HEALTHY">HEALTHY</option>
                    <option value="DEGRADED">DEGRADED</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                </div>
              )}

              {}
              <div className={styles.formGroup} style={{ marginTop: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label className={styles.formLabel}>Dependencies (Depends on)</label>
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.68rem" }}
                    onClick={() => {
                      setErrorBanner(null);
                      setCycleDetails(null);
                      setIsAddDependencyOpen(true);
                    }}
                  >
                    <Plus size={10} /> Add
                  </button>
                </div>

                <div className={styles.serviceRelationsList}>
                  {selectedService.dependencies.length === 0 ? (
                    <span style={{ fontSize: "0.7rem", color: "hsl(var(--text-muted))" }}>No dependencies defined.</span>
                  ) : (
                    selectedService.dependencies.map((dep) => (
                      <div key={dep.id} className={styles.relationItem}>
                        <span>{dep.name}</span>
                        <button
                          style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--color-failed))" }}
                          onClick={() => handleRemoveDependency(dep.id)}
                          title="Remove dependency"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {}
              <div className={styles.formGroup} style={{ marginTop: "0.5rem" }}>
                <label className={styles.formLabel}>Dependents (Who depends on this)</label>
                <div className={styles.serviceRelationsList}>
                  {selectedService.dependents.length === 0 ? (
                    <span style={{ fontSize: "0.7rem", color: "hsl(var(--text-muted))" }}>No services depend on this.</span>
                  ) : (
                    selectedService.dependents.map((dep) => (
                      <div key={dep.id} className={styles.relationItem} style={{ justifyContent: "flex-start" }}>
                        <span>{dep.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ marginTop: "0.5rem" }}>
                <button
                  className={`${styles.btn} ${styles.btnOutlineDanger}`}
                  style={{ width: "100%" }}
                  onClick={() => setServiceToDelete(selectedService.id)}
                >
                  <Trash2 size={14} /> Deregister Service
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: "1rem", border: "1px dashed hsl(var(--border-color))", borderRadius: "8px", textAlign: "center", color: "hsl(var(--text-muted))", fontSize: "0.8rem" }}>
              Select a service from the graph or list to view details, configure dependencies, or update status.
            </div>
          )}

          {}
          <div className={styles.rightSectionTitle}>
            <Activity size={18} />
            <span>Failure Simulator</span>
          </div>

          {}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Select Service(s) to Fail</label>
            <div className={styles.multiselect}>
              {services.map((s) => (
                <label key={s.id} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={failedServiceIds.includes(s.id)}
                    onChange={() => toggleFailedService(s.id)}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          {}
          <div className={styles.btnGroup}>
            {!simulationActive ? (
              <button className={styles.btn} style={{ flex: 1 }} onClick={startSimulation}>
                <Play size={14} /> Simulate Failure
              </button>
            ) : (
              <button
                className={`${styles.btn} ${styles.btnDanger}`}
                style={{ flex: 1 }}
                onClick={stopSimulation}
              >
                <RotateCcw size={14} /> Reset Simulation
              </button>
            )}
          </div>

          {}
          {simulationActive && (
            <>
              <div className={styles.severityWidget}>
                <div
                  className={`${styles.severityScore} ${
                    simulationResult.severityScore >= 60
                      ? styles.failed
                      : simulationResult.severityScore >= 25
                      ? styles.degraded
                      : styles.healthy
                  }`}
                >
                  {simulationResult.severityScore}%
                </div>
                <span className={styles.severityLabel}>Blast Radius Severity</span>
                <div className={styles.severityMeter}>
                  <div
                    className={`${styles.severityBar} ${
                      simulationResult.severityScore >= 60
                        ? styles.failed
                        : simulationResult.severityScore >= 25
                        ? styles.degraded
                        : styles.healthy
                    }`}
                    style={{ width: `${simulationResult.severityScore}%` }}
                  />
                </div>
              </div>

              {}
              <div className={styles.card} style={{ cursor: "default" }}>
                <div className={styles.formGroup} style={{ gap: "6px", fontSize: "0.8rem" }}>
                  <div>
                    <strong>System Affected:</strong> {simulationResult.systemImpactedPercent}% ({simulationResult.failedServiceIds.length + simulationResult.impactedServiceIds.length} of {services.length} services)
                  </div>
                  <div>
                    <strong>Directly Failed:</strong> {simulationResult.failedServiceIds.length}
                  </div>
                  <div>
                    <strong>Indirectly Impacted:</strong> {simulationResult.impactedServiceIds.length}
                  </div>
                </div>
              </div>

              {}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Cascade Impact Paths</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "200px", overflowY: "auto" }}>
                  {simulationResult.impactedServiceIds.length === 0 ? (
                    <span style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))" }}>No downstream cascade failures.</span>
                  ) : (
                    simulationResult.impactedServiceIds.map((id) => {
                      const serviceName = services.find((x) => x.id === id)?.name || id;
                      const path = simulationResult.paths[id] || [];
                      const pathNames = path.map((pid) => services.find((x) => x.id === pid)?.name || pid);

                      return (
                        <div key={id} style={{ padding: "0.5rem", backgroundColor: "hsl(var(--bg-base) / 0.5)", borderRadius: "6px", fontSize: "0.75rem" }}>
                          <div style={{ fontWeight: 600, color: "hsl(var(--color-failed))" }}>
                            {serviceName}
                          </div>
                          <div className={styles.pathNodeList}>
                            {pathNames.map((name, idx) => (
                              <React.Fragment key={idx}>
                                <span className={styles.pathNode}>{name}</span>
                                {idx < pathNames.length - 1 && <ArrowRight size={10} className={styles.pathArrow} />}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Simulation Notes</label>
                <textarea
                  placeholder="e.g. Failure of Database node causes Gateway to degraded state"
                  className={styles.textarea}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button className={styles.btn} onClick={handleSaveSimulation}>
                <Save size={14} /> Log Simulation Run
              </button>

              {saveSuccess && (
                <div className={styles.badge} style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981", textAlign: "center", padding: "0.5rem", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                  Simulation logged successfully!
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {}
      {errorBanner && (
        <div style={{ position: "fixed", top: "1.5rem", left: "50%", transform: "translateX(-50%)", zIndex: 1000, width: "90%", maxWidth: "480px" }}>
          <div className={styles.errorBanner} style={{ margin: 0, padding: "1rem", position: "relative" }}>
            <button style={{ position: "absolute", right: "10px", top: "10px", background: "none", border: "none", cursor: "pointer", color: "inherit" }} onClick={() => setErrorBanner(null)}>
              <X size={14} />
            </button>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Action Error</strong>
                <p style={{ marginTop: "4px" }}>{errorBanner}</p>
                {cycleDetails && (
                  <div style={{ marginTop: "8px", fontSize: "0.7rem", backgroundColor: "rgba(0,0,0,0.2)", padding: "0.5rem", borderRadius: "4px" }}>
                    <strong>Dependency Cycle:</strong>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                       {cycleDetails.map((name, i) => (
                        <React.Fragment key={i}>
                          <span style={{ backgroundColor: "rgba(255,255,255,0.1)", padding: "2px 4px", borderRadius: "2px" }}>{name}</span>
                          {i < cycleDetails.length - 1 && <ArrowRight size={10} style={{ color: "hsl(var(--text-muted))" }} />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      {isAddServiceOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <span>Register New Service</span>
              <button className={styles.closeBtn} onClick={() => setIsAddServiceOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddService} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Service Name (Unique)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. auth-service"
                  className={styles.input}
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Owner Team</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Identity Team"
                  className={styles.input}
                  value={newService.owner}
                  onChange={(e) => setNewService({ ...newService, owner: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Service Criticality Tier</label>
                <select
                  className={styles.select}
                  value={newService.tier}
                  onChange={(e) => setNewService({ ...newService, tier: e.target.value })}
                >
                  <option value="TIER_1">Tier 1 (Critical Gateway / Core Auth)</option>
                  <option value="TIER_2">Tier 2 (Important API Services)</option>
                  <option value="TIER_3">Tier 3 (Standard Databases / Helpers)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description</label>
                <textarea
                  placeholder="Provide a brief summary of the service role"
                  className={styles.textarea}
                  value={newService.description}
                  onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                />
              </div>

              <div className={styles.btnGroup} style={{ marginTop: "0.5rem" }}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} style={{ flex: 1 }} onClick={() => setIsAddServiceOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btn} style={{ flex: 1 }}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {isAddDependencyOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <span>Add Service Dependency</span>
              <button className={styles.closeBtn} onClick={() => setIsAddDependencyOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddDependency} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className={styles.formGroup}>
                <div style={{ fontSize: "0.8rem", color: "hsl(var(--text-secondary))", marginBottom: "0.5rem" }}>
                  Define that <strong>{selectedService?.name}</strong> depends on and requires the selected service to function.
                </div>
                <label className={styles.formLabel}>Depends On Service</label>
                <select
                  required
                  className={styles.select}
                  value={newDependencyId}
                  onChange={(e) => setNewDependencyId(e.target.value)}
                >
                  <option value="">-- Select Provider Service --</option>
                  {services
                    .filter((s) => s.id !== selectedServiceId && !selectedService?.dependencies.some((d) => d.id === s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.tier.replace("TIER_", "Tier ")})
                      </option>
                    ))}
                </select>
              </div>

              <div className={styles.btnGroup} style={{ marginTop: "0.5rem" }}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} style={{ flex: 1 }} onClick={() => setIsAddDependencyOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btn} style={{ flex: 1 }}>
                  Add Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {serviceToDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <span>Confirm Service Deletion</span>
              <button className={styles.closeBtn} onClick={() => setServiceToDelete(null)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ fontSize: "0.85rem", color: "hsl(var(--text-secondary))", lineHeight: "1.4" }}>
              Are you sure you want to deregister <strong>{services.find((s) => s.id === serviceToDelete)?.name}</strong>?
              <p style={{ marginTop: "8px", color: "hsl(var(--color-failed))" }}>
                Warning: This action is permanent and will clean up all associated dependency connections.
              </p>
            </div>
            <div className={styles.btnGroup} style={{ marginTop: "0.5rem" }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                style={{ flex: 1 }}
                onClick={() => setServiceToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                style={{ flex: 1 }}
                onClick={() => {
                  handleDeleteService(serviceToDelete);
                  setServiceToDelete(null);
                }}
              >
                Deregister
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
