import * as d3 from "d3";
import { D3BrushEvent } from "d3";

interface Node extends d3.SimulationNodeDatum {
  id: number;
  label: string;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  value: number;
  d: number;
  s: number;
}

export default class Graph {
  [x: string]: any;
  // TODO: Find type for SVG
  svg: any;
  container: string;
  width: number;
  height: number;
  linkSvg: any;
  links: Link[];
  nodes: Node[];
  nodesInHull: Node[];
  simulation: any;
  // nodeSvg: any;
  lastId: number;

  constructor(container: string) {
    this.container = container;
    this.width = document.getElementById(this.container).offsetWidth;
    this.height = document.getElementById(this.container).offsetHeight;
  }

  setContainer(container: string) {
    this.container = container;
  }

  createSvg() {
    this.svg = d3
      .select(`#${this.container}`)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height);
  }

  createLinkSvg() {
    this.linkSvg = this.svg
      .selectAll('line')
      .data(this.links)
      .enter()
      .append('line')
      .on('contextmenu', (event, edge) => {
        event.preventDefault();
        this.colorEdge(edge);
      })
      .style('stroke', 'black')
      .style('stroke-width', '10px')
      .attr('id', (link) => `link-${link.source.id}-${link.target.id}`)
      .attr('class', 'graphLink')
  }

  linkDis() {
    return d3
      .forceLink(this.links)
      .id((d) => d.id)
      .distance(() => 50)
      .strength(0.9);
  }

  moveLinks() {
    this.svg
      .selectAll('line')
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);
  }

  moveLabel() {
    this.svg
      .selectAll('text')
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y);
  }

  moveCircle() {
    this.svg
      .selectAll('circle')
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y);
  }

  handleOnTick() {
    this.moveCircle();
    this.moveLabel();
    this.moveLinks();
    if (this.nodesInHull) this.highlightSeparatingNodes();
  }

  createSimulation() {
    this.simulation = d3
      .forceSimulation()
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('x', d3.forceX(this.width / 2).strength(0.1))
      .force('y', d3.forceY(this.height / 2).strength(0.1))
      .nodes(this.nodes)
      .force('charge', d3.forceManyBody().strength(-900))
      .force('link', this.linkDis())
      .on('tick', () => this.handleOnTick());
  }

  createNodeSvg() {
    this.nodeSvg = this.svg
      .selectAll('circle')
      .data(this.nodes)
      .enter()
      .append('circle')
      .style('fill', '#ea2c62')
      .attr('r', 25)
      .call(d3.drag()
        .on('start', (event, v) => {
          if (!event.active) this.simulation.alphaTarget(0.3).restart();
          [v.fx, v.fy] = [v.x, v.y];
        })
        .on('drag', (event, v) => {
          [v.fx, v.fy] = [event.x, event.y];

        })
        .on('end', (event, v) => {
          if (!event.active) this.simulation.alphaTarget(0);
          [v.fx, v.fy] = [null, null];
        })
      )
  }

  createLabels() {
    this.svg
      .selectAll('text')
      .data(this.nodes)
      .enter()
      .append('text')
      .text((node: Node) => (node.label ? node.label : node.id))
      .attr('dy', 4.5)
      .attr("text-anchor", "middle")
      .attr('class', 'graph_label')
  }

  removeSvg(): void {
    this.svg.remove();
  }

  changeVerticesColor(subsetOfVertices: string[], color: string, animationTime: number) {
    this.nodeSvg
      .filter(node => subsetOfVertices.includes(node.label))
      .transition()
      .style('fill', color)
      .duration(animationTime);
  }

  changeEdgesColor(subsetOfEdges: string[][], color: string, animationTime: number) {
    this.linkSvg
      .filter((link: Link) => {
        for (const l of subsetOfEdges) {
          const sourceNode: Node = link.source;
          const targetNode: Node = link.target;
          if (l.includes(sourceNode.label) && l.includes(targetNode.label)) return true;
        }
      })
      .transition()
      .style('stroke', color)
      .duration(animationTime);
  }

  getSelectionOfVertices(vertices: string[]) {
    return this.nodeSvg.filter((node: Node) => vertices.includes(node.label))
  }

  changeSizeOfVertices(vertices: string[], radius: number) {
    const verticesSelection = this.getSelectionOfVertices(vertices);
    verticesSelection.attr('r', radius)
  }

  getEdges(subsetOfEdges: string[][]) {
    return this.linkSvg
      .filter((link: Link) => {
        for (const l of subsetOfEdges) {
          const sourceNode: Node = link.source;
          const targetNode: Node = link.target;
          if (l.includes(sourceNode.label) && l.includes(targetNode.label)) return true;
        }
      })
  }

  changeSizeOfEdge(edges: string[][], strokeWidth: number, animationTime: number) {
    const linkToChange = this.getEdges(edges);
    linkToChange.style('stroke-width', strokeWidth);
  }

  private getVertexToChange(vertex: string) {
    return this.nodeSvg.filter(node => node.label == vertex);
  }

  changeAllVerticesColor(color: string, animationTime: number) {
    this.nodeSvg.transition().style('fill', color).duration(animationTime);
  }

  changeAllEdgesColor(color: string, animationTime: number) {
    this.linkSvg.transition().style('stroke', color).duration(animationTime);
  }

  restart() {
    this.updateLinkSvg();
    this.enterUpdateRemoveLabels();
    this.updateNodeSvg();
    this.restartSimulation();
  }

  private enterUpdateRemoveLabels() {
    this.svg
      .selectAll('text')
      .data(this.nodes, (d) => d.id)
      .join(
        (enter) => enter
          .append('text')
          .attr('dy', 4.5)
          .text((d) => d.id)
          .attr('class', 'graph-label'),
        (update) => update,
        (exit) => exit.remove(),
      );
  }

  private updateLinkSvg() {
    this.linkSvg
      .selectAll('line')
      .data(this.links)
      .join(
        enter => enter
          .append('line')
          .lower()
          .style('stroke', 'black'),
        update => update,
        exit => exit.style('stroke', 'green')
      );
  }

  private updateNodeSvg() {
    this.nodeSvg
      .data(this.nodes, node => node.id)
      .join(
        enter => enter
          .append('circle')
          .style('fill', 'red')
          .attr('r', 20),
        update => update,
        exit => exit.remove()
      );
  }

  restartSimulation() {
    this.simulation.force('link').links(this.links);
    this.simulation.nodes(this.nodes);
    this.simulation.alpha(0.5).restart();
  }

  removeVertex(vertexToRemove: string) {
    const nodes: Node[] = this.nodes.filter(node => node.label !== vertexToRemove);
    const linksToRemove: Link[] = this.links.filter((link: Link) => link.source.label === vertexToRemove || link.target.label === vertexToRemove);
    linksToRemove.map((link: Link) => this.links.splice(this.links.indexOf(link), 1));
    this.nodes = nodes;
    this.restart();
  }

  addVertex(vertexToAdd: string) {
    const node: Node = { id: ++this.lastId, label: vertexToAdd }
    this.nodes.push(node);
    this.restart();
  }

  addEdge(firstVertex: string, secondVertex: string) {
    const first: Node = this.nodes.find(node => node.label == firstVertex);
    const second: Node = this.nodes.find(node => node.label == secondVertex);
    const newLink: Link = { source: first, target: second };
    this.links.push(newLink);
    this.restart();
  }

  addHull(vertices: string[]) {
    this.nodesInHull = this.nodes.filter(node => vertices.includes(node.label));
  }

  removeEdge(firstVertex: string, secondVertex: string) {
    const edgeToRemove: Link = this.links.find(link => {
      const src: Node = link.source;
      const target: Node = link.target;
      return (src.label === firstVertex && target.label === secondVertex) || (src.label === secondVertex && target.label === firstVertex)
    });
    const one = this.links[0];
    const ind = this.links.indexOf(edgeToRemove);
    this.links.splice(ind, 1)
    this.restart();
  }

  changeVertexColor(vertex: string, color: string): void {
    this.nodeSvg.filter(node => node.label == vertex).style('fill', color);
  }

  changeLabel(vertex: string, label: string) {
    const node: Node = this.nodes.find(node => node.label == vertex);
    node.label = label;
    this.updateLabels();
  }

  private updateLabels() {
    this.svg.selectAll('text')
      .data(this.nodes, node => node.id)
      .join(
        enter => enter,
        update => update.text(node => node.label),
        exit => exit.remove()
      );
  }

  generateRandomGraph(vertices: number, edges: number) {
    const randomGraph = generateRandomGraph(vertices, edges);
    this.load(randomGraph);
  }

  addHullPath() {
    this.path = this.svg
      .append('path')
      .attr('fill', 'orange')
      .attr('stroke', 'orange')
      .attr('stroke-width', 16)
      .attr('opacity', 1);
  }

  highlightSeparatingNodes() {
    const line = d3.line().curve(d3.curveBasisClosed);
    let pointArr = [];
    const pad = 30;

    for (const node of this.nodesInHull) {
      pointArr = pointArr.concat([
        [node.x - pad, node.y - pad],
        [node.x - pad, node.y + pad],
        [node.x + pad, node.y - pad],
        [node.x + pad, node.y + pad],
      ]);
    }

    this.path.attr('d', line(hull(pointArr)));
  }

  load(graph: { nodes: Node; links: Link; }) {
    if (this.svg) this.removeSvg();
    this.createSvg();
    this.addHullPath();
    this.nodes = graph.nodes;
    this.links = graph.links;
    this.lastId = graph.nodes.length;
    this.createLinkSvg();
    this.createSimulation();
    this.createNodeSvg();
    this.createLabels();
    this.simulation.force('link').links(this.links);
  }

  private findAllIncomingEdgesOfVertex(vertex: Node) {
    return this.links.filter((link: Link) => link.source === vertex || link.target === vertex)
  }

  colorEdge(link: Link) {
    const sourceNode: Node = link.source;
    const targetNode: Node = link.target;
    const newnew = [];
    newnew.push(sourceNode.label);
    newnew.push(targetNode.label);
    const test = [newnew]
    if (link.clicked) {
      link.clicked = false;
      this.changeEdgesColor(test, "black");
    } else {
      link.clicked = true;
      this.changeEdgesColor(test, 'blue');
    }
  }

  moveGraph(x: number) {
    this.nodes.forEach((node: Node) => node.x = x);
  }

  contractEdge(firstVertex: string, secondVertex: string) {
    const edgeToRemove: Link = this.findEdge(firstVertex, secondVertex);
    const source: Node = edgeToRemove.source;
    const target: Node = edgeToRemove.target;
    const inc = this.findAllIncomingEdgesOfVertex(source);
    const inc2 = this.findAllIncomingEdgesOfVertex(target);
    let joinedEdges: Link[] = inc.concat(inc2);
    this.links = this.links.filter((link: Link) => !joinedEdges.includes(link));
    const linkToRemove = joinedEdges.find((link: Link) => link.source.label === firstVertex && link.source.label === secondVertex || link.source.label === secondVertex && link.target.label === firstVertex);
    joinedEdges = joinedEdges.filter((link: Link) => link !== linkToRemove);
    this.nodes = this.nodes.filter((node: Node) => node.label !== secondVertex);

    joinedEdges.forEach((link: Link) => {
      if (link.source.label === secondVertex) link.source = target;
      if (link.target.label === secondVertex) link.target = target;
    });

    this.links = joinedEdges;

    console.log(this.nodes);
    console.log(this.links);
    this.restart();
  }

  private findEdge(sourceNode: string, targetNode: string): Link {
    return this.links.find(link => {
      const src: Node = link.source;
      const target: Node = link.target;
      return (src.label === sourceNode && target.label === targetNode) || (src.label === targetNode && target.label === sourceNode);
    });
  }
}

