import {
	VIEW_CONFIG,
	FINAL_GRADE_ATTR,
	isDiscreteAttr,
	getAxisTickLabel,
	getShortLabel,
	getSparseTicks,
	getFinalGrade,
	getAttrLabel,
} from "./constants.js";
import { applyHighlight, HIGHLIGHT_COLOR } from "./highlightScatter.js";

const MARGIN = { top: 48, right: 24, bottom: 68, left: 56 };
const POINT_RADIUS = 4;
const POINT_OPACITY = 0.72;
const POINT_COLOR = "#aaaaaa";
const ORDINARY_STROKE_COLOR = "#777777";
const POINT_HOVER_COLOR = "#777777";
const POINT_SELECTED_COLOR = "#c0392b";
const JITTER_X = 2.5;
const FILTER_ID = "ms-detail-point-shadow";


export class MSDetailView {
	constructor(container, processor, dispatcher) {
		this.container = container;
		this.processor = processor;
		this.dispatcher = dispatcher;
		this._built = false;
		this.highlightedIds = new Set();
		this.selectedSampleId = null;
	}

	highlight(ids) {
		this.highlightedIds = new Set(ids);
		if (this._built) {
			applyHighlight(this.panel.selectAll("circle.point"), this.highlightedIds, POINT_COLOR);
		}
	}

	// show the detail view for the given attr; onBack is called to return
	show(attr, onBack) {
		this.attr = attr;
		this.onBack = onBack;
		this.container.style("display", "block");
		if (!this._built) {
			this._build();
		} else {
			this._render();
		}
	}

	hide() {
		this.container.style("display", "none");
	}


	_build() {
		// Measure the container's actual rendered dimensions.
		// detailWrap is position:absolute with height:100% inside chartWrap, so
		// parentElement.offsetHeight gives the CSS-clamped chartWrap height.
		const W = this.container.node()?.offsetWidth || VIEW_CONFIG.viewWidth;
		const H = this.container.node()?.parentElement?.offsetHeight || VIEW_CONFIG.viewHeight;
		this._W = W;
		this._H = H;

		// viewBox fixes the internal coordinate system at the measured size;
		// width/height 100% let CSS scale it to fill detailWrap at any viewport.
		this.svg = this.container.append("svg")
			.attr("viewBox", `0 0 ${W} ${H}`)
			.style("width", "100%")
			.style("height", "100%");

		this._defineFilter();

		// transparent background — clicking anywhere outside the plot returns
		this.svg.append("rect")
			.attr("width", W)
			.attr("height", H)
			.attr("fill", "transparent")
			.style("cursor", "default")
			.on("click", () => this.onBack());

		// title (updated on each render)
		this.titleText = this.svg.append("text")
			.attr("x", W / 2)
			.attr("y", 22)
			.attr("text-anchor", "middle")
			.attr("font-size", "13px")
			.attr("font-weight", "600")
			.attr("fill", "#222");

		// panel group — does NOT stopPropagation so non-point area clicks bubble to bg
		this.panel = this.svg.append("g")
			.attr("class", "detail-panel")
			.attr("transform", `translate(${MARGIN.left}, ${MARGIN.top})`);

		this.panel.append("g").attr("class", "axis-x");
		this.panel.append("g").attr("class", "axis-y");
		this.panel.append("g").attr("class", "violins");
		this.panel.append("g").attr("class", "points");
		this.panel.append("text").attr("class", "x-label");
		this.panel.append("text").attr("class", "y-label");

		this._built = true;
		this._render();
	}


