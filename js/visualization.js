class Visualization {

	constructor(_config, _data) {
		this.config = {
			parentElement: _config.parentElement,
			containerWidth: 1300,
			containerHeight: 350,
			margin: { top: 20, right: 20, bottom: 20, left: 20 },
			chernoffRowGap: 10,
			chernoffFacePadding: 5,
		}
		
		this.data = _data;
	}
}