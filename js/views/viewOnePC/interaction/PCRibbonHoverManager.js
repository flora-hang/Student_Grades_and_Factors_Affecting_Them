import { buildTooltipContent } from './PCTooltipContent.js';


class PCRibbonHoverManager {

	constructor(overlayRenderer, tooltip, dataProcessor) {
		this.overlayRenderer = overlayRenderer;
		this.tooltip = tooltip;
		this.dataProcessor = dataProcessor;
	}


	// called when mouse enters a ribbon path
	// shows tooltip
	// if not frozen, highlights the ribbon path & dims the other
	onMouseover(d, event) {
		if (this.overlayRenderer.isFrozen()) {
			// when frozen, only show tooltip for highlighted (related) ribbons
			if (this.overlayRenderer.isFrozenRelated(d.key)) {
				this.tooltip.show(event, buildTooltipContent(d.key, this.dataProcessor));
			}
			return;
		}

		this.overlayRenderer.applyH(d.key);
		this.tooltip.show(event, buildTooltipContent(d.key, this.dataProcessor));
	}


	// make tooltip follows the mouse movement on ribbon
	onMousemove(event) {
		this.tooltip.move(event);
	}


	// called when mouse leaves the ribbon
	onMouseout() {
		this.tooltip.hide();
		if (this.overlayRenderer.isFrozen()) return;
		this.overlayRenderer.clearH();
	}

}


export default PCRibbonHoverManager;