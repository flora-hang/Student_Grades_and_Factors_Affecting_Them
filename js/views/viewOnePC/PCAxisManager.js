import { getAttrLabel } from "../../utils/datasetHelper.js";
import { wrapLabel } from "./PCHelper.js";
import { NodeLayout, AxisLayout } from "./PCTypes.js";

// get width of window
const viewportWidth = window.innerWidth - 30 - 160;

const CONFIG = {
	width: viewportWidth,
	height: 550,
	marginLeft: 80,
	marginRight: 80,
	marginTop: 25,
	marginBottom: 120,
	paddingInner: 30,
	nodePadding: 0, // gap between adjacent nodes
}


const AXIS_TOP = CONFIG.marginTop + CONFIG.paddingInner;
const AXIS_BOTTOM = CONFIG.height - CONFIG.marginBottom - CONFIG.paddingInner;
export const AXIS_HEIGHT = AXIS_BOTTOM - AXIS_TOP;
const LABEL_Y = CONFIG.marginTop - 10; // y position for axis label

export default class PCAxisManager {

	// vis: top-level svg
	constructor(vis) {
		this.axisGroup = vis.append('g').attr('class', 'axis-group');

		// a list of AxisLayout object
		this._axisLayouts = [];
	}

	// init
	// freqMap: frequency Map from DataProcessor.computeNodeFrequencies
	init(axisAttrs, freqMap) {
		this._computeLayouts(axisAttrs, freqMap);
		this.render();
	}

	// update
	update(axisAttrs, freqMap) {
		this._computeLayouts(axisAttrs, freqMap);
		this.render();
	}

	// render
	render() {
		const axes = this.axisGroup
			.selectAll('g.axis')
			.data(this._axisLayouts, d => d.attr);

		axes.exit().remove();

		const axesEnter = axes.enter()
			.append('g')
			.attr('class', 'axis');
console.log('axis top', AXIS_TOP)
		axesEnter.append('line')
			.attr('class', 'axis-line')
			.attr('y1', AXIS_TOP)
			.attr('y2', AXIS_BOTTOM)
			.attr('stroke', '#ffffff00')
			.attr('stroke-width', 1.5);

		axesEnter.append('text')
			.attr('class', 'axis-label')
			.attr('y', LABEL_Y)
			.attr('text-anchor', 'middle')
			.attr('font-size', '13px')
			.attr('fill', '#222');

		const axesMerge = axesEnter.merge(axes);

		axesMerge.attr('transform', d => `translate(${d.x}, 0)`);

		axesMerge.select('line.axis-line')
			.attr('x1', 0)
			.attr('x2', 0);

		axesMerge.select('text.axis-label')
			.attr('x', 0)
			.text(d => getAttrLabel(d.attr))
			.call(wrapLabel, 20); // wrap text width
	}

	// helper

	// compute AxisLayout info for all axes
	_computeLayouts(axisAttrs, freqMap) {
		this._axisLayouts = [];
		const axisCount = axisAttrs.length;
		const layoutWidth = CONFIG.width - CONFIG.marginLeft - CONFIG.marginRight;

		for (let i = 0; i < axisCount; i++) {
			let attr = axisAttrs[i];
			let x = CONFIG.marginLeft + (i / (axisCount - 1)) * layoutWidth;
			let nodeFreqs = freqMap.get(attr);
			let nodes = this._computeNodeLayout(nodeFreqs);

			this._axisLayouts.push(new AxisLayout(attr, x, nodes));
		}
	}

	// compute NodeLayout for each node on a single axis
	_computeNodeLayout(freqs) {

		// get total counts
		let total = 0;
		for (let count of freqs.values()) {
			total += count;
		}

		let nodes = [];
		let currY = AXIS_TOP;

		// reverse entries to keep last value on top
		let entries = [...freqs.entries()].reverse();

		for (let [value, count] of entries) {
			let height = (count / total) * AXIS_HEIGHT;
			nodes.push(new NodeLayout(value, currY, height));
			currY += height + CONFIG.nodePadding;
		}

		return nodes;
	}

	get axisLayouts() {
		return this._axisLayouts;
	}

	getAxisLayout(attr) {
		for (const layout of this._axisLayouts) {
			if (layout.attr === attr) return layout;
		}
		return null;
	}

	getNodeLayout(attr, value) {
		const axisLayout = this.getAxisLayout(attr);
		if (!axisLayout) return null;

		for (const node of axisLayout.nodes) {
			if (node.value === value) return node;
		}
		return null;
	}


}