function generateRandomGraph(n, m) {
  const maxNumEdges = (n * (n - 1)) / 2;
  if (n < 0 || m < 0 || m > maxNumEdges) return undefined;

  const graph = { nodes: [], links: [] };

  for (let i = 0; i < n; i++) {
    graph.nodes[i] = { id: i + 1, label: JSON.stringify(i + 1) };
  }

  const randomInt = (min, max) => Math.floor(Math.random() * (max - min) + min);

  const state = {};
  for (let i = 0; i < m; i++) {
    const j = randomInt(i, maxNumEdges);
    if (!(i in state)) state[i] = i;
    if (!(j in state)) state[j] = j;
    [state[i], state[j]] = [state[j], state[i]];
  }

  function unpair(k) {
    const z = Math.floor((-1 + Math.sqrt(1 + 8 * k)) / 2);
    return [k - (z * (1 + z)) / 2, (z * (3 + z)) / 2 - k];
  }

  for (let i = 0; i < m; i++) {
    const [x, y] = unpair(state[i]);
    const u = graph.nodes[x];
    const v = graph.nodes[n - 1 - y];
    graph.links.push({ source: u, target: v });
  }
  return graph;
}

function hull(points) {
  if (points.length < 2) return;
  if (points.length < 3) return d3.polygonHull([points[0], ...points]);
  return d3.polygonHull(points);
}