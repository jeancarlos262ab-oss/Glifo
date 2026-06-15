import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
import { graphData, nodeTypeConfig } from '../../data/graphData';
import styles from './GraphCanvas.module.css';

// Reads current theme from the document root
function getThemeColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    bg:         isDark ? '#0C111D' : '#F5F8FF',
    labelColor: isDark ? 'rgba(148,170,212,0.55)' : 'rgba(42,74,122,0.50)',
    labelHover: isDark ? 'rgba(220,230,250,0.90)' : 'rgba(10,21,37,0.90)',
    arrowFill:  isDark ? 'rgba(74,158,224,0.22)' : 'rgba(0,61,124,0.18)',
  };
}

// Link colors aligned to the blue-gold UI palette
const LINK_COLORS = {
  contemporáneo: '#4A9EE0', temático: '#E8A838', visual: '#3EC98E',
  testimonio:    '#5BB8F5', referencia: '#A07BE8', iconografía: '#E8A838',
  simbólico:     '#E85C78', origen:    '#5BB8F5', cultura:    '#3EC98E',
  período:       '#4A9EE0', custodia:  '#38C4B8', gestión:    '#A07BE8',
  inspiración:   '#E8A838', exhibición: '#E85C78', audio:     '#3EC98E',
  estilo:        '#4A9EE0',
};

const GraphCanvas = forwardRef(function GraphCanvas(
  { filterCollection, onNodeClick, activeNode }, ref
) {
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const zoomRef = useRef(null);

  // Expose zoom controls to parent
  useImperativeHandle(ref, () => ({
    zoomIn:  () => { if (svgRef.current && zoomRef.current) d3.select(svgRef.current).transition().duration(260).call(zoomRef.current.scaleBy, 1.4); },
    zoomOut: () => { if (svgRef.current && zoomRef.current) d3.select(svgRef.current).transition().duration(260).call(zoomRef.current.scaleBy, 1 / 1.4); },
    reset:   () => { if (svgRef.current && zoomRef.current) d3.select(svgRef.current).transition().duration(320).call(zoomRef.current.transform, d3.zoomIdentity); },
  }));

  const draw = useCallback(() => {
    const container = svgRef.current?.parentElement;
    if (!container) return;

    const W = container.clientWidth;
    const H = container.clientHeight || 520;
    const tc = getThemeColors();

    const filteredNodes = filterCollection === 'Todos'
      ? graphData.nodes
      : graphData.nodes.filter(n => n.collection === filterCollection);
    const filteredIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = graphData.links.filter(
      l => filteredIds.has(l.source?.id ?? l.source) && filteredIds.has(l.target?.id ?? l.target)
    );

    const nodes = filteredNodes.map(d => ({ ...d }));
    const links = filteredLinks.map(d => ({ ...d }));

    d3.select(svgRef.current).selectAll('*').remove();
    if (simulationRef.current) simulationRef.current.stop();

    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H);

    svg.append('rect').attr('width', W).attr('height', H).attr('fill', tc.bg);

    // Defs
    const defs = svg.append('defs');

    const glow = defs.append('filter').attr('id', 'glow')
      .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    glow.append('feGaussianBlur').attr('stdDeviation', '3.5').attr('result', 'blur');
    const mg = glow.append('feMerge');
    mg.append('feMergeNode').attr('in', 'blur');
    mg.append('feMergeNode').attr('in', 'SourceGraphic');

    defs.append('marker').attr('id', 'arrow')
      .attr('viewBox', '0 -4 8 8').attr('refX', 20).attr('refY', 0)
      .attr('markerWidth', 4).attr('markerHeight', 4).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', tc.arrowFill);

    const g = svg.append('g');

    const zoom = d3.zoom().scaleExtent([0.2, 4])
      .on('zoom', e => g.attr('transform', e.transform));
    zoomRef.current = zoom;
    svg.call(zoom);

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(95).strength(0.38))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(28));
    simulationRef.current = simulation;

    // Links
    const link = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', d => LINK_COLORS[d.type] || '#8888aa')
      .attr('stroke-opacity', 0.30)
      .attr('stroke-width', d => d.weight * 0.85)
      .attr('stroke-dasharray', d => d.weight === 1 ? '3,5' : 'none')
      .attr('marker-end', 'url(#arrow)');

    // Nodes
    const node = g.append('g').selectAll('g').data(nodes).join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',   (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on('click', (e, d) => { e.stopPropagation(); onNodeClick(d); });

    // Hover
    node.on('mouseenter', function(e, d) {
        d3.select(this).select('.node-ring').attr('r', 18).attr('stroke-opacity', 0.9);
        d3.select(this).select('.node-label').attr('fill', tc.labelHover);
      })
      .on('mouseleave', function(e, d) {
        const isActive = activeNode?.id === d.id;
        d3.select(this).select('.node-ring').attr('r', isActive ? 18 : 13).attr('stroke-opacity', isActive ? 1 : 0.55);
        d3.select(this).select('.node-label').attr('fill', tc.labelColor);
      });

    // Ring
    node.append('circle').attr('class', 'node-ring')
      .attr('r', d => activeNode?.id === d.id ? 18 : 13)
      .attr('fill', d => (nodeTypeConfig[d.type]?.color || '#888') + '18')
      .attr('stroke', d => nodeTypeConfig[d.type]?.color || '#888')
      .attr('stroke-width', 1.4)
      .attr('stroke-opacity', d => activeNode?.id === d.id ? 1 : 0.55)
      .attr('filter', d => activeNode?.id === d.id ? 'url(#glow)' : 'none');

    // Core
    node.append('circle').attr('class', 'node-core')
      .attr('r', 4.5)
      .attr('fill', d => nodeTypeConfig[d.type]?.color || '#888')
      .attr('opacity', 0.92);

    // Label
    node.append('text').attr('class', 'node-label')
      .attr('y', 27).attr('text-anchor', 'middle')
      .attr('font-size', '9px').attr('font-family', 'var(--font-mono)')
      .attr('fill', tc.labelColor)
      .attr('pointer-events', 'none').attr('letter-spacing', '0.02em')
      .text(d => d.label.length > 18 ? d.label.slice(0, 17) + '…' : d.label);

    svg.on('click', () => onNodeClick(null));

    simulation.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [filterCollection, activeNode, onNodeClick]);

  useEffect(() => { const t = setTimeout(draw, 60); return () => clearTimeout(t); }, [draw]);
  useEffect(() => {
    const obs = new ResizeObserver(() => draw());
    if (svgRef.current?.parentElement) obs.observe(svgRef.current.parentElement);
    return () => obs.disconnect();
  }, [draw]);

  // Redraw when the theme changes (data-theme attribute on <html>)
  useEffect(() => {
    const mut = new MutationObserver(() => draw());
    mut.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mut.disconnect();
  }, [draw]);

  return <svg ref={svgRef} className={styles.svg} />;
});

export default GraphCanvas;
