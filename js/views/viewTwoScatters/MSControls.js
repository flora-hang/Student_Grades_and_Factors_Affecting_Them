import { getAttrLabel } from "./constants.js";

export class MSControls {
	constructor(container, handlers = {}) {
		this.container = container;
		this.onCategoryChange = handlers.onCategoryChange || (() => {});
		this.onAttributeToggle = handlers.onAttributeToggle || (() => {});
		this.dispatcher = handlers.dispatcher || null;
	}

	init(categories, selectedCategory, availableAttrs, selectedAttrs) {
		this.categories = categories;
		this.wrapper = this.container
			.append("div")
			.attr('class', 'controls')
			.style("width", "150px")
			.style("color", "#222")
			.style("position", 'fixed')
			.style("left", 5)
			.style("z-index", 100)
			.style("background-color", "white")
			.style("border-radius", 20)
			.style("padding", 10)

		this.render(selectedCategory, availableAttrs, selectedAttrs);
	}

	render(selectedCategory, availableAttrs, selectedAttrs) {
		this.selectedCategory = selectedCategory;
		this.availableAttrs = availableAttrs;
		this.selectedAttrs = new Set(selectedAttrs);
		this.wrapper.selectAll("*").remove();
		this._renderCategoryDropdown();
		this._renderAttributeList();
		if (this.dispatcher) {
			this.dispatcher.call("selectionChanged", this, {
				category: this.selectedCategory,
				attrs: [...this.selectedAttrs],
			});
		}
	}

	_renderCategoryDropdown() {
		const section = this.wrapper.append("div").style("margin-bottom", "18px");

		section
			.append("div")
			.style("font-size", "11px")
			.style("color", "#444")
			.style("margin-bottom", "6px")
			.text("Category");

		const selectedName = this.categories.find(d => d.key === this.selectedCategory)?.name ?? this.selectedCategory;
		section
			.append("div")
			.attr("class", "ms-dropdown-button")
			.style("border", "1px solid #cfcfcf")
			.style("border-radius", "4px")
			.style("padding", "6px 8px")
			.style("font-size", "12px")
			.style("background", "#fff")
			.style("color", "#222")
			.text(selectedName);

		const options = section
			.append("div")
			.attr("class", "ms-dropdown-options")
			.style("margin-top", "6px")
			.style("border", "1px solid #cfcfcf")
			.style("border-radius", "4px")
			.style("background", "#fff")
			.style("overflow", "hidden");

		options
			.selectAll("div.category-option")
			.data(this.categories)
			.enter()
			.append("div")
			.attr("class", "category-option")
			.attr("data-value", (d) => d.key)
			.style("padding", "6px 8px")
			.style("font-size", "11px")
			.style("color", "#222")
			.style("cursor", "pointer")
			.style("border-bottom", (_, i) =>
				i === this.categories.length - 1 ? "none" : "1px solid #eee",
			)
			.style("background", (d) =>
				d.key === this.selectedCategory ? "#e8eef5" : "#fff",
			)
			.style("font-weight", (d) =>
				d.key === this.selectedCategory ? "600" : "400",
			)
			.text((d) => d.name)
			.on("click", (_, d) => {
				this.onCategoryChange(d.key);
			});
	}

	_renderAttributeList() {
		const section = this.wrapper.append("div");

		section
			.append("div")
			.style("font-size", "11px")
			.style("color", "#444")
			.style("margin-bottom", "6px")
			.text("Attributes");

		const items = section
			.selectAll("label.attr-item")
			.data(this.availableAttrs)
			.enter()
			.append("label")
			.attr("class", "attr-item")
			.style("display", "flex")
			.style("align-items", "center")
			.style("gap", "6px")
			.style("margin", "4px 0")
			.style("font-size", "11px")
			.style("color", "#222");

		items
			.append("input")
			.attr("type", "checkbox")
			.attr("data-attr", (d) => d)
			.property("checked", (d) => this.selectedAttrs.has(d))
			.on("change", (event, d) => {
				this.onAttributeToggle(d, event.target.checked);
			});

		items.append("span").text((d) => getAttrLabel(d));
	}
}
