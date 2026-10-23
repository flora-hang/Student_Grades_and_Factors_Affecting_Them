/**
 * handles all data logic for the parallel coordinates view.
 * receives raw data from d3.csv
 */

import { getCategories, getNumericRange } from "../../utils/datasetHelper.js";

class PCDataProcessor {


	constructor(raw) {
		// assign 0-based sampleID to each row
		this.samples = raw.map(row => ({
			sampleID: row.id,
			...row,
		}));
	}

	// frequencies (count of samples) for one attribute
	computeNodeFrequencies(attr) {
		const orderedValues = this.getOrderedValues(attr);
		const frequencies = new Map();

		// preset frequency to 0
		orderedValues.forEach(value => frequencies.set(value, 0));

		// count matching samples for each value
		this.samples.forEach(sample => {
			const value = sample[attr];
			if (frequencies.has(value)) {
				frequencies.set(value, frequencies.get(value) + 1);
			}
		});

		return frequencies;
	}

	// joint frequencies 
	// count number of samples for attr1 * attr2
	computeJointFrequencies(attr1, attr2) {
		const jointFrequencies = new Map();

		this.samples.forEach(sample => {
			const value1 = sample[attr1];
			const value2 = sample[attr2];
			const key = `${value1}||${value2}`;
			jointFrequencies.set(key, (jointFrequencies.get(key) ?? 0) + 1);
		});

		return jointFrequencies;
	}

 
	/**
	 * filter samples that matches all selections of nodes (AND logic)
	 * @param {Object<string, Set<string>} selection 
	 * e.g. { failures: new Set(['0', '1']), sex: new Set('F') }
	 * @returns an array of matching sample objects
	 */
	filterSamples(selection) {
		let result = [];
		for (let sample of this.samples) {
			let match = true;

			for (let attr in selection) {
				let selectedVals = selection[attr];
				if (selectedVals.size === 0) continue;
				if (!selectedVals.has(sample[attr])) {
					match = false;
					break;
				}
			}

			if (match) result.push(sample);
		}

		return result;
	}

	// return set of sampleIds for the filtering
	getFilteredSampleIds(selection) {
		const filtered = this.filterSamples(selection);
		const ids = new Set();

		for (let sample of filtered) {
			ids.add(sample.sampleID);
		}

		return ids;

	}

	// get one sample by its sampleId
	getSample(id) {
		for (let sample of this.samples) {
			if (sample.sampleID === id) return sample; 
		}
		return null;
	}

	// get all samples whose final grade matches the given value (string)
	getSamplesByGrade(grade) {
		let result = [];
		for (let sample of this.samples) {
			if (sample.final_grade === grade) {
				result.push(sample);
			}
		}
		return result;
	}


	// helper functions
	getOrderedValues(attr) {
		return getNumericRange(attr) ?? getCategories(attr);
	}




}

export default PCDataProcessor;