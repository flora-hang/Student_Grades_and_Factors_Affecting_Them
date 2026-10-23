// Shared highlight logic used by both MSScatterRowRenderer and MSDetailView.
// Highlighted points are recolored; opacity is untouched.

export const HIGHLIGHT_COLOR = "#e07b39";

/**
 * Apply highlight state to a selection of circle.point elements by changing fill color.
 * All points keep their existing opacity — no dimming.
 *
 * @param {d3.Selection} pointsSelection - circle elements bound to sample data
 * @param {Set}          highlightedIds  - sampleIDs to highlight; empty Set = no active highlight
 * @param {string}       normalColor     - fill color for non-highlighted (or all, when inactive)
 */
export function applyHighlight(pointsSelection, highlightedIds, normalColor) {
	const active = highlightedIds.size > 0;
	pointsSelection.attr("fill", (d) =>
		active && highlightedIds.has(d.sampleID) ? HIGHLIGHT_COLOR : normalColor,
	);
}
