// configs
const GREY_COLOR = '#aaaaaa';
const HIGHLIGHT_OPACITY = 0.7;
const DIMMED_OPACITY = 0.15;
const BASE_OPACITY = 0.5;


class PCOverlayRenderer {

	constructor(ribbonRenderer) {
		this.ribbonRenderer = ribbonRenderer;

		// freeze state
		this.frozen = false;
		this.frozenKey = null;   // single key (set by ribbon click)
		this.frozenKeys = [];     // multiple keys (set by node click)
	}


	// H: "highlights that ribbon plus all its preceders and descendants 
	// (via prefix matching on the full path key), dims everything else to grey" 
	// apply H on a single ribbon path key
	applyH(ribbonKey) {
		this.ribbonRenderer.ribbonGroup
			.selectAll('path.ribbon')
			.each(function (d) {
				const isHighlighted = _isRelatedRibbon(d.key, ribbonKey);
				d3.select(this)
					.attr('fill', isHighlighted ? d.color : GREY_COLOR)
					.attr('opacity', isHighlighted ? HIGHLIGHT_OPACITY : DIMMED_OPACITY);
			});
	}


	// apply H on multiple ribbon path keys
	applyHMultiple(ribbonKeys) {
		this.ribbonRenderer.ribbonGroup
			.selectAll('path.ribbon')
			.each(function (d) {
				let isHighlighted = false;
				for (const key of ribbonKeys) {
					if (_isRelatedRibbon(d.key, key)) {
						isHighlighted = true;
						break;
					}
				}
				d3.select(this)
					.attr('fill', isHighlighted ? d.color : GREY_COLOR)
					.attr('opacity', isHighlighted ? HIGHLIGHT_OPACITY : DIMMED_OPACITY);
			});
	}


	// exit H & restore original color
	clearH() {
		this.ribbonRenderer.ribbonGroup
			.selectAll('path.ribbon')
			.each(function (d) {
				d3.select(this)
					.attr('fill', d.color)
					.attr('opacity', d.isHighlighted ? BASE_OPACITY : 0.05);
			});
	}


	// freeze state: the chosen ribbon remains on screen regardless of mouse activity
	// freeze the ribbon using its key
	freeze(ribbonKey) {
		this.frozen = true;
		this.frozenKey = ribbonKey;
		this.frozenKeys = [];
	}


	// freeze multiple ribbons
	freezeMultiple(ribbonKeys) {
		this.frozen = true;
		this.frozenKey = null;
		this.frozenKeys = ribbonKeys;
	}


	// unfreeze & clear
	unfreeze() {
		this.frozen = false;
		this.frozenKey = null;
		this.frozenKeys = [];
		this.clearH();
	}


	// check if the view is in freezing state
	isFrozen() {
		return this.frozen;
	}


	// check if a ribbon (by its key) is related to a frozen ribbon
	isFrozenRelated(ribbonKey) {
		if (!this.frozen) return false;

		// check against single frozen key (ribbon click)
		if (this.frozenKey) {
			return _isRelatedRibbon(ribbonKey, this.frozenKey);
		}

		// check against multiple frozen keys (node click)
		for (const key of this.frozenKeys) {
			if (_isRelatedRibbon(ribbonKey, key)) return true;
		}
		return false;
	}

}


// check if candidateKey is a preceder, self, or descendant of sourceKey
function _isRelatedRibbon(candidateKey, sourceKey) {
	if (candidateKey === sourceKey) return true;
	if (sourceKey.startsWith(candidateKey + '||')) return true;
	if (candidateKey.startsWith(sourceKey + '||')) return true;
	return false;
}


export default PCOverlayRenderer;