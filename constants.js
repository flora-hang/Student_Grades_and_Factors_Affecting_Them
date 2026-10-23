export let labelMap = null;

export function setLabelMap(map) {
	labelMap = map;
}

export const DEFAULT_CATEGORY = "study_habits";
export const FINAL_GRADE_ATTR = "final_grade";
export const DISCRETE_NUMERIC_ATTRS = new Set(["failures"]);

export const VIEW_CONFIG = {
	plotWidth: 130,
	plotHeight: 160,
	gap: 5,
	columns: 5,
	fixedRows: 2,
	margin: { top: 36, right: 12, bottom: 56, left: 8 },
	innerMargin: { top: 16, right: 8, bottom: 22, left: 36 },
	pointRadius: 1.6,
	pointOpacity: 0.6,
	jitterX: 2.5,
};


VIEW_CONFIG.viewWidth = Math.min(VIEW_CONFIG.margin.left +
	VIEW_CONFIG.margin.right +
	VIEW_CONFIG.columns * VIEW_CONFIG.plotWidth +
	(VIEW_CONFIG.columns - 1) * VIEW_CONFIG.gap, 
	(window.innerWidth - 200) / 2);

VIEW_CONFIG.viewHeight =
	VIEW_CONFIG.margin.top +
	VIEW_CONFIG.margin.bottom +
	VIEW_CONFIG.fixedRows * VIEW_CONFIG.plotHeight +
	(VIEW_CONFIG.fixedRows - 1) * VIEW_CONFIG.gap;

export function getAttrLabel(attr) {
	if (!labelMap || !labelMap[attr] || !labelMap[attr].label) return attr;
	return labelMap[attr].label;
}

export function getAttrType(attr) {
	if (!labelMap || !labelMap[attr] || !labelMap[attr].type)
		return "categorical";
	return labelMap[attr].type;
}

export function isDiscreteAttr(attr) {
	const type = getAttrType(attr);
	return type !== "numeric" || DISCRETE_NUMERIC_ATTRS.has(attr);
}

export function getLabel(attr, value) {
	const def = labelMap ? labelMap[attr] : null;
	if (!def) return value;
	if (def.type === "numeric") return value;
	if (!def.scale) return value;
	const match = def.scale.find((d) => d.value === String(value));
	return match ? match.label : value;
}

export function getCategories(attr) {
	const def = labelMap ? labelMap[attr] : null;
	if (!def || def.type === "numeric") return null;
	if (!def.scale || !Array.isArray(def.scale)) return null;
	return def.scale.map((d) => d.value);
}

export function getNumericRange(attr) {
	const def = labelMap ? labelMap[attr] : null;
	if (!def || def.type !== "numeric") return null;
	if (
		!def.scale ||
		typeof def.scale.min !== "number" ||
		typeof def.scale.max !== "number"
	) {
		return null;
	}
	const range = [];
	for (let i = def.scale.min; i <= def.scale.max; i++) {
		range.push(String(i));
	}
	return range;
}

export function getAxisTickLabel(attr, value) {
	if (attr === "studytime") {
		const map = {
			1: "<2h",
			2: "2-5h",
			3: "5-10h",
			4: ">10h",
		};
		return map[String(value)] || value;
	}
	return getLabel(attr, value);
}

export function getShortLabel(attr) {
	const label = getAttrLabel(attr);
	if (label.length <= 14) return label;
	return attr;
}

export function getSparseTicks(domain, maxTicks) {
	if (!domain || domain.length <= maxTicks) return domain || [];
	const ticks = [];
	const step = (domain.length - 1) / (maxTicks - 1);
	for (let i = 0; i < maxTicks; i++) {
		const idx = Math.round(i * step);
		const value = domain[idx];
		if (!ticks.includes(value)) ticks.push(value);
	}
	return ticks;
}

export function getFinalGrade(sample) {
	const value = Number(sample[FINAL_GRADE_ATTR]);
	return Number.isNaN(value) ? null : value;
}
