import { getLabel } from '../../utils/datasetHelper.js';
import { buildColorScale } from './PCColorHelper.js';
import { isSelectionActive } from './PCHelper.js';

// configs
const NODE_WIDTH = 20;
const NODE_WIDTH_HOVERED = 30;            // expanded width on hover
const FULL_OPACITY = 1.0;
const DIMMED_GREY = '#ffffff';     // target grey for dimmed interpolation
const DIMMED_GREY_AMOUNT = 0.6;          // how far to interpolate toward grey (0=original, 1=full grey)
const SELECTED_STROKE = '#ffffff';     // white outline for selected nodes
const SELECTED_STROKE_W = 2;
const HOVER_TRANSITION_MS = 120;           // ms for scale-up / scale-down animation

// SVG filter id for the drop-shadow applied on hover
const HOVER_FILTER_ID = 'pc-node-hover-shadow';


export class PCNodeRenderer {


	constructor(vis, axisManager) {
		this.axisManager = axisManager;
		this.layouts = axisManager.axisLayouts;
		this.nodeGroup = vis.append('g').attr('class', 'node-group');
		this.colorScales = {};  // attr → color function

		// define the drop-shadow SVG filter once, shared by all nodes
		this._defineHoverFilter(vis);

		// floating tooltip div for node value labels
		this.tooltip = d3.select('body').append('div')
			.attr('class', 'pc-tooltip')
			.style('position', 'absolute')
			.style('background', 'rgba(0,0,0,0.75)')
			.style('color', '#fff')
			.style('padding', '4px 8px')
			.style('border-radius', '4px')
			.style('font-size', '12px')
			.style('pointer-events', 'none')
			.style('display', 'none');
	}


	// init
	init() {
		this._setAxisColorScale();
		this.render({}); // render with no actively selected categories
	}


	// update
	update(selection) {
		this._setAxisColorScale();
		this.render(selection);
	}


	// render
	render(selection) {
		const isActive = isSelectionActive(selection);

		const axisGroups = this.nodeGroup
			.selectAll('g.node-axis')
			.data(this.axisManager.axisLayouts, d => d.attr);

		axisGroups.exit().remove();

		const axisGroupsEnter = axisGroups.enter()
			.append('g')
			.attr('class', 'node-axis');

		const axisGroupsMerge = axisGroupsEnter.merge(axisGroups);

		// place at the correct x location
		axisGroupsMerge.attr('transform', d => `translate(${d.x}, 0)`);

		// for each axis group, bind and render nodes
		axisGroupsMerge.each((layout, i, nodes) => {
			this._renderNodes(d3.select(nodes[i]), layout, selection, isActive);
		});
	}


	// node rendering for each axis
	_renderNodes(axisGroup, layout, selection, isActive) {
		const attr = layout.attr;
		const colorScale = this.colorScales[attr];
		const selectedVals = selection[attr] ? selection[attr] : new Set();

		// exclude nodes with 0 count (zero height, not visible or clickable)
		const visibleNodes = layout.nodes.filter(d => d.height > 0);

		const nodes = axisGroup
			.selectAll('rect.node')
			.data(visibleNodes, d => d.value);

		nodes.exit().remove();

		const nodesEnter = nodes.enter()
			.append('rect')
			.attr('class', 'node')
			.attr('rx', 2)
			.attr('ry', 2)
			.style('cursor', 'pointer');

		const nodesMerge = nodesEnter.merge(nodes);

		// position and size (always reset to base width after re-render)
		nodesMerge
			.attr('x', -NODE_WIDTH / 2)
			.attr('y', d => d.y)
			.attr('width', NODE_WIDTH)
			.attr('height', d => d.height);

		// color fill: full color for selected/unfiltered, grey-interpolated for dimmed
		nodesMerge
			.attr('fill', d => {
				const baseColor = colorScale(d.value);
				if (!isActive || selectedVals.has(d.value)) return baseColor;
				return d3.interpolate(baseColor, DIMMED_GREY)(DIMMED_GREY_AMOUNT);
			});

		// opacity: always full (dimming is handled via color interpolation above)
		nodesMerge
			.attr('opacity', FULL_OPACITY);

		// stroke: white outline on selected nodes to distinguish from unselected
		nodesMerge
			.attr('stroke', d => selectedVals.has(d.value) ? SELECTED_STROKE : 'none')
			.attr('stroke-width', d => selectedVals.has(d.value) ? SELECTED_STROKE_W : 0);

		// clear any lingering hover state from previous render
		nodesMerge
			.attr('filter', 'none');
	}


