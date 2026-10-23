class PCBackgroundClickHandler {

	constructor(vis) {
		this.callbacks = [];

		// trigger event when vis is clicked & target is itself
		vis.on('click.background', (event) => {
			if (event.target !== vis.node()) return;
			for (const cb of this.callbacks) {
				cb();
			}
		});
	}

	// register callback function for a background click
	register(callback) {
		this.callbacks.push(callback);
	}

	// unregister
	unregister(callback) {
		this.callbacks = this.callbacks.filter(cb => cb !== callback);
	}

}


export default PCBackgroundClickHandler;