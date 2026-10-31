import PCView from './views/viewOnePC/PCView.js';
import View2 from './views/view2.js';

const CATEGORIES = {
	"study_habits": { name: "Study Habits", attrs: ["studytime", "failures", "absences", "schoolsup", "paid"] },
	"lifestyle_factors": { name: "Lifestyle Factors", attrs: ["freetime", "goout", "Dalc", "Walc", "activities", "romantic", "health"] },
	"family_factors": { name: "Family Factors", attrs: ["Medu", "Fedu", "Mjob", "Fjob", "guardian", "famrel", "famsup", "internet", "nursery", "higher"] },
	"student_characteristics": { name: "Student Characteristics", attrs: ["school", "sex", "age", "address", "famsize", "Pstatus"] },
	"chernoff_face_attributes": { name: "Chernoff Face Attributes", attrs: ["sex", "Medu", "failures", "studytime", "Dalc", "romantic"] },
};

// setup dispatcher
const dispatcher = d3.dispatch("selectionChanged", "faceSelected", "scatterDotSelected");

// shared category selection states
let activeCategory = CATEGORIES["study_habits"].attrs;

// shared student ids for views 1 (scatter) and 3 (chernoff)
// if array is empty, display all students
let selectedStudentIds = [];

// initialize views
const pcView = new PCView('#pc-view', activeCategory);
pcView.init();

const view2 = new View2('#view2', CATEGORIES, dispatcher);
view2.init();

const chernoff = new ChernoffFaces(
	{ parentElement: '#view3' },
	selectedStudentIds,
	dispatcher
);
chernoff.initVis();

// Update selected category/attributes
dispatcher.on("selectionChanged", ({ attrs }) => {
	pcView.update(attrs);
});

// Update the faceSelected event handler to handle multiple selections
dispatcher.on("faceSelected", (studentIds) => {
    // Change selected category to chernoff_face_attributes
    console.log(studentIds)

    // Update scatterplot to highlight the selected student ids (now supports multiple)
    view2.setHighlighted(studentIds);
});
// Scatterplot: can only select a single student
dispatcher.on("scatterDotSelected", (studentId) => {
    // Clear any existing highlighting in View2 first
    if (studentId) {
        // Set highlighting to just this student in View2
        view2.setHighlighted([parseInt(studentId)]);
        // Update chernoff to highlight just the face containing this student
        chernoff.updateVis(studentId);
    } else {
        // If deselected (null), clear all highlighting
        view2.removeHighlight();
        chernoff.updateVis([]);
    }
});