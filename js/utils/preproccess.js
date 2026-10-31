const fs = require("fs");
const d3 = require("d3-dsv");

// run `node js/utils/preproccess.js` to execute

// categorize age
function ageMap(age) {
	const a = parseInt(age);
	if (a <= 16) return "15-16";
	else if (a <= 18) return "17-18";
	else if (a <= 20) return "19-20";
	else return "21-22";
}

// categorize absences
function absencesMap(n) {
	const a = parseInt(n);
	if (a === 0) return "None";
	else if (a <= 5) return "Low";
	else if (a <= 15) return "Moderate";
	else return "High";
}

// map final grade (integer 0-20) to qualification level (1-poor to 6-excellent)
//   18-20 -> 6 (Excellent), 16-17 -> 5 (Very Good), 14-15 -> 4 (Good)
//   10-13 -> 3 (Sufficient), 4-9 -> 2 (Weak), 0-3 -> 1 (Poor)
function finalGradeMap(g) {
	const a = parseInt(g);
	if (a >= 18) return 6;
	else if (a >= 16) return 5;
	else if (a >= 14) return 4;
	else if (a >= 10) return 3;
	else if (a >= 4) return 2;
	else return 1;
}


// read csv
const PATH = require("path").join(__dirname, "../../data/");
fs.readFile(PATH + "student-por.csv", "utf8", (err, raw) => {

	if (err) throw err;

	const data = d3.dsvFormat(";").parse(raw);

	// map categories
	const temp = data.map((row, index) => {  // [CHANGED] added index parameter
		row.age_levels = ageMap(row.age);
		row.absences_levels = absencesMap(row.absences);
		row.final_grade = row.G3;
		row.final_grade_levels = finalGradeMap(row.G3);  // [ADDED]
		return row;
	})

	// drop columns G1, G2, G3
	const DROP_COLUMNS = ["G1", "G2", "G3"];
	const processed = temp.map((row, index) => {  // [CHANGED] added index parameter
		DROP_COLUMNS.forEach(col => delete row[col]);
		return { id: index + 1, ...row };  // [CHANGED] prepend id column (1-indexed)
	})

	// output file
	const out = d3.csvFormat(processed);
	fs.writeFile(PATH + "student-por-processed.csv", out, err => {
		if (err) throw err;
	});
});