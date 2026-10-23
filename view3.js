class ChernoffFaces {

    /**
     * @param {Object}
     * @param {Array}
     */

    constructor(_config, selectedStudentIds, dispatcher) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: 0, // computed at initVis() from actual element
            containerHeight: 300,
            margin: { top: 20, right: 20, bottom: 20, left: 30 },
            chernoffRowGap: 15,
            chernoffFacePadding: 10,
        };
        this.data = [];
        this.selectedStudentIds = selectedStudentIds || []; // Initialize as array
        this.dispatcher = dispatcher;
    }

    async readData() {
        try {
            const data = await d3.csv('data/student-por-processed.csv');
            data.forEach(d => {
                d.romantic = d.romantic === 'yes' ? 1 : 0;
            });
            this.data = data;
        } catch (err) {
            console.log('There was an error loading View 3', err);
        }
    }

    /**
     * Initialize static elements
     */
    async initVis() {
        // Read data
        await this.readData();

        let vis = this;

        // Measure the actual rendered container width so the chart fills its flex panel
        const containerEl = document.querySelector(vis.config.parentElement);
        const measuredWidth = containerEl ? containerEl.getBoundingClientRect().width : (window.innerWidth - 30) / 2;
        vis.config.containerWidth = Math.max(measuredWidth || 300, 300);

        // Calculate width and height with margins
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Define Chernoff SVG drawing area — viewBox lets CSS scale it proportionally
        vis.svg = d3.select(vis.config.parentElement).append('svg')
            .attr('viewBox', `0 0 ${vis.config.containerWidth} ${vis.config.containerHeight}`)
            .style('width', '100%')
            .style('height', 'auto')
            .attr('id', 'view3-container');

        // Append group element that will contain all our chernoff faces
        vis.chernoffContainer = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`)
            .attr('id', 'chernoff-container');

        // Chernoff rows
        vis.config.chernoffRowHeight = (vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom) / 2;
        vis.updateVis(null);

        // Draw the legend
        drawView3Legend();
    }

    /**
     * UpdateVis Helpers
     */

    // Compute & assign grade quantiles
    assignQuantiles(students) {
        const grades = students.map(d => d.final_grade).sort(d3.ascending);

        const q1 = d3.quantile(grades, 0.25);
        const q2 = d3.quantile(grades, 0.50);
        const q3 = d3.quantile(grades, 0.75);
        const q4 = d3.quantile(grades, 1);

        students.forEach(s => {
            if (s.final_grade <= q1) {
                s.quantile = 'Q1';
            } else if (s.final_grade <= q2) {
                s.quantile = 'Q2';
            } else if (s.final_grade <= q3) {
                s.quantile = 'Q3';
            } else if (s.final_grade <= q4) {
                s.quantile = 'Q4';
            }
        });
    }

    /**
     * Prepare the data: group the female and male students and get the quantiles for each
     */
    updateVis(selected_student_id) {
        let vis = this;

        // Update selectedStudentIds based on input
        if (selected_student_id !== null && selected_student_id !== undefined) {
            if (Array.isArray(selected_student_id)) {
                vis.selectedStudentIds = selected_student_id.map(id => parseInt(id));
            } else {
                vis.selectedStudentIds = [parseInt(selected_student_id)];
            }
        }

        // Group students by Sex
        const groupBySex = d3.group(vis.data, d => d.sex);

        // Compute grade quantiles per sex and assign each student a quantile
        groupBySex.forEach(vis.assignQuantiles);

        // Aggregate chosen attributes for each group
        vis.studentsWithQuantiles = Array.from(groupBySex.values()).flat();

        // Store students by group for romantic percentage calculation
        vis.studentsByGroup = {};

        vis.studentsWithQuantiles.forEach(student => {
            const key = `${student.sex}-${student.quantile}`;
            if (!vis.studentsByGroup[key]) {
                vis.studentsByGroup[key] = [];
            }
            vis.studentsByGroup[key].push(student);
        });

        vis.aggregatedQuantiles = d3.rollups(vis.studentsWithQuantiles,
            s => ({
                Medu: Math.round(d3.mean(s, d => d.Medu)),
                studytime: Math.round(d3.mean(s, d => d.studytime)),
                romantic: d3.mean(s, d => d.romantic) > 0.5,
                Dalc: d3.mean(s, d => d.Dalc),
                failures: d3.mean(s, d => d.failures),
            }),
            d => d.sex,
            d => d.quantile
        );
        vis.chernoffData = vis.aggregatedQuantiles.map(([sex, quantiles]) => ({
            sex,
            values: quantiles.map(([quantile, values]) => {
                const key = `${sex}-${quantile}`;

                return {
                    quantile,
                    sex,
                    ...values,
                    students: vis.studentsByGroup[key] || [] // students with this quantile and sex
                };
            })
        }));

        // Sort quantiles in order
        vis.chernoffData.forEach(group => group.values.sort((a, b) => +a.quantile.slice(1) - +b.quantile.slice(1)));

        // Create scales for attributes

        // Final Grade (G3) Quantile scale; Face placement by quantile
        vis.quantileScale = d3.scaleLinear()
            .domain([1, 4])
            .range([0, vis.width - (vis.width / 4)]);

        // Define face dimensions
        vis.chernoffFaceHeight = vis.config.chernoffRowHeight - vis.config.chernoffFacePadding;
        vis.faceWidth = vis.width / 4;
        vis.headHeight = vis.chernoffFaceHeight / 3;
        vis.bodyHeight = vis.chernoffFaceHeight * 2 / 3;
        vis.headRadius = vis.headHeight / 1.3;
        vis.headDiameter = 2 * vis.headRadius;

        // SCALES
        // Weekday alcohol content scale
        const allDalc = [];
        vis.chernoffData.forEach(d => d.values.forEach(v => allDalc.push(v.Dalc)));
        vis.DalcScale = d3.scaleLinear()
            .domain(d3.extent(allDalc))
            .range(["#ffe6e6", "#ff4d6d"]);

        // Number of failures scale
        const allFailures = [];
        vis.chernoffData.forEach(d => d.values.forEach(v => allFailures.push(v.failures)));
        vis.failuresScale = d3.scaleLinear()
            .domain(d3.extent(allFailures))
            .range([vis.headRadius / 2, -vis.headRadius / 2]);

        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        // Clear existing content
        vis.chernoffContainer.selectAll('.chernoff-row').remove();
        vis.chernoffContainer.selectAll('.quartile-labels').remove();

        // Level 1: Rows (Sex: Female or Male)
        const chernoffRows = vis.chernoffContainer.selectAll('.chernoff-row')
            .data(vis.chernoffData, d => d.sex)
            .enter()
            .append('g')
            .attr('class', d => `chernoff-row ${d.sex === 'F' ? 'female' : 'male'}`)
            .attr('transform', d => d.sex === 'M' ? `translate(0, ${vis.config.chernoffRowHeight + vis.config.chernoffRowGap})` : null)
            .attr('height', vis.config.chernoffRowHeight)
            .attr('width', vis.width);

        const quartileLabels = [
            { q: 1, label: "Bottom 25%" },
            { q: 2, label: "Lower-Middle 25%" },
            { q: 3, label: "Upper-Middle 25%" },
            { q: 4, label: "Top 25%" }
        ];

        // Quartile Labels
        vis.chernoffContainer.append("g")
            .attr("class", "quartile-labels")
            .selectAll("text")
            .data(quartileLabels)
            .enter()
            .append("text")
            .attr("x", d => vis.quantileScale(d.q) + vis.faceWidth / 2)
            .attr("y", -8)   // slightly above faces
            .attr("text-anchor", "middle")
            .attr("font-size", "15px")
            .attr("font-weight", "bold")
            .text(d => d.label);

        // Level 2: Chernoff face containers
        const chernoffFaces = chernoffRows.selectAll('.chernoff-face')
            .data(d => d.values, d => d.quantile)
            .enter()
            .append('g')
            .attr('class', d => `chernoff-face ${d.quantile}`)
            .attr('transform', d => `translate(${vis.quantileScale(+d.quantile.slice(1))}, ${vis.config.chernoffFacePadding + 10 / 2})`)
            .attr('height', vis.chernoffFaceHeight);

        /// HEAD
        const headContainer = chernoffFaces.append('g')
            .attr('class', 'head-container')
            .attr('transform', `translate(${vis.faceWidth / 2}, ${vis.headHeight / 2})`);

        // Hair
        const hair = headContainer.append('rect')
            .attr('class', 'hair')
            .attr('x', -vis.headRadius)
            .attr('y', -vis.headRadius - 2)
            .attr('width', vis.headDiameter)
            .attr('height', d => d.sex === 'F' ? vis.headDiameter + 10 : vis.headRadius * 0.6)
            .attr('fill', '#5a3b1e')
            .attr('rx', '10');

        // Head shape
        const headShape = headContainer.append('circle')
            .attr('class', 'head-shape')
            .attr('r', vis.headRadius)
            .attr('fill', 'yellow')
            .attr('stroke', 'black');

        // Eyes
        const eyesContainer = headContainer.append('g')
            .attr('class', 'eyes-container')
            .attr('transform', `translate(0, ${-vis.headRadius / 2.5})`);

        const leftEyes = eyesContainer.append('circle')
            .attr('class', 'eye left')
            .attr('r', 3)
            .attr('cx', -vis.headRadius / 3)
            .attr('cy', 0)
            .attr('fill', 'black')
            .attr('stroke', 'black');

        const rightEyes = eyesContainer.append('circle')
            .attr('class', 'eye right')
            .attr('r', 3)
            .attr('cx', vis.headRadius / 3)
            .attr('cy', 0)
            .attr('fill', 'black')
            .attr('stroke', 'black');

        // Blush
        const blushContainer = headContainer.append('g')
            .attr('class', 'blush-container')
            .attr('transform', `translate(0, ${vis.headRadius / 15})`);

        const leftBlush = blushContainer.append('circle')
            .attr('cx', -vis.headRadius / 2)
            .attr('cy', 0)
            .attr('r', vis.headRadius / 4)
            .attr('fill', d => vis.DalcScale(d.Dalc))
            .attr('fill-opacity', 0.8);

        const rightBlush = blushContainer.append('circle')
            .attr('cx', vis.headRadius / 2)
            .attr('cy', 0)
            .attr('r', vis.headRadius / 4)
            .attr('fill', d => vis.DalcScale(d.Dalc))
            .attr('fill-opacity', 0.8);

        // Mouth
        const mouth = headContainer.append('path')
            .attr('transform', `translate(0, ${vis.headRadius / 2})`)
            .attr('d', d => {
                const width = vis.headRadius;
                const curve = vis.failuresScale(d.failures);

                const leftX = -width / 2;
                const rightX = width / 2;

                const controlX = 0;
                const controlY = curve;

                return `M ${leftX} 0 Q ${controlX} ${controlY} ${rightX} 0`;
            })
            .attr('fill', 'none')
            .attr('stroke', 'black')
            .attr('class', 'mouth');

        /// BODY 
        const bodyContainer = chernoffFaces.append('g')
            .attr('class', 'body-container')
            .attr('transform', `translate(${vis.faceWidth / 2}, ${vis.headHeight + vis.bodyHeight / 2})`);

        // Get the mode of mother's education for coloring
        function getMeduColor(d) {
            const sex = d.sex;
            const quantile = d.quantile;
            const key = `${sex}-${quantile}`;
            const groupStudents = vis.studentsByGroup[key] || [];

            // Calculate mode of mother's education
            if (groupStudents.length === 0) return '#cccccc';

            const eduCounts = {};
            groupStudents.forEach(student => {
                const edu = student.Medu;
                eduCounts[edu] = (eduCounts[edu] || 0) + 1;
            });

            let mode = null;
            let maxCount = 0;
            for (const [edu, count] of Object.entries(eduCounts)) {
                if (count > maxCount) {
                    maxCount = count;
                    mode = parseInt(edu);
                }
            }

            // Return color based on education level
            const colors = {
                0: '#E8E8E8',  // None - Light grey
                1: '#FFB6C1',  // Primary (4th grade) - Light pink
                2: '#FFD700',  // 5-9th Grade - Gold
                3: '#98FB98',  // Secondary - Pale green
                4: '#87CEEB'   // College - Sky blue
            };

            return colors[mode] || '#cccccc';
        }

        // T-shirt shape with color based on mother's education
        bodyContainer.append('path')
            .attr('d', d => {
                const shirtWidth = vis.faceWidth / 2.5;
                const shirtHeight = vis.bodyHeight / 1.8;
                const neckWidth = vis.faceWidth / 5;
                const neckHeight = vis.bodyHeight / 10;

                return `M${-shirtWidth / 2},${-shirtHeight / 2 + neckHeight}
                        L${-neckWidth / 2},${-shirtHeight / 2}
                        L${neckWidth / 2},${-shirtHeight / 2}
                        L${shirtWidth / 2},${-shirtHeight / 2 + neckHeight}
                        L${shirtWidth / 2},${-shirtHeight / 2 + neckHeight + 15}
                        L${neckWidth / 2 + 9},${-shirtHeight / 2 + 17}
                        L${shirtWidth / 2 - 10},${shirtHeight / 2 + 1}
                        L${-shirtWidth / 2 + 10},${shirtHeight / 2}
                        L${-neckWidth / 2 - 9},${-shirtHeight / 2 + 17}
                        L${-shirtWidth / 2},${-shirtHeight / 2 + neckHeight + 15}
                        Z`;
            })
            .attr('fill', d => getMeduColor(d))
            .attr('stroke', 'black')
            .attr('stroke-width', 1);

        // T-shirt label to represent mother's education level
        bodyContainer.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '12px')
            .attr('font-weight', 'bold')
            .attr('fill', 'black')
            .text(function (d) {
                const sex = d.sex;
                const quantile = d.quantile;
                const key = `${sex}-${quantile}`;
                const groupStudents = vis.studentsByGroup[key] || [];

                if (groupStudents.length === 0) return '';

                const eduCounts = {};
                groupStudents.forEach(student => {
                    const edu = student.Medu;
                    eduCounts[edu] = (eduCounts[edu] || 0) + 1;
                });

                let mode = null;
                let maxCount = 0;
                for (const [edu, count] of Object.entries(eduCounts)) {
                    if (count > maxCount) {
                        maxCount = count;
                        mode = parseInt(edu);
                    }
                }

                if (mode === 4) return 'COLLEGE';
                else if (mode === 3) return 'SECONDARY';
                else if (mode === 2) return '5-9th';
                else if (mode === 1) return 'PRIMARY';
                else if (mode === 0) return 'NONE';
                else return '';
            });

        // "mom" text label
        bodyContainer.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .attr('fill', 'black')
            .attr('y', 12)
            .text('Mom');

        /// ARMS - showing study time with books (exact number of arms = average study time)
        chernoffFaces.each(function (d) {
            const faceGroup = d3.select(this);
            const bodyY = vis.headHeight + vis.bodyHeight / 2;
            const centerX = vis.faceWidth / 2;

            // Calculate MODE of study time for this specific group
            const sex = d.sex;
            const quantile = d.quantile;
            const key = `${sex}-${quantile}`;
            const groupStudents = vis.studentsByGroup[key] || [];

            let numArms = 0; // Default value

            if (groupStudents.length > 0) {
                // Count frequencies of each study time level (1-5)
                const studyCounts = {};
                groupStudents.forEach(student => {
                    const studyTime = student.studytime;
                    studyCounts[studyTime] = (studyCounts[studyTime] || 0) + 1;
                });

                // Find the mode (most frequent value)
                let mode = 1; // Default to 1 if no data
                let maxCount = 0;
                for (const [studyTime, count] of Object.entries(studyCounts)) {
                    if (count > maxCount) {
                        maxCount = count;
                        mode = parseInt(studyTime);
                    }
                }

                numArms = mode;
            }

            // Position arms on left and right sides
            for (let i = 0; i < numArms; i++) {
                // Alternate arms between left and right
                const side = i % 2 === 0 ? 'left' : 'right';
                const armIndex = Math.floor(i / 2); // Which arm on this side (0 = top, 1 = bottom)

                // Calculate arm position
                let armX, armY;
                const armLength = 25;
                const armSpacing = 15; // Vertical spacing between arms on same side

                if (side === 'left') {
                    armX = centerX - vis.faceWidth / 4 + 10;
                    armY = bodyY + armIndex * armSpacing - 10;
                } else {
                    armX = centerX + vis.faceWidth / 4 - 10;
                    armY = bodyY + armIndex * armSpacing - 10;
                }

                // Draw arm (simple line)
                faceGroup.append('line')
                    .attr('x1', armX)
                    .attr('y1', armY)
                    .attr('x2', side === 'left' ? armX - armLength : armX + armLength)
                    .attr('y2', armY - 5)
                    .attr('stroke', 'black')
                    .attr('stroke-width', 3);

                // Add book at end of arm
                const bookX = side === 'left' ? armX - armLength - 5 : armX + armLength + 25;
                const bookY = armY - 20;

                // Draw book (small rectangle)
                faceGroup.append("image")
                    .attr("href", "/data/book.jpg")
                    .attr('x', bookX - 25)
                    .attr('y', bookY - 15)
                    .attr('width', 30)
                    .attr('height', 50);

                // Add book pages (small line)
                faceGroup.append('line')
                    .attr('x1', bookX + 2)
                    .attr('y1', bookY - 3)
                    .attr('x2', bookX + 2)
                    .attr('y2', bookY + 12)
                    .attr('stroke', 'white')
                    .attr('stroke-width', 1);
            }
        });

        /// ROMANTIC STATUS - heart with percentage fill
        chernoffFaces.each(function (d) {
            const faceGroup = d3.select(this);
            const centerX = vis.faceWidth / 2;

            // Get sex from parent data (the row)
            const sex = d3.select(this.parentNode).datum().sex;
            const quantile = d.quantile;

            // Get students for this specific group from stored data
            const key = `${sex}-${quantile}`;
            const groupStudents = vis.studentsByGroup[key] || [];

            const romanticCount = groupStudents.filter(student => student.romantic === 1).length;
            const totalCount = groupStudents.length;
            const romanticPercentage = totalCount > 0 ? Math.round((romanticCount / totalCount) * 100) : 0;

            // Position heart below the body
            const heartX = centerX;
            const heartY = vis.headHeight + vis.bodyHeight - 10;

            // Draw heart shape
            const heartGroup = faceGroup.append('g')
                .attr('transform', `translate(${heartX}, ${heartY})`);

            // Define heart path
            const heartPath = 'M0,-10 C-5,-15 -15,-10 -15,-5 C-15,0 -10,5 0,10 C10,5 15,0 15,-5 C15,-10 5,-15 0,-10Z';

            // Create clip path for percentage fill
            const clipId = `heart-clip-${sex}-${quantile}-${Date.now()}-${Math.random()}`;

            // Add clip path definition
            heartGroup.append('defs')
                .append('clipPath')
                .attr('id', clipId)
                .append('path')
                .attr('d', heartPath);

            // Calculate fill height based on percentage (from bottom)
            // The heart's bounding box is roughly from y=-15 to y=10 (height 25)
            const heartMinY = -15;
            const heartMaxY = 10;
            const heartHeight = heartMaxY - heartMinY;

            // Calculate fill amount from bottom (percentage of total height)
            const fillAmount = (romanticPercentage / 100) * heartHeight;
            const fillY = heartMaxY - fillAmount;

            // Draw filled portion (colored area)
            heartGroup.append('rect')
                .attr('x', -15)
                .attr('y', fillY)
                .attr('width', 30)
                .attr('height', fillAmount)
                .attr('fill', 'red')
                .attr('clip-path', `url(#${clipId})`);

            // Draw heart outline (to ensure heart shape is visible)
            heartGroup.append('path')
                .attr('d', heartPath)
                .attr('fill', 'none')
                .attr('stroke', 'darkred')
                .attr('stroke-width', 1.5);

            // Optional: Add percentage text inside heart (still useful for exact value)
            heartGroup.append('text')
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '8px')
                .attr('font-weight', 'bold')
                .attr('fill', 'black')
                .attr('stroke', 'none')
                .text(romanticPercentage + '%');
        });

        // Touch area - with click handler for multi-selection
        chernoffFaces.each(function (d) {
            const thisFace = d3.select(this);
            thisFace.append('rect')
                .attr('class', 'faceTouchArea')
                .attr('width', vis.faceWidth)
                .attr('height', vis.chernoffFaceHeight + 15)
                .attr('transform', `translate(0, -15)`)
                .attr('fill', 'transparent')
                .style('pointer-events', 'all')
                .on('click', function (event, d) {
                    event.stopPropagation();
                    const clickedFace = d3.select(this);

                    // Toggle selection: if face is selected, deselect it; otherwise add to selection
                    if (clickedFace.classed('selectedFace')) {
                        // Deselect this face
                        clickedFace.classed('selectedFace', false);
                        // Remove this face's students from the selected set
                        const faceStudentIds = d.students.map(s => parseInt(s.id));
                        vis.selectedStudentIds = vis.selectedStudentIds.filter(id => !faceStudentIds.includes(id));
                    } else {
                        // Add this face's students to selection
                        clickedFace.classed('selectedFace', true);
                        const faceStudentIds = d.students.map(s => parseInt(s.id));
                        // Merge without duplicates
                        const newIds = [...vis.selectedStudentIds];
                        faceStudentIds.forEach(id => {
                            if (!newIds.includes(id)) newIds.push(id);
                        });
                        vis.selectedStudentIds = newIds;
                    }

                    // Dispatch the updated selection
                    vis.dispatcher.call('faceSelected', null, vis.selectedStudentIds);
                });
        });

        // Apply highlighting based on current selectedStudentIds
        if (vis.selectedStudentIds && vis.selectedStudentIds.length > 0) {
            d3.selectAll('.faceTouchArea').each(function (d) {
                const hasSelectedStudent = d.students.some(s => vis.selectedStudentIds.includes(parseInt(s.id)));
                d3.select(this).classed('selectedFace', hasSelectedStudent);
            });
        }
    }
}

