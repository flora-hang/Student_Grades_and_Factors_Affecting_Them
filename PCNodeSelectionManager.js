class PCNodeSelectionManager {

	/**
	 * @param {Function} onChange - callback on changes in selection
	 */
	constructor(onChange) {
		this.onChange = onChange;

		// raw selection state
		// { {attr1: Set(value1, value2)}, {attr2: Set(value1)} }
		// use Set to avoid double adding
		this.selection = {};
	}

	// accessed from external processes

	// (a) if not in selection, add attr-value pair to selection
	// (b) otherwise remove from selection
	toggle(attr, value) {
		// handle (a)
		if (!this.selection[attr]) {
			this.selection[attr] = new Set();
		}
		// handle (b)
		if (this.selection[attr].has(value)) {
			this.selection[attr].delete(value);

			// clean up empty sets
			if (this.selection[attr].size === 0) {
				delete this.selection[attr];
			}
		} else {
			this.selection[attr].add(value);
		}

		this.onChange(this._format());
	}


	// clears all selection
	clear() {
		this.selection = {};
		this.onChange([]);
	}


	// getter
	getSelection() {
		return this.selection;
	}


	// check if an attr-value pair is currently selected
	isSelected(attr, value) {
		return !!(this.selection[attr] && this.selection[attr].has(value));
	}


	// check if there is any active selection
	hasSelection() {
		for (const attr in this.selection) {
			if (this.selection[attr].size > 0) return true;
		}
		return false;
	}


	// helpers (internal)
	// reformat selection (Set -> array) to pass to external processes
	_format() {
		const result = [];
		for (const attr in this.selection) {
			if (this.selection[attr].size > 0) {
				result.push({ [attr]: [...this.selection[attr]] });
			}
		}
		return result;
	}

}


export default PCNodeSelectionManager;