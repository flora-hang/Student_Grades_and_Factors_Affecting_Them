import { getAttrType, getCategories, getNumericRange } from "../../utils/datasetHelper.js";

// continuous gradient scale for numeric attributes (final_grade)
function buildNumericColorScale(attr) {
	const range = getNumericRange(attr);
	const maxIndex = range.length - 1;

	return function (value) {
		let index = range.indexOf(value);
		let t = index / maxIndex;
		return d3.interpolateYlOrRd(t);
	}
}

// sequencial color scale for ordinal attributes
function buildOrdinalColorScale(attr) {
	const categories = getCategories(attr);
	const maxIndex = categories.length - 1;

	return function (value) {
		let index = categories.indexOf(value);
		let t = 0.2 + (index / maxIndex) * 0.8;
		return d3.interpolateBlues(t);
	}

}

// distinguishable color scale for categorical attributes
function buildCategoricalColorScale(attr) {
	const categories = getCategories(attr);

	return function (value) {
		const index = categories.indexOf(value);
		return d3.schemeTableau10[index % d3.schemeTableau10.length];
	}
}


// build a color function for a given attribute based on its type
export function buildColorScale(attr) {
	const type = getAttrType(attr);
	if (type === 'numeric') {
		return buildNumericColorScale(attr);
	} else if (type === 'ordinal') {
		return buildOrdinalColorScale(attr);
	} else { // type === categorical
		return buildCategoricalColorScale(attr);
	}
}

