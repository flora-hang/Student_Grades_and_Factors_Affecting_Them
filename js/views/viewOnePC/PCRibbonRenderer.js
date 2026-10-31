import { AXIS_HEIGHT } from './PCAxisManager.js';
import { isSelectionActive } from './PCHelper.js';
import { RibbonData } from './PCTypes.js';

// configs
const BASE_OPACITY = 0.5;
const DIMMED_OPACITY = 0.05;


class PCRibbonRenderer {

	constructor(vis, axisManager, dataProcessor) {
		this.axisManager = axisManager;
		this.dataProcessor = dataProcessor;

		// ribbon group stays below nodes
		this.ribbonGroup = vis.insert('g', '.node-group').attr('class', 'ribbon-group');
	}


	// init
	init(colorScales) {
		this.colorScales = colorScales;
		this.render({}); // render with no selected attributes
	}


	// update
	update(colorScales, selection) {
		this.colorScales = colorScales;
		this.render(selection);
	}


	// render
	render(selection) {
		const layouts = this.axisManager.axisLayouts;
		const isActive = isSelectionActive(selection);

		// collect ribbon data across all adjacent axis pairs
		const allRibbons = [];

		// sampleGroups: Map<pathKey, sample[]>
		// Each entry is a filtered subset of samples sharing the same prefix path.
		// Starts with one group (empty path key) containing all samples.
		let sampleGroups = new Map([['', this.dataProcessor.samples]]);

		for (let i = 0; i < layouts.length - 1; i++) {
			const leftLayout = layouts[i];
			const rightLayout = layouts[i + 1];
			const result = this._computeRibbons(leftLayout, rightLayout, sampleGroups);

			for (let ribbon of result.ribbons) {
				ribbon.isHighlighted = this._ribbonMatchesSelection(ribbon, selection, isActive);
				allRibbons.push(ribbon);
			}

			// advance: next pair filters within these path groups
			sampleGroups = result.nextSampleGroups;
		}

		// bind ribbon data and render paths
		const paths = this.ribbonGroup
			.selectAll('path.ribbon')
			.data(allRibbons, d => d.key);

		paths.exit().remove();

		const pathsEnter = paths.enter()
			.append('path')
			.attr('class', 'ribbon');

		const pathsMerge = pathsEnter.merge(paths);

		pathsMerge
			.attr('d', d => this._buildRibbonPath(d))
			.attr('fill', d => d.color)
			.attr('opacity', d => d.isHighlighted ? BASE_OPACITY : DIMMED_OPACITY)
			.attr('stroke', 'none');
	}


	// helper (ribbon computation)

	// compute ribbons for one adjacent pair
	_computeRibbons(leftLayout, rightLayout, sampleGroups) {
		const totalSamples = this.dataProcessor.samples.length;
		const ribbons = [];

		// nextSampleGroups: paths extended by leftAttr:leftValue, used by next pair
		const nextSampleGroups = new Map();

		// initialize offset tracker (node height used by ribbons)
		const leftOffsets = this._initOffsets(leftLayout);
		const rightOffsets = this._initOffsets(rightLayout);

		// loop over left-axis.nodes.paths * right-axis.nodes
		for (const leftNode of leftLayout.nodes) {
			for (const [pathKey, samples] of sampleGroups) {

				// filter samples with left axis value
				const leftFiltered = samples.filter(s => s[leftLayout.attr] === leftNode.value);
				if (leftFiltered.length === 0) continue;

				// extend path key with left axis value
				const newPathKey = pathKey
					? `${pathKey}||${leftLayout.attr}:${leftNode.value}`
					: `${leftLayout.attr}:${leftNode.value}`;

				nextSampleGroups.set(newPathKey, leftFiltered);

				for (const rightNode of rightLayout.nodes) {
					// filter samples that already passed left axis value by the right axis values
					// only the counts will be useful
					const count = leftFiltered.filter(s => s[rightLayout.attr] === rightNode.value).length;
					if (count === 0) continue;

					// ribbon height proportional to count / overall total
					const leftHeight = (count / totalSamples) * AXIS_HEIGHT;
					const rightHeight = (count / totalSamples) * AXIS_HEIGHT;

					const leftY1 = leftNode.y + leftOffsets[leftNode.value];
					const rightY1 = rightNode.y + rightOffsets[rightNode.value];

					// color: midpoint between the interpolation of both side node colors
					const leftColor = this.colorScales[leftLayout.attr](leftNode.value);
					const rightColor = this.colorScales[rightLayout.attr](rightNode.value);
					const color = d3.interpolate(leftColor, rightColor)(0.5);

					// unique key for ribbon
					const ribbonKey = `${newPathKey}||${rightLayout.attr}:${rightNode.value}`;

					ribbons.push(new RibbonData(
						leftLayout.attr,
						rightLayout.attr,
						leftNode.value,
						rightNode.value,
						leftLayout.x,
						rightLayout.x,
						leftY1,
						leftY1 + leftHeight,
						rightY1,
						rightY1 + rightHeight,
						color,
						ribbonKey
					));

					// move offset tracker by the used height in this iteration
					leftOffsets[leftNode.value] += leftHeight;
					rightOffsets[rightNode.value] += rightHeight;
				}
			}
		}

		return { ribbons, nextSampleGroups };
	}


	// build ribbon based on RibbonData
	_buildRibbonPath(ribbon) {
		const { leftX, rightX, leftY1, leftY2, rightY1, rightY2 } = ribbon;

		// control point x is halfway between the two axes
		const midX = (leftX + rightX) / 2;

		const topCurve = `M ${leftX} ${leftY1} C ${midX} ${leftY1}, ${midX} ${rightY1}, ${rightX} ${rightY1}`;
		const rightEdge = `L ${rightX} ${rightY2}`;
		const bottomCurve = `C ${midX} ${rightY2}, ${midX} ${leftY2}, ${leftX} ${leftY2}`;
		const close = 'Z';

		return [topCurve, rightEdge, bottomCurve, close].join(' ');
	}


	// initialize empty offset tracker
	_initOffsets(layout) {
		const offsets = {};
		for (let node of layout.nodes) {
			offsets[node.value] = 0;
		}
		return offsets;
	}


	// selection logic (check later)
	_ribbonMatchesSelection(ribbon, selection, isActive) {
		if (!isActive) return true;

		// ribbon.key encodes the full path: "attr0:v0||attr1:v1||...||rightAttr:vRight"
		// check every axis value in the path against the current selection
		for (const segment of ribbon.key.split('||')) {
			const colonIdx = segment.indexOf(':');
			const attr = segment.slice(0, colonIdx);
			const value = segment.slice(colonIdx + 1);
			const selected = selection[attr];
			if (selected && selected.size > 0 && !selected.has(value)) return false;
		}

		return true;
	}



	// attach ribbon-related interaction handlers
	attachInteractionHandlers(hoverManager, clickManager) {
		this.ribbonGroup.selectAll('path.ribbon')
			.on('mouseover', (event, d) => {
				hoverManager.onMouseover(d, event);
			})
			.on('mousemove', (event) => {
				hoverManager.onMousemove(event);
			})
			.on('mouseout', () => {
				hoverManager.onMouseout();
			})
			.on('click', (event, d) => {
				clickManager.onClick(d, event);
			});
	}

}


export default PCRibbonRenderer;