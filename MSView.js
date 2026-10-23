import { MSControls } from "./MSControls.js";
import { MSScatterRowRenderer } from "./MSScatterRowRenderer.js";
import { MSDetailView } from "./MSDetailView.js";

export class MSView {
	constructor(root, processor, categoryDefs, dispatcher = null) {
		this.root = root;
		this.processor = processor;
		this.categoryDefs = categoryDefs;
		this.categoryMap = new Map(Object.entries(categoryDefs).map(([key, v]) => [key, v.attrs]));
		this.dispatcher = dispatcher;
	}

	init(defaultCategory) {
		this.root
			.style("margin", "24px 0")
			.style("font-family", "'IBM Plex Sans', 'Work Sans', sans-serif")
			.style("color", "#222");

		this.root
			.append("div")
			.style("font-weight", "600")
			.style("margin-bottom", "4px")
			.attr('class', 'view-label')
			.style("margin-left", "150px")
			.text("Final Grade Distributions Across Attributes and Categories");

		this.root
			.append("div")
			.style("font-size", "11px")
			.style("color", "#444")
			.style("margin-bottom", "14px")
			// .text("Each panel shows the relationship between a student characteristic and final grade.");

		const content = this.root
			.append("div")
			.style("display", "flex")
			.style("gap", "9px")
			.style("align-items", "flex-start");

		const controlsWrap = content.append("div");
		const chartWrap = content
			.append("div")
			.style("position", "relative")
			.style("margin-left", "150px")
			.style("width", "calc(100% - 150px)")
			.style("height", `clamp(280px, 28vw, 430px)`);

		this.rowWrap = chartWrap.append("div")
			.style("width", "100%")
			.style("height", "100%")
			.style("overflow-y", "auto");

		this.detailWrap = chartWrap.append("div")
			.style("position", "absolute")
			.style("top", "0")
			.style("left", "0")
			.style("width", "100%")
			.style("height", "100%")
			.style("display", "none");

		this.scrollShadow = chartWrap.append("div")
			.style("position", "absolute")
			.style("bottom", "0")
			.style("left", "0")
			.style("right", "0")
			.style("height", "40px")
			.style("background", "linear-gradient(to bottom, transparent, rgba(0,0,0,0.10))")
			.style("pointer-events", "none")
			.style("display", "none");

		// this.rowWrap.on("scroll", () => this._updateScrollShadow());

		this.selectedCategory = defaultCategory;
		this.availableAttrs = this.categoryMap.get(defaultCategory) || [];
		this.selectedAttrs = this.availableAttrs.slice();

		this.controls = new MSControls(controlsWrap, {
			onCategoryChange: (category) => this._setCategory(category),
			onAttributeToggle: (attr, checked) => this._toggleAttribute(attr, checked),
			dispatcher: this.dispatcher,
		});
		this.controls.init(
			Object.entries(this.categoryDefs).map(([key, v]) => ({ key, ...v })),
			this.selectedCategory,
			this.availableAttrs,
			this.selectedAttrs,
		);

		this.scatter = new MSScatterRowRenderer(this.rowWrap, this.processor);
		this.scatter.setPanelClickHandler((attr) => this._onPanelClick(attr));
		this.scatter.init(this.selectedAttrs);
		setTimeout(() => this._updateScrollShadow(), 0);

		this.detail = new MSDetailView(this.detailWrap, this.processor, this.dispatcher);
	}

	_onPanelClick(attr) {
		this._inDetail = true;
		this.rowWrap.style("display", "none");
		this.scrollShadow.style("display", "none");
		this.detail.show(attr, () => this._onBackFromDetail());
	}

	_onBackFromDetail() {
		this._inDetail = false;
		this.detail.hide();
		this.rowWrap.style("display", "block");
		this._updateScrollShadow();
	}

	_updateScrollShadow() {
		const el = this.rowWrap.node();
		const overflows = el.scrollHeight > el.clientHeight + 2;
		const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
		this.scrollShadow.style("display", overflows && !atBottom ? "block" : "none");
	}

	chernoff() {
		this._setCategory("chernoff_face_attributes");
	}

	setHighlighted(ids) {
		this._highlightedIds = ids.map(Number);
		this.scatter.highlight(this._highlightedIds);
		this.detail.highlight(this._highlightedIds);
	}

	removeHighlight() {
		this.setHighlighted([]);
	}

	_reapplyHighlights() {
		if (this._highlightedIds && this._highlightedIds.length > 0) {
			this.scatter.highlight(this._highlightedIds);
		}
	}

	_setCategory(category) {
		if (this._inDetail) this._onBackFromDetail();
		if (category === this.selectedCategory) return;
		this.selectedCategory = category;
		this.availableAttrs = this.categoryMap.get(category) || [];
		this.selectedAttrs = this.availableAttrs.slice();
		this.controls.render(
			this.selectedCategory,
			this.availableAttrs,
			this.selectedAttrs,
		);
		this.scatter.update(this.selectedAttrs);
		this._reapplyHighlights();
		setTimeout(() => this._updateScrollShadow(), 0);
	}

	_toggleAttribute(attr, checked) {
		if (this._inDetail) this._onBackFromDetail();
		const selected = new Set(this.selectedAttrs);
		if (checked) {
			selected.add(attr);
		} else {
			selected.delete(attr);
		}
		if (selected.size === 0) {
			this.controls.render(
				this.selectedCategory,
				this.availableAttrs,
				this.selectedAttrs,
			);
			return;
		}
		this.selectedAttrs = this.availableAttrs.filter((item) =>
			selected.has(item),
		);
		this.controls.render(
			this.selectedCategory,
			this.availableAttrs,
			this.selectedAttrs,
		);
		this.scatter.update(this.selectedAttrs);
		this._reapplyHighlights();
		setTimeout(() => this._updateScrollShadow(), 0);
	}
}
