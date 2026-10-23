import { getAttrLabel, getAttrType, getLabel, getCategories, getNumericRange } from '../../utils/datasetHelper.js';
import { buildColorScale } from './PCColorHelper.js';
import { wrapLabel } from './PCHelper.js';

// config
const CONFIG = {
	// position of the legend panel (right/top margin)
	marginRight: 200,
	// y: 50,
	y: 20,

	// panel padding
	panelPadding: 10,

	// column formatting
	attrLabelFontSize: 10,
	attrLabelColor: '#444',
	attrLabelWrapWidth: 20,
	columnGap: 10,        // horizontal gap between attribute columns
	columnWidth: 100,     // width reserved for each attribute column
	labelContentPadding: 25, // gap between attribute label and column content below it

	// categorical swatches
	swatchSize: 9,       // width and height of each color square
	swatchGap: 3,         // vertical gap between swatches
	swatchLabelGap: 6,    // gap between swatch and its label
	swatchFontSize: 10,
	swatchLabelColor: '#222',

	// gradient bar
	gradientBarWidth: 12,
	gradientBarHeight: 40,
	gradientLabelGap: 6,  // gap between bar and its labels
	gradientLabelOffset: 3, // spreadness - smaller number further away
	gradientLabelFontSize: 9,
	gradientLabelColor: '#222',
};


class PCLegend {

	constructor(vis) {
		this.vis = vis;
	}


	// init
	init(layouts) {
		// legend panel group (x will be set dynamically in _render)
		this.legendGroup = this.vis.append('g')
			.attr('class', 'pc-legend');

		// background group
		this.panelBackground = this.legendGroup.append('rect')
			.attr('class', 'legend-bg')
			.attr('x', 0)
			.attr('y', 0)
			.attr('rx', 4)
			.attr('ry', 4)
			.attr('fill', '#f9f9f9')
			.attr('stroke', '#ddd')
			.attr('stroke-width', 1);

		// content group
		this.contentGroup = this.legendGroup.append('g')
			.attr('transform', `translate(${CONFIG.panelPadding}, ${CONFIG.panelPadding})`);

		this._render(layouts);
	}

	// update (from layouts)
	update(layouts) {
		this.contentGroup.selectAll('*').remove(); // clear
		this._render(layouts);
	}


	// render
	_render(layouts) {
		let currentX = 0;
		let maxHeight = 0;

		for (let layout of layouts) {
			const type = getAttrType(layout.attr);
			const colorScale = buildColorScale(layout.attr);

			// column group for this attribute
			const col = this.contentGroup.append('g')
				.attr('transform', `translate(${currentX}, 0)`);

			// attribute label at top of column
			col.append('text')
				.attr('x', 0)
				.attr('y', 0)
				.attr('font-size', CONFIG.attrLabelFontSize)
				.attr('font-weight', 'bold')
				.attr('fill', CONFIG.attrLabelColor)
				.attr('dominant-baseline', 'hanging')
				.text(getAttrLabel(layout.attr))
				.call(wrapLabel, CONFIG.attrLabelWrapWidth);

			const contentStartY = CONFIG.attrLabelFontSize + CONFIG.labelContentPadding;
			let colHeight;

			if (type === 'categorical') {
				colHeight = this._renderCategoricalLegend(col, layout.attr, colorScale, contentStartY);
			} else {
				colHeight = this._renderGradientLegend(col, layout.attr, colorScale, contentStartY);
			}

			maxHeight = Math.max(maxHeight, colHeight);
			currentX += CONFIG.columnWidth + CONFIG.columnGap;
		}

		// resize background to fit all columns
		const panelWidth = currentX - CONFIG.columnGap + CONFIG.panelPadding * 2;
		this.panelBackground
			.attr('width', panelWidth)
			.attr('height', maxHeight + CONFIG.panelPadding * 2);

		// position legend at top-right of the SVG
		// const svgWidth = +this.vis.attr('width');
		// const legendX = svgWidth - panelWidth - CONFIG.marginRight;
		// this.legendGroup.attr('transform', `translate(${legendX}, ${CONFIG.y})`);
		const svgWidth = this.vis.node().getBoundingClientRect().width;
		const svgHeight = this.vis.node().getBoundingClientRect().height;
		// const svgWidth = +this.vis.attr('width');
		// const svgHeight = +this.vis.attr('height');

		// center horizontally
		const legendX = (svgWidth - panelWidth) / 2;

		// place near bottom
		const legendY = svgHeight - (maxHeight + CONFIG.panelPadding * 2) - 20;

		this.legendGroup.attr('transform', `translate(${legendX}, ${legendY})`);
	}


