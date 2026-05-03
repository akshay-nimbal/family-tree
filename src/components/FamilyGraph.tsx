"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as d3 from "d3";
import { api } from "../api/client";
import type { GraphData, GraphNode, GraphEdge } from "../types";
import "./FamilyGraph.css";

// Empty string => same-origin (talk to the Next.js /uploads route).
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

interface SimNode extends d3.SimulationNodeDatum, GraphNode {
  generation: number;
  targetY: number;
}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  type: string;
}

const FAMILY_COLORS = [
  "#e6a817", "#4fc3f7", "#ef5350", "#66bb6a", "#ab47bc",
  "#ff7043", "#26c6da", "#ec407a", "#8d6e63", "#78909c",
  "#d4e157", "#5c6bc0",
];

const REL_COLORS: Record<string, string> = {
  FATHER_OF: "#64b5f6",
  MOTHER_OF: "#f06292",
  SPOUSE_OF: "#ffc107",
  SIBLING_OF: "#81c784",
};

const REL_LABELS: Record<string, string> = {
  FATHER_OF: "Father → child",
  MOTHER_OF: "Mother → child",
  SPOUSE_OF: "Spouses",
  SIBLING_OF: "Siblings",
};

const GENERATION_GAP = 170;
const NODE_R = 16;
const PAD_TOP = 80;

/**
 * Assign each person a generation index (0 = oldest ancestors).
 *   - BFS through FATHER_OF / MOTHER_OF edges from root ancestors (no parents).
 *   - Spouses are pulled to the same generation (taking the max of both).
 * Iterates until stable so intermarriages converge.
 */
