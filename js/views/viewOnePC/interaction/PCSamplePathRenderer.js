// configs
const PATH_COLOR = '#000000';
const PATH_WIDTH = 2;
const PATH_OPACITY = 0.85;


class PCSamplePathRenderer {

	// UNUSED & UNTESTED
	// highlight single sample path (from selection of the scatters)
	constructor(svg, axisManager) {
		this.axisManager = axisManager;

		// overlay group sits above all other layers
		this.group = svg.append('g').attr('class', 'sample-path-group');
	}


	// draw a path for a chosen sample
	show(sample) {
		this.clear();

		const points = this._getPoints(sample);
		if (points.length < 2) return;

		this.group.append('path')
			.attr('class', 'sample-path')
			.attr('d', this._buildPath(points))
			.attr('fill', 'none')
			.attr('stroke', PATH_COLOR)
			.attr('stroke-width', PATH_WIDTH)
			.attr('opacity', PATH_OPACITY)
			.attr('pointer-events', 'none');
	}


	// remove all sample paths
	clear() {
		this.group.selectAll('path.sample-path').remove();
	}


	// helpers (internal)

	// compute the (x,y) coordinate at each axis for a sample
	// as connecting points for the path
	_getPoints(sample) {
		const points = [];

		for (const axisLayout of this.axisManager.axisLayouts) {
			const value = sample[axisLayout.attr];
			const nodeLayout = this.axisManager.getNodeLayout(axisLayout.attr, value);
			if (!nodeLayout) continue;

			points.push({
				x: axisLayout.x,
				y: nodeLayout.y + nodeLayout.height / 2,
			});
		}

		return points;
	}


	// build path from the previously computed points on axes
	_buildPath(points) {
		let path = `M ${points[0].x} ${points[0].y}`;

		for (let i = 1; i < points.length; i++) {
			const prev = points[i - 1];
			const curr = points[i];
			const midX = (prev.x + curr.x) / 2;
			path += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
		}

		return path;
	}

}


export default PCSamplePathRenderer;