	_renderCategoricalLegend(col, attr, colorScale, startY) {
		const categories = getCategories(attr);
		let currentY = startY;

		for (let value of categories) {
			// color swatch
			col.append('rect')
				.attr('x', 0)
				.attr('y', currentY)
				.attr('width', CONFIG.swatchSize)
				.attr('height', CONFIG.swatchSize)
				.attr('rx', 2)
				.attr('fill', colorScale(value));

			// value label to the right of swatch
			col.append('text')
				.attr('x', CONFIG.swatchSize + CONFIG.swatchLabelGap)
				.attr('y', currentY + CONFIG.swatchSize / 2)
				.attr('dominant-baseline', 'middle')
				.attr('font-size', CONFIG.swatchFontSize)
				.attr('fill', CONFIG.swatchLabelColor)
				.text(getLabel(attr, value));

			currentY += CONFIG.swatchSize + CONFIG.swatchGap;
		}

		return currentY;
	}


	_renderGradientLegend(col, attr, colorScale, startY) {
		const values = getNumericRange(attr) ?? getCategories(attr);
		const minValue = values[0];
		const maxValue = values[values.length - 1];
		const gradientId = `legend-gradient-${attr}`;

		// define a vertical linear gradient in vis defs
		let defs = this.vis.select('defs');
		if (defs.empty()) {
			defs = this.vis.append('defs');
		}

		// remove previously defined gradient with same id
		defs.select(`#${gradientId}`).remove();

		const gradient = defs.append('linearGradient')
			.attr('id', gradientId)
			.attr('x1', '0%').attr('x2', '0%')
			.attr('y1', '0%').attr('y2', '100%');

		// sample color scale for gradient bar
		const steps = 10;
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			const valueIndex = Math.round((1 - t) * (values.length - 1));
			const value = values[valueIndex];
			gradient.append('stop')
				.attr('offset', `${t * 100}%`)
				.attr('stop-color', colorScale(value));
		}

		// attach gradient bar
		col.append('rect')
			.attr('x', 0)
			.attr('y', startY)
			.attr('width', CONFIG.gradientBarWidth)
			.attr('height', CONFIG.gradientBarHeight)
			.attr('rx', 2)
			.attr('fill', `url(#${gradientId})`);

		const labelX = CONFIG.gradientBarWidth + CONFIG.gradientLabelGap;

		// max label (top)
		col.append('text')
			.attr('x', labelX)
			.attr('y', startY + CONFIG.gradientLabelOffset)
			.attr('dominant-baseline', 'hanging')
			.attr('font-size', CONFIG.gradientLabelFontSize)
			.attr('fill', CONFIG.gradientLabelColor)
			.text(getLabel(attr, maxValue));

		// min label (bottom)
		col.append('text')
			.attr('x', labelX)
			.attr('y', startY + CONFIG.gradientBarHeight - CONFIG.gradientLabelOffset)
			.attr('dominant-baseline', 'auto')
			.attr('font-size', CONFIG.gradientLabelFontSize)
			.attr('fill', CONFIG.gradientLabelColor)
			.text(getLabel(attr, minValue));

		return startY + CONFIG.gradientBarHeight;
	}




}


export default PCLegend;