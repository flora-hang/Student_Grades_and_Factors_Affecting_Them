import {
	getAttrType,
	getCategories,
	getNumericRange,
	DISCRETE_NUMERIC_ATTRS,
} from "./constants.js";

export class MSDataProcessor {
	constructor(raw) {
		this.samples = raw.map((row, index) => ({
			sampleID: Number(row.id || index + 1),
			...row,
		}));
	}

	getNumericDomain(attr) {
		const range = getNumericRange(attr);
		if (range && range.length > 1) {
			return [Number(range[0]), Number(range[range.length - 1])];
		}
		const values = this.samples
			.map((d) => Number(d[attr]))
			.filter((d) => !Number.isNaN(d));
		if (values.length === 0) return [0, 1];
		return d3.extent(values);
	}

	getCategoryDomain(attr) {
		const categories = getCategories(attr);
		if (categories && categories.length > 0) return categories;
		if (DISCRETE_NUMERIC_ATTRS.has(attr)) {
			const range = getNumericRange(attr);
			if (range && range.length > 0) return range;
			const values = this.samples
				.map((d) => Number(d[attr]))
				.filter((d) => !Number.isNaN(d));
			const unique = Array.from(new Set(values)).sort((a, b) => a - b);
			return unique.map((d) => String(d));
		}
		const set = new Set();
		this.samples.forEach((d) => {
			if (d[attr] !== undefined && d[attr] !== null && d[attr] !== "") {
				set.add(String(d[attr]));
			}
		});
		return Array.from(set);
	}

	getValue(attr, sample) {
		const type = getAttrType(attr);
		if (type === "numeric") {
			const num = Number(sample[attr]);
			return Number.isNaN(num) ? null : num;
		}
		if (
			sample[attr] === undefined ||
			sample[attr] === null ||
			sample[attr] === ""
		) {
			return null;
		}
		return String(sample[attr]);
	}
}
