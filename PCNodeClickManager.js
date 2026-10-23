class PCNodeClickManager {

	constructor(selectionManager, overlayRenderer, hoverManager) {
		this.selectionManager = selectionManager;
		this.overlayRenderer = overlayRenderer;
		this.hoverManager = hoverManager;
	}

	// triggered when a node is clicked (from external processes)
	onClick(attr, value) {
		// toggle the clicked value in selection
		this.selectionManager.toggle(attr, value);

		const selection = this.selectionManager.getSelection();

		if (!this.selectionManager.hasSelection()) {
			// no selection left — unfreeze and clear
			this.overlayRenderer.unfreeze();
			return;
		}

		// recompute H based on all currently selected nodes
		const matchingKeys = this._getMatchingRibbonKeys(selection);

		if (matchingKeys.length === 0) {
			this.overlayRenderer.unfreeze();
			return;
		}

		// apply and freeze the new highlight
		this.overlayRenderer.applyHMultiple(matchingKeys);
		this.overlayRenderer.freezeMultiple(matchingKeys);
	}


	// -------------------------------------------------------------------------
	// Helpers (internal)
	// -------------------------------------------------------------------------

	/**
	 * Returns all ribbon keys where, for each selected axis, the ribbon contains
	 * at least one of that axis's selected values (OR within axis, AND across axes).
	 *
	 * @param   {Object<string, Set<string>>} selection
	 * @returns {string[]}
	 */
	_getMatchingRibbonKeys(selection) {
		const matchingKeys = [];

		this.hoverManager.ribbonRenderer.ribbonGroup
			.selectAll('path.ribbon')
			.each(function (d) {
				const segments = d.key.split('||');

				// build a map of attr → value present in this ribbon's path
				const ribbonValues = {};
				for (const segment of segments) {
					const colonIdx = segment.indexOf(':');
					const segAttr = segment.slice(0, colonIdx);
					const segValue = segment.slice(colonIdx + 1);
					ribbonValues[segAttr] = segValue;
				}

				// ribbon must satisfy every selected axis (at least one value per axis)
				let matchesAll = true;
				for (const selAttr in selection) {
					const ribbonValue = ribbonValues[selAttr];
					if (!ribbonValue || !selection[selAttr].has(ribbonValue)) {
						matchesAll = false;
						break;
					}
				}

				if (matchesAll) matchingKeys.push(d.key);
			});

		return matchingKeys;
	}

}


export default PCNodeClickManager;