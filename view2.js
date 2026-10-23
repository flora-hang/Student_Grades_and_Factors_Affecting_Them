import { setLabelMap, DEFAULT_CATEGORY } from "./viewTwoScatters/constants.js";
import { MSDataProcessor } from "./viewTwoScatters/MSDataProcessor.js";
import { MSView } from "./viewTwoScatters/MSView.js";

export default class View2 {
	constructor(containerSelector = "#view2", categoryDefs = [], dispatcher = null) {
		this.containerSelector = containerSelector;
		this.categoryDefs = categoryDefs;
		this.dispatcher = dispatcher;
	}

	chernoff() {
		if (this.msView) this.msView.chernoff();
	}

	setSelected(ids) {
		if (this.msView) {
			if (ids && ids.length > 0) {
				this.msView.setHighlighted(ids);
			} else {
				this.msView.removeHighlight();
			}
		}
	}

	setHighlighted(ids) {
		if (this.msView) {
			if (ids && ids.length > 0) {
				this.msView.setHighlighted(ids);
			} else {
				this.msView.removeHighlight();
			}
		}
	}

	removeHighlight() {
		if (this.msView) {
			this.msView.removeHighlight();
		}
	}
	async init() {
		let root = d3.select(this.containerSelector);
		if (root.empty()) {
			root = d3.select("body").append("div").attr("id", "view2");
		}

		root.selectAll("*").remove();
		const loading = root
			.append("div")
			.style("font-size", "12px")
			.style("color", "#444")
			.style("margin", "12px 0")
			.text("Loading View 2...");

		if (typeof d3 === "undefined") {
			loading.text("View 2 failed to load: D3 is not available.");
			return;
		}

		try {
			const [raw, map] = await Promise.all([
				d3.csv("data/student-por-processed.csv"),
				d3.json("js/utils/labelMap.json"),
			]);
			setLabelMap(map || {});
			loading.remove();
			const processor = new MSDataProcessor(raw);
			this.msView = new MSView(root, processor, this.categoryDefs, this.dispatcher);
			this.msView.init(DEFAULT_CATEGORY);
		} catch (error) {
			loading.text("View 2 failed to load data. Check the console for details.");
			console.error("View 2 load error:", error);
		}
	}
}
