class PCNodeHoverManager {

	constructor(overlayRenderer, ribbonRenderer) {
		this.overlayRenderer = overlayRenderer;
		this.ribbonRenderer = ribbonRenderer;
	}


	// called when mouse hovers above a node
	// highlights ribbons associated to this node's attribute & value
	onMouseover(attr, value, selection) {
		if (this.overlayRenderer.isFrozen()) return;

		const matchingKeys = this._getMatchingRibbonKeys(attr, value, selection);
		if (matchingKeys.length === 0) {
			this.overlayRenderer.clearH();
			return;
		}

		this.overlayRenderer.applyHMultiple(matchingKeys);
	}


	// called when mouse leaves a node
	onMouseout() {
		if (this.overlayRenderer.isFrozen()) return;
		this.overlayRenderer.clearH();
	}


	// helpers (internal)
	// returns all ribbon keys where, for each selected axis, the ribbon contains
	// at least one of that axis's selected values
	_getMatchingRibbonKeys(attr, value, selection) {
		const matchingKeys = [];

		// build per-axis required sets: attr -? Set of acceptable values
		// hovered node counts as a single-value requirement for its axis
		const requiredByAxis = {};
		requiredByAxis[attr] = new Set([value]);

		for (const selAttr in selection) {
			if (!requiredByAxis[selAttr]) {
				requiredByAxis[selAttr] = new Set();
			}
			for (const selValue of selection[selAttr]) {
				requiredByAxis[selAttr].add(selValue);
			}
		}

		this.ribbonRenderer.ribbonGroup
			.selectAll('path.ribbon')
			.each(function (d) {
				const segments = d.key.split('||');

				// build a map of attr -> value present in this ribbon's path
				const ribbonValues = {};
				for (const segment of segments) {
					const colonIdx = segment.indexOf(':');
					const segAttr = segment.slice(0, colonIdx);
					const segValue = segment.slice(colonIdx + 1);
					ribbonValues[segAttr] = segValue;
				}

				// ribbon must satisfy every required axis (at least one value per axis)
				let matchesAll = true;
				for (const reqAttr in requiredByAxis) {
					const ribbonValue = ribbonValues[reqAttr];
					if (!ribbonValue || !requiredByAxis[reqAttr].has(ribbonValue)) {
						matchesAll = false;
						break;
					}
				}

				if (matchesAll) matchingKeys.push(d.key);
			});

		return matchingKeys;
	}

}


export default PCNodeHoverManager;