	// interaction

	// attach interaction handlers for nodes
	// also, attach visual effects for hovering / clicking
	attachInteractionHandlers(clickManager, hoverManager, getSelection) {
		const tooltip = this.tooltip;

		this.nodeGroup.selectAll('rect.node')
			.on('click', (event, d) => {
				event.stopPropagation();
				const attr = d3.select(event.currentTarget.parentNode).datum().attr;
				clickManager.onClick(attr, d.value);
			})
			.on('mouseover', (event, d) => {
				const attr = d3.select(event.currentTarget.parentNode).datum().attr;

				// scale up with transition
				d3.select(event.currentTarget)
					.transition().duration(HOVER_TRANSITION_MS)
					.attr('x', -NODE_WIDTH_HOVERED / 2)
					.attr('width', NODE_WIDTH_HOVERED);

				// apply drop-shadow filter
				d3.select(event.currentTarget)
					.attr('filter', `url(#${HOVER_FILTER_ID})`);

				// show node label tooltip
				tooltip
					.style('display', 'block')
					.text(getLabel(attr, d.value));

				// trigger hover highlight on ribbons
				hoverManager.onMouseover(attr, d.value, getSelection());
			})
			.on('mousemove', (event) => {
				tooltip
					.style('left', (event.pageX + 12) + 'px')
					.style('top', (event.pageY - 28) + 'px');
			})
			.on('mouseout', (event) => {
				// scale back down with transition
				d3.select(event.currentTarget)
					.transition().duration(HOVER_TRANSITION_MS)
					.attr('x', -NODE_WIDTH / 2)
					.attr('width', NODE_WIDTH);

				// remove drop-shadow filter
				d3.select(event.currentTarget)
					.attr('filter', 'none');

				tooltip.style('display', 'none');
				hoverManager.onMouseout();
			});
	}


	// get colorScales for use by ribbon renderer
	getColorScales() {
		return this.colorScales;
	}


	// helpers

	// rebuild color scales for each axis
	_setAxisColorScale() {
		this.colorScales = {}; // reset existing color scales
		for (let layout of this.axisManager.axisLayouts) {
			this.colorScales[layout.attr] = buildColorScale(layout.attr);
		}
	}


	// define a reusable SVG drop-shadow filter for hover state
	_defineHoverFilter(vis) {
		// append <defs> to the SVG if not already present
		let defs = vis.select('defs');
		if (defs.empty()) {
			defs = vis.append('defs');
		}

		// only add the filter once
		if (!defs.select(`#${HOVER_FILTER_ID}`).empty()) return;

		const filter = defs.append('filter')
			.attr('id', HOVER_FILTER_ID)
			.attr('x', '-50%')
			.attr('y', '-50%')
			.attr('width', '200%')
			.attr('height', '200%');

		// gaussian blur for the shadow
		filter.append('feGaussianBlur')
			.attr('in', 'SourceAlpha')
			.attr('stdDeviation', 4)
			.attr('result', 'blur');

		// offset the shadow slightly downward
		filter.append('feOffset')
			.attr('in', 'blur')
			.attr('dx', 0)
			.attr('dy', 2)
			.attr('result', 'offsetBlur');

		// control shadow color and opacity
		filter.append('feFlood')
			.attr('flood-color', 'rgba(0,0,0,0.45)')
			.attr('result', 'color');

		filter.append('feComposite')
			.attr('in', 'color')
			.attr('in2', 'offsetBlur')
			.attr('operator', 'in')
			.attr('result', 'shadow');

		// merge shadow behind original graphic
		const merge = filter.append('feMerge');
		merge.append('feMergeNode').attr('in', 'shadow');
		merge.append('feMergeNode').attr('in', 'SourceGraphic');
	}

}