	_render() {
		const W = this._W || VIEW_CONFIG.viewWidth;
		const H = this._H || VIEW_CONFIG.viewHeight;
		const innerW = W - MARGIN.left - MARGIN.right;
		const innerH = H - MARGIN.top - MARGIN.bottom;

		const attr = this.attr;
		const isDiscrete = isDiscreteAttr(attr);

		this.titleText.text(`${getShortLabel(attr)} vs Final Grade`);

		// scales
		const xDomain = this.processor.getNumericDomain(FINAL_GRADE_ATTR);
		const xScale = d3.scaleLinear().domain(xDomain).nice().range([0, innerW]);

		const yScale = isDiscrete
			? d3.scalePoint()
				.domain(this.processor.getCategoryDomain(attr))
				.range([innerH, 0])
				.padding(0.5)
			: d3.scaleLinear()
				.domain(this.processor.getNumericDomain(attr))
				.nice()
				.range([innerH, 0]);

		// axes
		this.panel.select("g.axis-x")
			.attr("transform", `translate(0, ${innerH})`)
			.call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format("d")));
		this._styleAxis(this.panel.select("g.axis-x"));

		const axisY = d3.axisLeft(yScale);
		if (!isDiscrete) {
			axisY.ticks(5).tickFormat(d3.format("d"));
		} else {
			axisY.tickValues(getSparseTicks(yScale.domain(), 5))
				.tickFormat((d) => getAxisTickLabel(attr, d));
		}
		this.panel.select("g.axis-y").call(axisY);
		this._styleAxis(this.panel.select("g.axis-y"));

		// axis labels
		this.panel.select("text.x-label")
			.attr("x", innerW / 2).attr("y", innerH + 42)
			.attr("text-anchor", "middle")
			.attr("font-size", "11px").attr("fill", "#444")
			.text("Final grade");

		this.panel.select("text.y-label")
			.attr("transform", "rotate(-90)")
			.attr("x", -innerH / 2).attr("y", -46)
			.attr("text-anchor", "middle")
			.attr("font-size", "11px").attr("fill", "#444")
			.text(getAttrLabel(attr));

		// samples
		const samples = this.processor.samples.filter((d) => {
			return getFinalGrade(d) !== null && this.processor.getValue(attr, d) !== null;
		});

		// violins (discrete only)
		const violinGroup = this.panel.select("g.violins");
		const densityByCategory = new Map();

		if (isDiscrete) {
			const domain = yScale.domain();
			const positions = domain.map((d) => yScale(d))
				.filter((d) => typeof d === "number").sort((a, b) => a - b);
			let spacing = innerH;
			for (let i = 1; i < positions.length; i++) {
				spacing = Math.min(spacing, positions[i] - positions[i - 1]);
			}
			if (!Number.isFinite(spacing)) spacing = innerH;
			const maxViolinW = Math.max(4, Math.min(spacing * 0.45, 22));

			const xMin = Math.min(...xDomain), xMax = Math.max(...xDomain);
			const bin = d3.bin()
				.domain([xMin, xMax])
				.thresholds(d3.range(Math.floor(xMin), Math.ceil(xMax) + 1, 1));

			const gradesByCategory = new Map();
			samples.forEach((d) => {
				const val = this.processor.getValue(attr, d);
				if (val === null) return;
				const key = String(val);
				if (!gradesByCategory.has(key)) gradesByCategory.set(key, []);
				gradesByCategory.get(key).push(getFinalGrade(d));
			});

			const violinData = domain.map((cat) => {
				const yPos = yScale(cat);
				if (typeof yPos !== "number") return null;
				const bins = bin(gradesByCategory.get(String(cat)) || []);
				const maxCount = d3.max(bins, (b) => b.length) || 1;
				const edges = bins.map((b) => b.x0);
				const densities = bins.map((b) => b.length / maxCount);
				densityByCategory.set(String(cat), { edges, densities, maxViolinW });
				return {
					cat,
					values: bins.map((b, i) => ({
						x: (b.x0 + b.x1) / 2,
						width: densities[i] * maxViolinW,
						y: yPos,
					})),
				};
			}).filter(Boolean);

			const area = d3.area()
				.x((d) => xScale(d.x))
				.y0((d) => d.y - d.width)
				.y1((d) => d.y + d.width)
				.curve(d3.curveCatmullRom);

			const violins = violinGroup.selectAll("path.violin")
				.data(violinData, (d) => d.cat);
			violins.exit().remove();
			violins.enter().append("path").attr("class", "violin")
				.merge(violins)
				.attr("d", (d) => area(d.values))
				.attr("fill", "#e2e8f0").attr("stroke", "#cbd5e1")
				.attr("stroke-width", 0.8).attr("fill-opacity", 0.65);
		} else {
			violinGroup.selectAll("*").remove();
		}

		// points
		const pts = this.panel.select("g.points")
			.selectAll("circle.point")
			.data(samples, (d) => d.sampleID);
		pts.exit().remove();

		pts.enter().append("circle").attr("class", "point")
			.merge(pts)
			.attr("r", POINT_RADIUS)
			.attr("opacity", POINT_OPACITY)
			.style("cursor", "pointer")
			.attr("cx", (d) => {
				const grade = getFinalGrade(d);
				if (grade === null) return -999;
				const offset = isDiscrete ? 0 : this._jitter(d.sampleID, attr, JITTER_X);
				return this._clamp(xScale(grade) + offset, 0, innerW);
			})
			.attr("cy", (d) => {
				const value = this.processor.getValue(attr, d);
				if (value === null) return -999;
				const baseY = yScale(isDiscrete ? String(value) : value);
				if (baseY === undefined) return -999;
				if (!isDiscrete) return baseY;
				const densityDef = densityByCategory.get(String(value));
				const grade = getFinalGrade(d);
				if (!densityDef || !Number.isFinite(grade)) return baseY;
				const idx = Math.max(0, Math.min(
					densityDef.densities.length - 1,
					d3.bisectRight(densityDef.edges, grade) - 1,
				));
				const offset = this._jitter(
					d.sampleID, `${attr}-${value}`,
					densityDef.maxViolinW * 2 * (densityDef.densities[idx] || 0),
				);
				return this._clamp(baseY + offset, 0, innerH);
			})
			.attr("fill", POINT_COLOR)
			.attr("stroke", ORDINARY_STROKE_COLOR)
			.attr("stroke-width", 0.8)
			.on("click", (event, d) => {
				event.stopPropagation();
				// Check if clicking the same dot that's already selected
				if (this.selectedSampleId === d.sampleID) {
					// Deselect it
					const active = this.highlightedIds.size > 0;
					const prevFill = active && this.highlightedIds.has(d.sampleID)
						? HIGHLIGHT_COLOR : POINT_COLOR;
					
					d3.select(event.currentTarget)
						.attr("r", POINT_RADIUS)
						.attr("opacity", POINT_OPACITY)
						.attr("stroke-opacity", POINT_OPACITY)
						.attr("fill", prevFill)
						.attr("stroke", ORDINARY_STROKE_COLOR)
						.attr("stroke-width", 0.8)
						.attr("filter", null);
					
					this.selectedSampleId = null;
					this.dispatcher.call("scatterDotSelected", null, null); // Send null to indicate deselection
				} else {
					// Clear previous selection
					if (this.selectedSampleId !== null) {
						const active = this.highlightedIds.size > 0;
						const prevFill = active && this.highlightedIds.has(this.selectedSampleId)
							? HIGHLIGHT_COLOR : POINT_COLOR;
						this.panel.selectAll("circle.point")
							.filter((p) => p.sampleID === this.selectedSampleId)
							.attr("r", POINT_RADIUS)
							.attr("opacity", POINT_OPACITY)
							.attr("stroke-opacity", POINT_OPACITY)
							.attr("fill", prevFill)
							.attr("stroke", ORDINARY_STROKE_COLOR)
							.attr("stroke-width", 0.8)
							.attr("filter", null);
					}
					
					// Select new dot
					this.selectedSampleId = d.sampleID;
					d3.select(event.currentTarget)
						.attr("r", POINT_RADIUS * 2)
						.attr("opacity", 1)
						.attr("stroke-opacity", 1)
						.attr("fill", POINT_SELECTED_COLOR)
						.attr("stroke", "#fff")
						.attr("stroke-width", 1.5)
						.attr("filter", `url(#${FILTER_ID})`);
					
					this.dispatcher.call("scatterDotSelected", null, d.sampleID);
				}
			})
			.on("mouseenter", (event) => {
				d3.select(event.currentTarget)
					.attr("r", POINT_RADIUS * 2)
					.attr("opacity", 1)
					.attr("stroke-opacity", 1)
					.attr("fill", POINT_HOVER_COLOR)
					.attr("stroke", "#fff")
					.attr("stroke-width", 1.5)
					.attr("filter", `url(#${FILTER_ID})`);
			})
			.on("mouseleave", (event, d) => {
				if (d.sampleID === this.selectedSampleId) return;
				const active = this.highlightedIds.size > 0;
				const fill = active && this.highlightedIds.has(d.sampleID)
					? HIGHLIGHT_COLOR : POINT_COLOR;
				d3.select(event.currentTarget)
					.attr("r", POINT_RADIUS)
					.attr("opacity", POINT_OPACITY)
					.attr("stroke-opacity", POINT_OPACITY)
					.attr("fill", fill)
					.attr("stroke", ORDINARY_STROKE_COLOR)
					.attr("stroke-width", 0.8)
					.attr("filter", null);
			});

		applyHighlight(this.panel.selectAll("circle.point"), this.highlightedIds, POINT_COLOR);
	}


	_defineFilter() {
		let defs = this.svg.select("defs");
		if (defs.empty()) defs = this.svg.append("defs");
		defs.append("filter")
			.attr("id", FILTER_ID)
			.attr("x", "-50%").attr("y", "-50%")
			.attr("width", "200%").attr("height", "200%")
			.append("feDropShadow")
			.attr("dx", 0).attr("dy", 1)
			.attr("stdDeviation", 2)
			.attr("flood-color", "rgba(0,0,0,0.35)");
	}

	_styleAxis(axisGroup) {
		axisGroup.selectAll("path, line").attr("stroke", "#555").attr("stroke-width", 1);
		axisGroup.selectAll("text").attr("fill", "#444").attr("font-size", "10px");
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
}
