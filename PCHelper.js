// helper functions for parallel coordinates view

// checks if there is any values in each attribute
export function isSelectionActive(selection) {
	for (let attr in selection) {
		if (selection[attr].size > 0) return true;
	}
	return false;
}

// wrap text labels into a fixed max width
export function wrapLabel(textSelection, maxChars) {
	textSelection.each(function () {
		const el = d3.select(this);
		const label = el.text();
		el.text('');

		const words = label.split(' ');
		const lines = [];
		let currentLine = '';

		for (const word of words) {
			const candidate = currentLine ? `${currentLine} ${word}` : word;
			if (candidate.length > maxChars && currentLine) {
				lines.push(currentLine);
				currentLine = word;
			} else {
				currentLine = candidate;
			}
		}
		if (currentLine) lines.push(currentLine);

		lines.forEach((line, i) => {
			el.append('tspan')
				.attr('x', 0)
				.attr('dy', i === 0 ? 0 : '1.2em')
				.text(line);
		});
	});
}