function computeGenerations(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<string, number> {
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const spousesOf = new Map<string, string[]>();

  for (const e of edges) {
    if (e.type === "FATHER_OF" || e.type === "MOTHER_OF") {
      if (!childrenOf.has(e.source)) childrenOf.set(e.source, []);
      childrenOf.get(e.source)!.push(e.target);
      if (!parentsOf.has(e.target)) parentsOf.set(e.target, []);
      parentsOf.get(e.target)!.push(e.source);
    } else if (e.type === "SPOUSE_OF") {
      if (!spousesOf.has(e.source)) spousesOf.set(e.source, []);
      spousesOf.get(e.source)!.push(e.target);
      if (!spousesOf.has(e.target)) spousesOf.set(e.target, []);
      spousesOf.get(e.target)!.push(e.source);
    }
  }

  const gen = new Map<string, number>();
  for (const n of nodes) {
    if (!parentsOf.has(n.id)) gen.set(n.id, 0);
  }

  let changed = true;
  let iter = 0;
  while (changed && iter < 30) {
    changed = false;
    iter++;
    for (const n of nodes) {
      const parents = parentsOf.get(n.id);
      if (parents && parents.length > 0) {
        let parentGen = 0;
        for (const p of parents) {
          const g = gen.get(p);
          if (g !== undefined && g > parentGen) parentGen = g;
        }
        const newGen = parentGen + 1;
        const current = gen.get(n.id);
        if (current === undefined || current < newGen) {
          gen.set(n.id, newGen);
          changed = true;
        }
      }
    }
    for (const n of nodes) {
      const spouses = spousesOf.get(n.id);
      if (!spouses || spouses.length === 0) continue;
      let maxGen = gen.get(n.id) ?? 0;
      for (const s of spouses) {
        const g = gen.get(s);
        if (g !== undefined && g > maxGen) maxGen = g;
      }
      if ((gen.get(n.id) ?? 0) < maxGen) {
        gen.set(n.id, maxGen);
        changed = true;
      }
    }
  }

  for (const n of nodes) {
    if (!gen.has(n.id)) gen.set(n.id, 0);
  }
  return gen;
}

interface FamilyGraphProps {
  refreshKey: number;
  onViewPerson?: (personId: string, familyName: string) => void;
}

export function FamilyGraph({ refreshKey, onViewPerson }: FamilyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const fitRef = useRef<() => void>(() => {});
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [familyColorMap, setFamilyColorMap] = useState<Record<string, string>>({});
  const [highlightFamily, setHighlightFamily] = useState<string | null>(null);
  const [showSiblings, setShowSiblings] = useState(false);
  const [showAllLabels, setShowAllLabels] = useState(false);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getGraph();
      setGraphData(data);
      const colorMap: Record<string, string> = {};
      data.families.forEach((f, i) => {
        colorMap[f] = FAMILY_COLORS[i % FAMILY_COLORS.length];
      });
      setFamilyColorMap(colorMap);
    } catch {
      setGraphData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph, refreshKey]);

  const generations = useMemo(() => {
    if (!graphData) return new Map<string, number>();
    return computeGenerations(graphData.nodes, graphData.edges);
  }, [graphData]);

  const maxGen = useMemo(() => {
    let m = 0;
    generations.forEach((g) => {
      if (g > m) m = g;
    });
    return m;
  }, [generations]);

  useEffect(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return;
    if (graphData.nodes.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 700;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const defs = svg.append("defs");

    const glow = defs.append("filter").attr("id", "node-glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    glow.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "b");
    const gm = glow.append("feMerge");
    gm.append("feMergeNode").attr("in", "b");
    gm.append("feMergeNode").attr("in", "SourceGraphic");

    const selGlow = defs.append("filter").attr("id", "selected-glow").attr("x", "-80%").attr("y", "-80%").attr("width", "260%").attr("height", "260%");
    selGlow.append("feGaussianBlur").attr("stdDeviation", "5").attr("result", "b");
    const sgm = selGlow.append("feMerge");
    sgm.append("feMergeNode").attr("in", "b");
    sgm.append("feMergeNode").attr("in", "SourceGraphic");

    const g = svg.append("g");

    // Faint generation row guides so the structure is legible even before interaction
    const guideGroup = g.append("g").attr("class", "gen-guides");
    for (let i = 0; i <= maxGen; i++) {
      const y = PAD_TOP + i * GENERATION_GAP;
      guideGroup
        .append("line")
        .attr("x1", -10000)
        .attr("x2", 10000)
        .attr("y1", y)
        .attr("y2", y)
        .attr("stroke", "rgba(255,255,255,0.04)")
        .attr("stroke-width", 1);
      guideGroup
        .append("text")
        .attr("x", -10000 + 40)
        .attr("y", y - 6)
        .attr("fill", "rgba(255,255,255,0.25)")
        .attr("font-size", "11px")
        .attr("font-family", "ui-monospace, monospace")
        .text(`Generation ${i + 1}`);
    }

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });
    zoomRef.current = zoom;
    svg.call(zoom);

    const nodes: SimNode[] = graphData.nodes.map((n) => {
      const gen = generations.get(n.id) ?? 0;
      return {
        ...n,
        generation: gen,
        targetY: PAD_TOP + gen * GENERATION_GAP,
        x: width / 2 + (Math.random() - 0.5) * 200,
        y: PAD_TOP + gen * GENERATION_GAP,
      };
    });
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Rendered links: parent-child (curved) and spouse (short horizontal). Siblings are implicit.
    const parentLinks: SimLink[] = graphData.edges
      .filter((e) => (e.type === "FATHER_OF" || e.type === "MOTHER_OF") && nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, type: e.type }));

    const spouseLinks: SimLink[] = graphData.edges
      .filter((e) => e.type === "SPOUSE_OF" && nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, type: e.type }));

    const siblingLinks: SimLink[] = graphData.edges
      .filter((e) => e.type === "SIBLING_OF" && nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, type: e.type }));

    // For the force-layout, we use parent + spouse links. Siblings are visual-only (when toggled on).
    const simLinks: SimLink[] = [...parentLinks, ...spouseLinks];

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((d) => (d.type === "SPOUSE_OF" ? 55 : 110))
          .strength((d) => (d.type === "SPOUSE_OF" ? 1.0 : 0.35))
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-260).distanceMax(550))
      .force("collision", d3.forceCollide<SimNode>().radius(NODE_R + 10).strength(0.9))
      .force("x", d3.forceX<SimNode>(width / 2).strength(0.03))
      .force(
        "y",
        d3.forceY<SimNode>((d) => d.targetY).strength(1.4)
      );

    // Render parent-child links as curved paths (source at top, target below)
    const parentLinkGroup = g.append("g").attr("class", "parent-links");
    const parentLinkEls = parentLinkGroup
      .selectAll<SVGPathElement, SimLink>("path")
      .data(parentLinks)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", (d) => REL_COLORS[d.type])
      .attr("stroke-width", 1.4)
      .attr("stroke-opacity", 0.5)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");

    // Render spouse links as a bold horizontal bar
    const spouseLinkGroup = g.append("g").attr("class", "spouse-links");
    const spouseLinkEls = spouseLinkGroup
      .selectAll<SVGLineElement, SimLink>("line")
      .data(spouseLinks)
      .join("line")
      .attr("stroke", REL_COLORS.SPOUSE_OF)
      .attr("stroke-width", 3)
      .attr("stroke-opacity", 0.75)
      .attr("stroke-linecap", "round");

    // Render sibling links as dashed (hidden unless toggled on)
    const siblingLinkGroup = g.append("g").attr("class", "sibling-links");
    const siblingLinkEls = siblingLinkGroup
      .selectAll<SVGPathElement, SimLink>("path")
      .data(siblingLinks)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", REL_COLORS.SIBLING_OF)
      .attr("stroke-width", 1.2)
      .attr("stroke-opacity", 0)
      .attr("stroke-dasharray", "4,4");

    const nodeGroup = g.append("g").attr("class", "nodes");
    const nodeEls = nodeGroup
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer");

    nodeEls.each(function (d) {
      if (d.photoUrl) {
        const clipId = `clip-${d.id}`;
        defs
          .append("clipPath")
          .attr("id", clipId)
          .append("circle")
          .attr("r", NODE_R)
          .attr("cx", 0)
          .attr("cy", 0);
      }
    });

    // Ring (family color) + core (dark fill) + initials / photo
    nodeEls
      .append("circle")
      .attr("class", "node-ring")
      .attr("r", NODE_R + 2)
      .attr("fill", "none")
      .attr("stroke", (d) => familyColorMap[d.familyName] || "#888")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.55);

    nodeEls
      .append("circle")
      .attr("class", "node-core")
      .attr("r", NODE_R)
      .attr("fill", "#141428")
      .attr("stroke", (d) => familyColorMap[d.familyName] || "#888")
      .attr("stroke-width", 2);

    nodeEls.each(function (d) {
      const el = d3.select(this);
      if (d.photoUrl) {
        el.append("image")
          .attr("class", "node-photo")
          .attr("href", `${API_BASE}${d.photoUrl}`)
          .attr("x", -NODE_R)
          .attr("y", -NODE_R)
          .attr("width", NODE_R * 2)
          .attr("height", NODE_R * 2)
          .attr("clip-path", `url(#clip-${d.id})`)
          .attr("preserveAspectRatio", "xMidYMid slice")
          .attr("pointer-events", "none");
      } else {
        const parts = d.fullName.split(/\s+/);
        const init = parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : d.fullName.slice(0, 2).toUpperCase();
        el.append("text")
          .attr("class", "node-initials")
          .text(init)
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .attr("font-size", "10px")
          .attr("font-weight", "700")
          .attr("fill", (dd) => familyColorMap[(dd as SimNode).familyName] || "#888")
          .attr("pointer-events", "none");
      }
    });

    // Gender marker: a small bar of blue/pink at the bottom of the ring (subtle)
    nodeEls.each(function (d) {
      const color = d.gender === "female" ? "#f06292" : d.gender === "male" ? "#64b5f6" : "#9e9e9e";
      d3.select(this)
        .append("circle")
        .attr("class", "node-gender-dot")
        .attr("cx", NODE_R * 0.72)
        .attr("cy", -NODE_R * 0.72)
        .attr("r", 3)
        .attr("fill", color)
        .attr("opacity", 0.85);
    });

    // Name labels: hidden by default, toggled via showAllLabels / on hover / select
    nodeEls
      .append("text")
      .attr("class", "node-name")
      .text((d) => d.fullName)
      .attr("text-anchor", "middle")
      .attr("dy", NODE_R + 14)
      .attr("font-size", "10px")
      .attr("font-weight", "500")
      .attr("fill", "#d0d0e0")
      .attr("pointer-events", "none")
      .attr("opacity", 0);

    // --- interactivity ---
    const neighborsOf = new Map<string, Set<string>>();
    const allEdges = [...parentLinks, ...spouseLinks, ...siblingLinks];
    for (const l of allEdges) {
      const s = typeof l.source === "object" ? (l.source as SimNode).id : (l.source as string);
      const t = typeof l.target === "object" ? (l.target as SimNode).id : (l.target as string);
      if (!neighborsOf.has(s)) neighborsOf.set(s, new Set());
      if (!neighborsOf.has(t)) neighborsOf.set(t, new Set());
      neighborsOf.get(s)!.add(t);
      neighborsOf.get(t)!.add(s);
    }

    let currentSelectedId: string | null = null;
    let currentHoverId: string | null = null;

    function relatedToFocused(nodeId: string, focusedId: string | null): boolean {
      if (!focusedId) return true;
      if (focusedId === nodeId) return true;
      return neighborsOf.get(focusedId)?.has(nodeId) ?? false;
    }

    function linkTouchesFocused(l: SimLink, focusedId: string | null): boolean {
      if (!focusedId) return false;
      const s = typeof l.source === "object" ? (l.source as SimNode).id : (l.source as string);
      const t = typeof l.target === "object" ? (l.target as SimNode).id : (l.target as string);
      return s === focusedId || t === focusedId;
    }

    function redraw() {
      const focused = currentSelectedId ?? currentHoverId;

      nodeEls
        .transition()
        .duration(150)
        .attr("opacity", (d) => (relatedToFocused(d.id, focused) ? 1 : 0.18));

      parentLinkEls
        .transition()
        .duration(150)
        .attr("stroke-opacity", (l) =>
          focused ? (linkTouchesFocused(l, focused) ? 0.95 : 0.08) : 0.45
        )
        .attr("stroke-width", (l) => (focused && linkTouchesFocused(l, focused) ? 2.6 : 1.4));

      spouseLinkEls
        .transition()
        .duration(150)
        .attr("stroke-opacity", (l) =>
          focused ? (linkTouchesFocused(l, focused) ? 1 : 0.1) : 0.75
        )
        .attr("stroke-width", (l) => (focused && linkTouchesFocused(l, focused) ? 4.2 : 3));

      siblingLinkEls
        .transition()
        .duration(150)
        .attr("stroke-opacity", (l) => {
          if (focused && linkTouchesFocused(l, focused)) return 0.85;
          return showSiblings ? 0.35 : 0;
        });

      nodeEls.each(function (d) {
        const el = d3.select<SVGGElement, SimNode>(this);
        const isFocused = d.id === focused;
        const r = isFocused ? NODE_R + 4 : NODE_R;
        el.select(".node-core")
          .transition()
          .duration(150)
          .attr("r", r)
          .attr("stroke-width", isFocused ? 3 : 2)
          .attr("filter", isFocused ? "url(#selected-glow)" : null);
        el.select(".node-ring").transition().duration(150).attr("r", r + 2).attr("stroke-opacity", isFocused ? 1 : 0.55);
        el.select(".node-photo")
          .transition()
          .duration(150)
          .attr("x", -r)
          .attr("y", -r)
          .attr("width", r * 2)
          .attr("height", r * 2);
        if (d.photoUrl) {
          const clipSel = defs.select(`#clip-${d.id} circle`);
          if (!clipSel.empty()) clipSel.transition().duration(150).attr("r", r);
        }
        const shouldShowLabel = showAllLabels || isFocused || (focused != null && relatedToFocused(d.id, focused));
        el.select(".node-name")
          .transition()
          .duration(150)
          .attr("opacity", shouldShowLabel ? 1 : 0)
          .attr("font-size", isFocused ? "12px" : "10px")
          .attr("fill", isFocused ? "#fff" : "#d0d0e0");
      });
    }

    nodeEls
      .on("mouseover", function (_event, d) {
        if (currentSelectedId) return;
        currentHoverId = d.id;
        redraw();
      })
      .on("mouseout", function (_event, d) {
        if (currentSelectedId) return;
        if (currentHoverId === d.id) currentHoverId = null;
        redraw();
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        currentSelectedId = currentSelectedId === d.id ? null : d.id;
        currentHoverId = null;
        setSelectedNode(currentSelectedId ? d : null);
        redraw();
      });

    svg.on("click", () => {
      if (currentSelectedId) {
        currentSelectedId = null;
        setSelectedNode(null);
        redraw();
      }
    });

    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    nodeEls.call(drag);

    // Orthogonal (right-angle) parent-child connector with softly rounded corners.
    // Drops straight down from the parent, runs horizontally at a shared midline,
    // then drops into the child. This reads as a clean family-tree branch instead
    // of a tangled curve even when the child is pulled sideways by the simulation.
    function orthogonalPath(sx: number, sy: number, tx: number, ty: number): string {
      const s0y = sy + NODE_R * 0.45;
      const t0y = ty - NODE_R * 0.45;
      if (Math.abs(sx - tx) < 1) {
        return `M${sx},${s0y} L${tx},${t0y}`;
      }
      const midY = s0y + (t0y - s0y) * 0.55;
      const dir = tx > sx ? 1 : -1;
      const rMax = 14;
      const r = Math.max(
        2,
        Math.min(rMax, Math.abs(tx - sx) / 2, midY - s0y, t0y - midY)
      );
      return (
        `M${sx},${s0y}` +
        `L${sx},${midY - r}` +
        `Q${sx},${midY} ${sx + dir * r},${midY}` +
        `L${tx - dir * r},${midY}` +
        `Q${tx},${midY} ${tx},${midY + r}` +
        `L${tx},${t0y}`
      );
    }

    simulation.on("tick", () => {
      parentLinkEls.attr("d", (l) => {
        const s = l.source as SimNode;
        const t = l.target as SimNode;
        return orthogonalPath(s.x ?? 0, s.y ?? 0, t.x ?? 0, t.y ?? 0);
      });
      spouseLinkEls
        .attr("x1", (l) => {
          const s = l.source as SimNode;
          const t = l.target as SimNode;
          const sx = s.x ?? 0, tx = t.x ?? 0;
          return sx < tx ? sx + NODE_R * 0.8 : sx - NODE_R * 0.8;
        })
        .attr("y1", (l) => (l.source as SimNode).y ?? 0)
        .attr("x2", (l) => {
          const s = l.source as SimNode;
          const t = l.target as SimNode;
          const sx = s.x ?? 0, tx = t.x ?? 0;
          return sx < tx ? tx - NODE_R * 0.8 : tx + NODE_R * 0.8;
        })
        .attr("y2", (l) => (l.target as SimNode).y ?? 0);
      siblingLinkEls.attr("d", (l) => {
        const s = l.source as SimNode;
        const t = l.target as SimNode;
        const sx = s.x ?? 0, sy = s.y ?? 0;
        const tx = t.x ?? 0, ty = t.y ?? 0;
        const midX = (sx + tx) / 2;
        const midY = Math.min(sy, ty) - 22;
        return `M${sx},${sy - NODE_R * 0.4} Q${midX},${midY} ${tx},${ty - NODE_R * 0.4}`;
      });
      nodeEls.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Warm simulation so we can compute an initial auto-fit
    for (let i = 0; i < 220; i++) simulation.tick();

    function fitToView() {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodes.forEach((n) => {
        const x = n.x ?? 0;
        const y = n.y ?? 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      });
      const PAD = 80;
      const bboxW = Math.max(1, maxX - minX + PAD * 2);
      const bboxH = Math.max(1, maxY - minY + PAD * 2);
      const scale = Math.min(width / bboxW, height / bboxH, 1.2);
      const tx = width / 2 - (minX + (maxX - minX) / 2) * scale;
      const ty = height / 2 - (minY + (maxY - minY) / 2) * scale;
      svg
        .transition()
        .duration(600)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }
    fitRef.current = fitToView;
    fitToView();

    return () => {
      simulation.stop();
    };
  }, [graphData, familyColorMap, generations, maxGen, showSiblings, showAllLabels]);

  // Family highlight dimming
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg
      .selectAll<SVGGElement, SimNode>(".node")
      .transition()
      .duration(250)
      .attr("opacity", (d) =>
        highlightFamily === null || d.familyName === highlightFamily ? 1 : 0.1
      );
  }, [highlightFamily, graphData]);

  if (loading) {
    return (
      <div className="graph-container">
        <div className="graph-loading">Loading family graph…</div>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="graph-container">
        <div className="graph-empty">
          No family data yet. Add some members to see the graph.
        </div>
      </div>
    );
  }

  return (
    <div className="graph-page">
      <div className="graph-container" ref={containerRef}>
        <svg ref={svgRef} />

        <div className="graph-legend">
          <div className="legend-title">Families</div>
          {graphData.families.map((family) => (
            <button
              key={family}
              className={`legend-item ${highlightFamily === family ? "active" : ""}`}
              onClick={() =>
                setHighlightFamily((prev) => (prev === family ? null : family))
              }
            >
              <span
                className="legend-dot"
                style={{ background: familyColorMap[family] }}
              />
              {family}
            </button>
          ))}

          <div className="legend-divider" />
          <div className="legend-title">Relationships</div>
          {Object.entries(REL_LABELS).map(([type, label]) => (
            <div key={type} className="legend-rel">
              <span
                className="legend-line"
                style={
                  type === "SIBLING_OF"
                    ? {
                        background: `repeating-linear-gradient(90deg, ${REL_COLORS[type]} 0px, ${REL_COLORS[type]} 4px, transparent 4px, transparent 8px)`,
                      }
                    : { background: REL_COLORS[type] }
                }
              />
              {label}
            </div>
          ))}

          <div className="legend-divider" />
          <label className="legend-toggle">
            <input
              type="checkbox"
              checked={showSiblings}
              onChange={(e) => setShowSiblings(e.target.checked)}
            />
            <span>Show sibling links</span>
          </label>
          <label className="legend-toggle">
            <input
              type="checkbox"
              checked={showAllLabels}
              onChange={(e) => setShowAllLabels(e.target.checked)}
            />
            <span>Show all names</span>
          </label>

          <div className="legend-divider" />
          <button className="legend-btn" onClick={() => fitRef.current()}>
            Fit to view
          </button>
          <div className="legend-hint">
            Scroll to zoom · Drag nodes · Click for details · Hover to focus
          </div>
        </div>

        {selectedNode && (
          <div className="graph-detail-panel">
            <button
              className="graph-detail-close"
              onClick={() => setSelectedNode(null)}
            >
              &times;
            </button>
            <div
              className="graph-detail-accent"
              style={{ background: familyColorMap[selectedNode.familyName] }}
            />
            {selectedNode.photoUrl ? (
              <div className="graph-detail-photo">
                <img
                  src={`${API_BASE}${selectedNode.photoUrl}`}
                  alt={selectedNode.fullName}
                />
              </div>
            ) : (
              <div
                className="graph-detail-avatar"
                style={{ borderColor: familyColorMap[selectedNode.familyName] }}
              >
                {selectedNode.fullName
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <h3>{selectedNode.fullName}</h3>
            <div className="graph-detail-family">
              <span
                className="legend-dot"
                style={{ background: familyColorMap[selectedNode.familyName] }}
              />
              {selectedNode.familyName} Family
              <span className="graph-detail-generation">
                · Gen {(generations.get(selectedNode.id) ?? 0) + 1}
              </span>
            </div>
            <div className="graph-detail-rows">
              {selectedNode.gender && (
                <GraphDetailRow label="Gender" value={selectedNode.gender} />
              )}
              {selectedNode.dateOfBirth && (
                <GraphDetailRow label="Born" value={selectedNode.dateOfBirth} />
              )}
              {selectedNode.dateOfDeath && (
                <GraphDetailRow label="Died" value={selectedNode.dateOfDeath} />
              )}
              {selectedNode.city && (
                <GraphDetailRow label="City" value={selectedNode.city} />
              )}
              {selectedNode.occupation && (
                <GraphDetailRow label="Occupation" value={selectedNode.occupation} />
              )}
              <GraphDetailRow
                label="Status"
                value={
                  selectedNode.status === "pending"
                    ? "Pending (not yet claimed)"
                    : "Verified"
                }
              />
            </div>
            {onViewPerson && (
              <button
                className="graph-detail-view-btn"
                onClick={() => onViewPerson(selectedNode.id, selectedNode.familyName)}
              >
                View Full Profile →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GraphDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="graph-detail-row">
      <span className="graph-detail-label">{label}</span>
      <span className="graph-detail-value">{value}</span>
    </div>
  );
}
