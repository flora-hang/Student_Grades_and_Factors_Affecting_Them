// html content for a tooltip
export function buildTooltipContent(ribbonKey, dataProcessor) {
	const segments = ribbonKey.split('||');
	const constraints = {};

	for (const segment of segments) {
		const colonIdx = segment.indexOf(':');
		const attr = segment.slice(0, colonIdx);
		const value = segment.slice(colonIdx + 1);
		constraints[attr] = value;
	}

	// count samples matching all constraints
	let count = 0;
	for (const sample of dataProcessor.samples) {
		let match = true;
		for (const attr in constraints) {
			if (sample[attr] !== constraints[attr]) {
				match = false;
				break;
			}
		}
		if (match) count++;
	}

	// build HTML lines
	const lines = segments.map(seg => {
		const colonIdx = seg.indexOf(':');
		const attr = seg.slice(0, colonIdx);
		const value = seg.slice(colonIdx + 1);
		return `<b>${attr}</b> = ${value}`;
	});
	lines.push(`Count: ${count}`);

	return lines.join('<br>');
}