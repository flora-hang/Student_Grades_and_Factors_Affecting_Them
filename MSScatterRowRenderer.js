import {
	VIEW_CONFIG,
	FINAL_GRADE_ATTR,
	isDiscreteAttr,
	getAxisTickLabel,
	getShortLabel,
	getSparseTicks,
	getFinalGrade,
} from "./constants.js";
import { applyHighlight } from "./highlightScatter.js";

export class MSScatterRowRenderer {
	constructor(container, processor) {
		this.container = container;
		this.processor = processor;
		this.config = VIEW_CONFIG;
		this.xScale = null;
		this.legendGroup = null;
		this.onPanelClick = null;
		this.highlightedIds = new Set();
	}

	setPanelClickHandler(fn) {
		this.onPanelClick = fn;
	}

	highlight(ids) {
		this.highlightedIds = new Set(ids);
		if (this.plotGroup) {
			applyHighlight(this.plotGroup.selectAll("circle.point"), this.highlightedIds, "#555");
		}
	}

	init(attrs) {
		this.attrs = attrs;
		this.svg = this.container.append("svg");
		this._definePanelHoverFilter();
		this.plotGroup = this.svg.append("g").attr("class", "scatter-row");
		this.legendGroup = this.svg.append("g").attr("class", "grade-legend");
		this._initXScale();
		this.render();

		// Re-render whenever the container changes size (window resize, flexbox reflow).
		// Debounced to avoid flooding redraws during continuous resize.
		let _resizeTimer;
		this._resizeObserver = new ResizeObserver(() => {
			clearTimeout(_resizeTimer);
			_resizeTimer = setTimeout(() => this.render(), 80);
		});
		this._resizeObserver.observe(this.container.node());
	}

	update(attrs) {
		this.attrs = attrs;
		if (!this.svg) {
			this.init(attrs);
			return;
		}
		this.render();
	}

	render() {
		if (!this.attrs || this.attrs.length === 0) {
			this.svg.attr("width", 0).attr("height", 0);
			this.plotGroup.selectAll("*").remove();
			this.legendGroup.selectAll("*").remove();
			return;
		}
		const layout = this._computeLayout();
		this.xScale.range([0, layout.innerWidth]);
		this.svg.attr("width", layout.width).attr("height", layout.height);
		this.plotGroup.attr(
			"transform",
			`translate(${layout.margin.left}, ${layout.margin.top})`,
		);

		const panels = this.plotGroup
			.selectAll("g.scatter-panel")
			.data(layout.layouts, (d) => d.attr);

		panels.exit().remove();

		const panelsEnter = panels
			.enter()
			.append("g")
			.attr("class", "scatter-panel");
		panelsEnter.append("rect").attr("class", "panel-bg");
		const inner = panelsEnter.append("g").attr("class", "panel-inner");
		inner.append("g").attr("class", "axis-x");
		inner.append("g").attr("class", "axis-y");
		inner.append("g").attr("class", "violins");
		inner.append("g").attr("class", "points");
		inner.append("text").attr("class", "y-title");

		const panelsMerge = panelsEnter.merge(panels);
		panelsMerge.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
		panelsMerge.each((panel, i, nodes) => {
			this._renderPanel(d3.select(nodes[i]), panel, layout, layout.tickFontSize, layout.labelFontSize);
		});

		panelsMerge
			.style("cursor", "pointer")
			.on("click", (_event, d) => {
				if (this.onPanelClick) this.onPanelClick(d.attr);
			})
			.on("mouseenter", (event) => {
				d3.select(event.currentTarget).select("rect.panel-bg")
					.attr("stroke", "#666")
					.attr("stroke-width", 2.5)
					.attr("filter", "url(#panel-hover-shadow)");
			})
			.on("mouseleave", (event) => {
				d3.select(event.currentTarget).select("rect.panel-bg")
					.attr("stroke", "#ddd")
					.attr("stroke-width", 1)
					.attr("filter", null);
			});

		this._renderXAxisLabel(layout);
		this._renderLegend(layout);
	}