function drawView3Legend() {
    const legendWidth = (window.innerWidth - 110) / 2;
    const legendHeight = 120;
    const fontSize = '10px';

    const legendSvg = d3.select("#view3-legend")
        .append("svg")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .append("g")
        .attr("transform", "translate(0, 0)");

    const sections = 6; // total legend sections
    const innerPadding = 20; // left/right padding inside legend
    const gap = 15;
    const sectionWidth = (legendWidth - innerPadding * 2) / sections + gap;
    let sectionIndex = 0;

    // Background
    legendSvg.append("rect")
        .attr('class', 'chernoff-legend')
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .attr('rx', 4)
        .attr('ry', 4)
        .attr('fill', '#f9f9f9')
        .attr('stroke', '#ddd')
        .attr('stroke-width', 1)
        .attr("fill-opacity", 0.9);

    // ------------------ 1. GENDER ------------------

    let g = legendSvg.append("g")
        .attr("transform", `translate(${innerPadding + sectionIndex * sectionWidth}, 20)`);

    g.append("text").text("Gender").attr("font-size", fontSize).attr("font-weight", "bold");

    // Female head (with longer hair)
    const femaleHeadGroup = g.append("g").attr("transform", "translate(15, 35)");

    // Hair (longer for female)
    femaleHeadGroup.append("rect")
        .attr("x", -12)
        .attr("y", -16)
        .attr("width", 24)
        .attr("height", 28)
        .attr("fill", "#5a3b1e")
        .attr("rx", "5");

    // Head shape
    femaleHeadGroup.append("circle")
        .attr("r", 12)
        .attr("cy", -2)
        .attr("fill", "yellow")
        .attr("stroke", "black");

    // Eyes
    femaleHeadGroup.append("circle").attr("r", 2).attr("cx", -5).attr("cy", -5).attr("fill", "black");
    femaleHeadGroup.append("circle").attr("r", 2).attr("cx", 5).attr("cy", -5).attr("fill", "black");

    // Mouth (smile)
    femaleHeadGroup.append("path")
        .attr("d", "M-4,2 Q0,6 4,2")
        .attr("fill", "none")
        .attr("stroke", "black");

    g.append("text").attr("x", 40).attr("y", 38).text("Female").attr("font-size", 10);

    // Male head (shorter hair)
    const maleHeadGroup = g.append("g").attr("transform", "translate(15, 62)");

    // Hair (shorter for male)
    maleHeadGroup.append("rect")
        .attr("x", -12)
        .attr("y", -14)
        .attr("width", 24)
        .attr("height", 10)
        .attr("fill", "#5a3b1e")
        .attr("rx", "5");

    // Head shape
    maleHeadGroup.append("circle")
        .attr("r", 12)
        .attr("fill", "lightblue")
        .attr("stroke", "black");

    // Eyes
    maleHeadGroup.append("circle").attr("r", 2).attr("cx", -5).attr("cy", -3).attr("fill", "black");
    maleHeadGroup.append("circle").attr("r", 2).attr("cx", 5).attr("cy", -3).attr("fill", "black");

    // Mouth (neutral)
    maleHeadGroup.append("line")
        .attr("x1", -4)
        .attr("y1", 2)
        .attr("x2", 4)
        .attr("y2", 2)
        .attr("stroke", "black");

    g.append("text").attr("x", 40).attr("y", 67).text("Male").attr("font-size", 10);

    // ------------------ 2. FAILURES (CONTINUOUS MOUTH) ------------------
    sectionIndex++;

    g = legendSvg.append("g")
        .attr("transform", `translate(${innerPadding + sectionIndex * sectionWidth - 20}, 20)`);

    g.append("text")
        .text("Failures (Mouth)")
        .attr("font-size", fontSize)
        .attr("font-weight", "bold");

    // Draw multiple curves to show smooth transition
    const steps = d3.range(-1, 1.01, 0.5); // normalized

    steps.forEach((t, i) => {
        const y = 20 + i * 12;
        const curve = t * 10; // mimic your scale range visually

        g.append("path")
            .attr("d", `M0,${y} Q15,${y + curve} 30,${y}`)
            .attr("stroke", "black")
            .attr("fill", "none");
    });

    // Labels
    g.append("text")
        .attr("x", 40)
        .attr("y", 25)
        .attr("font-size", fontSize)
        .text("4 Failures");

    g.append("text")
        .attr("x", 40)
        .attr("y", 70)
        .attr("font-size", fontSize)
        .text("No failures");

    // ------------------ 3. ALCOHOL (COLOR SCALE) ------------------

    sectionIndex++;

    g = legendSvg.append("g")
        .attr("transform", `translate(${innerPadding + sectionIndex * sectionWidth - 20}, 20)`);

    g.append("text")
        .text("Alcohol (Blush)")
        .attr("font-size", fontSize)
        .attr("font-weight", "bold");

    // Define gradient
    const gradientId = "alcohol-gradient";

    const defs = legendSvg.append("defs");

    const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("x2", "100%");

    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#ffe6e6");

    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#ff4d6d");

    // Draw gradient bar
    g.append("rect")
        .attr("x", 0)
        .attr("y", 10)
        .attr("width", 80)
        .attr("height", 10)
        .attr("fill", `url(#${gradientId})`);

    // Labels
    g.append("text")
        .attr("x", 0)
        .attr("y", 40)
        .attr("font-size", fontSize)
        .text("Very Low");

    g.append("text")
        .attr("x", 60)
        .attr("y", 40)
        .attr("font-size", fontSize)
        .text("Very High");

    // ------------------ 4. MOTHER EDUCATION (COLOR-CODED) ------------------

    sectionIndex++;

    g = legendSvg.append("g")
        .attr("transform", `translate(${innerPadding + sectionIndex * sectionWidth - 10}, 20)`);

    g.append("text")
        .text("Mother's Education")
        .attr("font-size", fontSize)
        .attr("font-weight", "bold");

    // Define education levels and their colors
    const eduLevels = [
        { level: 0, label: "NONE", color: "#E8E8E8" },
        { level: 1, label: "PRIMARY (4th grade)", color: "#FFB6C1" },
        { level: 2, label: "5-9th Grade", color: "#FFD700" },
        { level: 3, label: "SECONDARY", color: "#98FB98" },
        { level: 4, label: "COLLEGE", color: "#87CEEB" }
    ];

    // Draw color swatches and labels
    eduLevels.forEach((edu, i) => {
        const yPos = 10 + i * 18;

        // Color swatch
        g.append("rect")
            .attr("x", 0)
            .attr("y", yPos)
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", edu.color)
            .attr("stroke", "black")
            .attr("stroke-width", 0.5);

        // Label
        g.append("text")
            .attr("x", 18)
            .attr("y", yPos + 10)
            .attr("font-size", fontSize)
            .text(edu.label);
    });

    // Add note about mode
    g.append("text")
        .attr("x", 0)
        .attr("y", 20 + eduLevels.length * 18 + 10)
        .attr("font-size", fontSize)
        .attr("fill", "#666")
        .text("*Shows most common education level");

    // ------------------ 5. STUDY TIME (BOOKS) ------------------

    sectionIndex++;

    g = legendSvg.append("g")
        .attr("transform", `translate(${innerPadding + sectionIndex * sectionWidth}, 20)`);

    g.append("text").text("Study Time").attr("font-size", fontSize).attr("font-weight", "bold");

    const studyLevels = [
        { value: 1, label: "<2 hrs" },
        { value: 2, label: "2-5 hrs" },
        { value: 3, label: "5-10 hrs" },
        { value: 4, label: ">10 hrs" }
    ];

    for (let i = 1; i <= 4; i++) {
        const y = i * 12;
        for (let j = 0; j < i; j++) {
            g.append("image")
                .attr("href", "/data/book.jpg")
                .attr("x", j * 12)
                .attr("y", i * 12)
                .attr("width", 10)
                .attr("height", 10);
        }
        g.append("text")
            .attr("x", 50)
            .attr("y", y + 7)
            .attr("font-size", fontSize)
            .text(`${studyLevels[i - 1].label}`);
    }

    // ------------------ 6. ROMANTIC ------------------

    sectionIndex++;

    g = legendSvg.append("g")
        .attr("transform", `translate(${innerPadding + sectionIndex * sectionWidth - 20}, 20)`);

    g.append("text").text("Romantic %").attr("font-size", fontSize).attr("font-weight", "bold");

    const heart = g.append("g").attr("transform", "translate(15,30)");

    heart.append("path")
        .attr("d", "M0,-10 C-5,-15 -15,-10 -15,-5 C-15,0 -10,5 0,10 C10,5 15,0 15,-5 C15,-10 5,-15 0,-10Z")
        .attr("fill", "red");

    heart.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "3")
        .attr("font-size", fontSize)
        .attr("fill", "white")
        .text("%");
}