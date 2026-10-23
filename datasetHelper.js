const map = await fetch(new URL('./labelMap.json', import.meta.url)).then(r => r.json());

// get the human-readable label for an attribute
// e.g. getAttrLabel("failures") => "Number of past class failures"
export function getAttrLabel(attr) {
	return map[attr].label;
}

// get the type of an attribute: "numeric", "ordinal", or "categorical"
// e.g. getAttrType("failures") => "numeric"
export function getAttrType(attr) {
	return map[attr].type;
}

// get human-readable label for a category
// if attribute is numeric return null
export function getLabel(attr, value) {
	const { type, scale } = map[attr];
	if (type === "numeric") {
		return value;
	}
	else {
		const match = scale.find(d => d.value === String(value));
		return match ? match.label : value;
	}
}

// get all categories of a categorical / ordinal attribute
// if ordinal, the array is in order
export function getCategories(attr) {
	const { type, scale } = map[attr];
	if (type === "numeric") return null;
	else return scale.map(d => d.value);
}

// get all integer values of a numeric attribute as strings, in order
// getNumericRange("age") => ["15", "16", ..., "22"]
export function getNumericRange(attr) {
  const { type, scale } = map[attr];
  if (type !== "numeric") return null;

  const range = [];
  for (let i = scale.min; i <= scale.max; i++) {
    range.push(String(i));
  }
  return range;
}