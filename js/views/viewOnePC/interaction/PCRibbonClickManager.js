class PCRibbonClickManager {

	constructor(overlayRenderer) {
		this.overlayRenderer = overlayRenderer;
	}


	// toogles freeze state
	onClick(d, event) {
		// stop propagation so background click handler does not fire immediately
		event.stopPropagation();

		if (this.overlayRenderer.isFrozen()) {
			this.overlayRenderer.unfreeze();
		} else {
			this.overlayRenderer.applyH(d.key);
			this.overlayRenderer.freeze(d.key);
		}
	}

}


export default PCRibbonClickManager;