	_renderPanel(panelGroup, panel, layout, tickFontSize, labelFontSize) {
		const { innerMargin, pointRadius, pointOpacity, jitterX } = this.config;
		const { plotWidth, plotHeight } = layout;
		const innerWidth = plotWidth - innerMargin.left - innerMargin.right;
		const innerHeight = plotHeight - innerMargin.top - innerMargin.bottom;
		const attr = panel.attr;
		const isDiscrete = isDiscreteAttr(attr);
		const yScale = this._buildYScale(attr, innerHeight);

		panelGroup
			.select("rect.panel-bg")
			.attr("width", plotWidth)
			.attr("height", plotHeight)
			.attr("rx", 4)
			.attr("fill", "#f9f9f9")
			.attr("stroke", "#ddd")
			.attr("stroke-width", 1);

		const inner = panelGroup
			.select("g.panel-inner")
			.attr("transform", `translate(${innerMargin.left}, ${innerMargin.top})`);

		const axisX = d3
			.axisBottom(this.xScale)
			.ticks(3)
			.tickFormat(d3.format("d"));
		inner
			.select("g.axis-x")
			.attr("transform", `translate(0, ${innerHeight})`)
			.call(axisX);
		this._styleAxis(inner.select("g.axis-x"), tickFontSize);

		const axisY = d3.axisLeft(yScale);
		if (!isDiscrete) {
			axisY.ticks(3).tickFormat(d3.format("d"));
		} else {
			const ticks = getSparseTicks(yScale.domain(), 3);
			axisY.tickValues(ticks).tickFormat((d) => getAxisTickLabel(attr, d));
		}
		inner.select("g.axis-y").call(axisY);
		this._styleAxis(inner.select("g.axis-y"), tickFontSize);

		inner
			.select("text.y-title")
			.attr("transform", null)
			.attr("x", 0)
			.attr("y", -8)
			.attr("text-anchor", "start")
			.attr("font-size", `${labelFontSize}px`)
			.attr("fill", "#444")
			.text(getShortLabel(attr));

		const samples = this.processor.samples.filter((d) => {
			const grade = getFinalGrade(d);
			const yValue = this.processor.getValue(attr, d);
			return grade !== null && yValue !== null;
		});

		const violinGroup = inner.select("g.violins");
		let densityByCategory = new Map();
		let maxViolinWidth = 0;

		if (isDiscrete) {
			const domain = yScale.domain();
			const positions = domain
				.map((d) => yScale(d))
				.filter((d) => typeof d === "number")
				.sort((a, b) => a - b);
			let spacing = innerHeight;
			for (let i = 1; i < positions.length; i++) {
				spacing = Math.min(spacing, positions[i] - positions[i - 1]);
			}
			if (!Number.isFinite(spacing)) spacing = innerHeight;
			maxViolinWidth = Math.max(4, Math.min(spacing * 0.45, 14));

			const xDomain = this.xScale.domain();
			const xMin = Math.min(xDomain[0], xDomain[1]);
			const xMax = Math.max(xDomain[0], xDomain[1]);
			const thresholds = d3.range(
				Math.floor(xMin),
				Math.ceil(xMax) + 1,
				1,
			);
			const bin = d3.bin().domain([xMin, xMax]).thresholds(thresholds);
			const categoryGrades = new Map();
			samples.forEach((d) => {
				const value = this.processor.getValue(attr, d);
				if (value === null) return;
				const key = String(value);
				if (!categoryGrades.has(key)) categoryGrades.set(key, []);
				categoryGrades.get(key).push(getFinalGrade(d));
			});

			const violinData = domain
				.map((category) => {
					const yPos = yScale(category);
					if (typeof yPos !== "number") return null;
					const grades = categoryGrades.get(String(category)) || [];
					const bins = bin(grades);
					const maxCount = d3.max(bins, (b) => b.length) || 1;
					const edges = bins.map((b) => b.x0);
					const densities = bins.map((b) => b.length / maxCount);
					const values = bins.map((b, i) => ({
						x: (b.x0 + b.x1) / 2,
						width: densities[i] * maxViolinWidth,
						y: yPos,
					}));
					densityByCategory.set(String(category), { edges, densities });
					return { category, values };
				})
				.filter((d) => d !== null);

			const area = d3
				.area()
				.x((d) => this.xScale(d.x))
				.y0((d) => d.y - d.width)
				.y1((d) => d.y + d.width)
				.curve(d3.curveCatmullRom);

			const violins = violinGroup
				.selectAll("path.violin")
				.data(violinData, (d) => d.category);
			violins
				.enter()
				.append("path")
				.attr("class", "violin")
				.merge(violins)
				.attr("d", (d) => area(d.values))
				.attr("fill", "#e2e8f0")
				.attr("stroke", "#cbd5e1")
				.attr("stroke-width", 0.6)
				.attr("fill-opacity", 0.65);
			violins.exit().remove();
		} else {
			violinGroup.selectAll("*").remove();
		}

		const pointsGroup = inner.select("g.points");
		const points = pointsGroup
			.selectAll("circle.point")
			.data(samples, (d) => d.sampleID);
		points.exit().remove();

		const pointsEnter = points
			.enter()
			.append("circle")
			.attr("class", "point")
			.attr("r", pointRadius)
			.attr("opacity", pointOpacity);

		const pointsMerge = pointsEnter
			.merge(points)
			.attr("cx", (d) => {
				const grade = getFinalGrade(d);
				if (grade === null) return -999;
				const baseX = this.xScale(grade);
				const offset = isDiscrete ? 0 : this._jitter(d.sampleID, attr, jitterX);
				return this._clamp(baseX + offset, 0, innerWidth);
			})
			.attr("cy", (d) => {
				const grade = getFinalGrade(d);
				const value = this.processor.getValue(attr, d);
				if (value === null) return -999;
				const baseY = yScale(isDiscrete ? String(value) : value);
				if (baseY === undefined) return -999;
				if (!isDiscrete) return baseY;
				const densityDef = densityByCategory.get(String(value));
				if (!densityDef || !Number.isFinite(grade)) return baseY;
				const index = Math.max(
					0,
					Math.min(
						densityDef.densities.length - 1,
						d3.bisectRight(densityDef.edges, grade) - 1,
					),
				);
				const density = densityDef.densities[index] || 0;
				const offset = this._jitter(
					d.sampleID,
					`${attr}-${value}`,
					maxViolinWidth * 2 * density,
				);
				return this._clamp(baseY + offset, 0, innerHeight);
			})
			.attr("fill", "#555");

		applyHighlight(pointsMerge, this.highlightedIds, "#555");
	}

