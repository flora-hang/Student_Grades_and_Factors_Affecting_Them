class PCTooltip {

	constructor() {
		// html component of tooltip
		this.div = d3.select('body').append('div')
			.attr('class', 'pc-tooltip')
			.style('position', 'absolute')
			.style('background', 'rgba(0,0,0,0.75)')
			.style('color', '#fff')
			.style('padding', '6px 10px')
			.style('border-radius', '4px')
			.style('font-size', '12px')
			.style('pointer-events', 'none')
			.style('display', 'none');
	}

	/**
	 * show tooltip following cursor above certain html content
	 *
	 * @param {MouseEvent} event
	 * @param {string} html
	 */
	show(event, html) {
		this.div
			.style('display', 'block')
			.html(html);
		this.move(event);
	}

	// move tooltip to follow cursor
	move(event) {
		this.div
			.style('left', (event.pageX + 12) + 'px')
			.style('top', (event.pageY - 28) + 'px');
	}

	// hides the tooltip
	hide() {
		this.div.style('display', 'none');
	}

}


export default PCTooltip;