	_renderXAxisLabel(layout) {
		const label = this.plotGroup
			.selectAll("text.x-axis-label")
			.data([FINAL_GRADE_ATTR]);
		label
			.enter()
			.append("text")
			.attr("class", "x-axis-label")
			.merge(label)
			.attr("x", layout.gridWidth / 2)
			.attr("y", layout.gridHeight + 36)
			.attr("text-anchor", "middle")
			.attr("font-size", `15px`)
			.attr("font-weight", 700)
			.attr("fill", "#444")
			.text("Final grade");
	}

	_renderLegend(_layout) {
		this.legendGroup.selectAll("*").remove();
	}

	_buildYScale(attr, innerHeight) {
		const isDiscrete = isDiscreteAttr(attr);
		if (!isDiscrete) {
			const domain = this.processor.getNumericDomain(attr);
			return d3.scaleLinear().domain(domain).range([innerHeight, 0]).nice();
		}
		const domain = this.processor.getCategoryDomain(attr);
		return d3.scalePoint().domain(domain).range([innerHeight, 0]).padding(0.5);
	}

	_initXScale() {
		const domain = this.processor.getNumericDomain(FINAL_GRADE_ATTR);
		this.xScale = d3.scaleLinear().domain(domain).nice();
	}

	_computeLayout() {
		// Read actual container width so the chart fills whatever space flexbox gives it.
		// Fall back to VIEW_CONFIG.viewWidth when the element is not yet in the DOM.
		const containerWidth =
			(this.container.node()?.offsetWidth) || this.config.viewWidth;
		const { gap, margin, innerMargin, columns } = this.config;
		const count = this.attrs.length;
		const colCount = Math.min(columns, count);
		const rowCount = Math.ceil(count / colCount);
		const gridWidth = containerWidth - margin.left - margin.right;
		const plotWidth =
			(gridWidth - (colCount - 1) * gap) / Math.max(1, colCount);
		// Derive panel height from panel width to keep a consistent aspect ratio.
		// The ~1.25× ratio matches the original 160/130 design proportion.
		// A minimum of 80px ensures axis labels still fit at very small widths.
		const plotHeight = Math.max(80, Math.round(plotWidth * 1.25));
		// gridHeight and SVG height grow with the number of rows
		const gridHeight = rowCount * plotHeight + (rowCount - 1) * gap;
		const width = containerWidth;
		const height = gridHeight + margin.top + margin.bottom;
		const layouts = this.attrs.map((attr, i) => {
			const col = i % colCount;
			const row = Math.floor(i / colCount);
			return {
				attr,
				x: col * (plotWidth + gap),
				y: row * (plotHeight + gap),
			};
		});
		const innerWidth = plotWidth - innerMargin.left - innerMargin.right;

		// Scale font sizes with panel width.
		// At the ~100 px design width these reproduce the original 10 px / 8 px sizes.
		const labelFontSize = Math.max(7, Math.min(11, Math.round(plotWidth * 0.10)));
		const tickFontSize  = Math.max(6, Math.min(9,  Math.round(plotWidth * 0.08)));

		return {
			width,
			height,
			layouts,
			margin,
			plotWidth,
			plotHeight,
			gridWidth,
			gridHeight,
			innerWidth,
			labelFontSize,
			tickFontSize,
		};
	}

	_styleAxis(axisGroup, tickFontSize) {
		axisGroup
			.selectAll("path, line")
			.attr("stroke", "#555")
			.attr("shape-rendering", "crispEdges")
			.attr("stroke-width", 1);
		axisGroup.selectAll("text").attr("fill", "#444").attr("font-size", `${tickFontSize}px`);
	}

	_jitter(sampleID, attr, amplitude) {
		const seed = (sampleID * 9301 + this._hash(attr) * 49297) % 233280;
		return (seed / 233280 - 0.5) * amplitude;
	}

	_hash(value) {
		let hash = 0;
		for (let i = 0; i < value.length; i++) {
			hash = (hash * 31 + value.charCodeAt(i)) % 100000;
		}
		return hash;
	}

	_clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	_definePanelHoverFilter() {
		let defs = this.svg.select("defs");
		if (defs.empty()) defs = this.svg.append("defs");

		const filter = defs.append("filter")
			.attr("id", "panel-hover-shadow")
			.attr("x", "-10%").attr("y", "-10%")
			.attr("width", "120%").attr("height", "120%");

		filter.append("feDropShadow")
			.attr("dx", 0).attr("dy", 2)
			.attr("stdDeviation", 4)
			.attr("flood-color", "rgba(0,0,0,0.22)");
	}
}
