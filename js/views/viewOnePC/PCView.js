import PCDataProcessor from './PCDataProcessor.js';
import PCAxisManager from './PCAxisManager.js';
import { PCNodeRenderer } from './PCNodeRenderer.js';
import PCLegend from './PCLegend.js';
import PCRibbonRenderer from './PCRibbonRenderer.js';
import PCTooltip from './interaction/PCTooltip.js';
import PCBackgroundClickHandler from './interaction/PCBackgroundClickHandler.js';
import PCNodeSelectionManager from './interaction/PCNodeSelectionManager.js';
import PCOverlayRenderer from './interaction/PCOverlayRenderer.js';
import PCSamplePathRenderer from './interaction/PCSamplePathRenderer.js';
import PCNodeHoverManager from './interaction/PCNodeHoverManager.js';
import PCNodeClickManager from './interaction/PCNodeClickManager.js';
import PCRibbonHoverManager from './interaction/PCRibbonHoverManager.js';
import PCRibbonClickManager from './interaction/PCRibbonClickManager.js';

const DEFAULT_ATTRS = ['studytime', 'failures', 'absences_levels', 'schoolsup', 'paid'];
const FINAL_ATTR = 'final_grade_levels';

export default class PCView {
	constructor(containerSelector = '#pc-view', attrs = DEFAULT_ATTRS) {
		this.containerSelector = containerSelector;
		this.displayAttrs = this._buildAttrs(attrs);
	}

	_buildAttrs(attrs) {
		return [...attrs.slice(0, 5).map(a => a === "absences" ? "absences_levels" : a), FINAL_ATTR];
	}

	async init() {
		const data = await d3.csv('data/student-por-processed.csv');
		this.dataProcessor = new PCDataProcessor(data);

		// Design width matches what PCAxisManager uses for its internal coordinate system.
		// Using viewBox + CSS width lets the SVG scale to any viewport without re-computing
		// axis positions.
		const viewportWidth = window.innerWidth - 30 - 160;

		const svg = d3.select(this.containerSelector)
			.append('svg')
			.attr('viewBox', `0 0 ${viewportWidth} 550`)
			.style('width', 'calc(100% - 150px)')
			.style('height', 'auto')
			.style('margin-left', '150px');

		this.axisManager = new PCAxisManager(svg);
		this.legend = new PCLegend(svg);
		this.nodeRenderer = new PCNodeRenderer(svg, this.axisManager);
		this.ribbonRenderer = new PCRibbonRenderer(svg, this.axisManager, this.dataProcessor);

		this.render();

		const tooltip = new PCTooltip();
		const bgClick = new PCBackgroundClickHandler(svg);
		const selMgr = new PCNodeSelectionManager((selection) => {
			console.log(selection);
			this.nodeRenderer.update(selMgr.getSelection());
		});
		const overlayRenderer = new PCOverlayRenderer(this.ribbonRenderer);
		const samplePath = new PCSamplePathRenderer(svg, this.axisManager);
		const nodeHover = new PCNodeHoverManager(overlayRenderer, this.ribbonRenderer);
		const nodeClick = new PCNodeClickManager(selMgr, overlayRenderer, nodeHover);
		const ribbonHover = new PCRibbonHoverManager(overlayRenderer, tooltip, this.dataProcessor);
		const ribbonClick = new PCRibbonClickManager(overlayRenderer);

		bgClick.register(() => selMgr.clear());
		bgClick.register(() => overlayRenderer.unfreeze());
		bgClick.register(() => samplePath.clear());

		this._nodeClick = nodeClick;
		this._nodeHover = nodeHover;
		this._selMgr = selMgr;
		this._ribbonHover = ribbonHover;
		this._ribbonClick = ribbonClick;

		this.nodeRenderer.attachInteractionHandlers(nodeClick, nodeHover, () => selMgr.getSelection());
		this.ribbonRenderer.attachInteractionHandlers(ribbonHover, ribbonClick);
	}

	update(attrs) {
		this.displayAttrs = this._buildAttrs(attrs);
		this.render();
		this.nodeRenderer.attachInteractionHandlers(this._nodeClick, this._nodeHover, () => this._selMgr.getSelection());
		this.ribbonRenderer.attachInteractionHandlers(this._ribbonHover, this._ribbonClick);
	}

	render() {
		const freqMap = new Map();
		for (const attr of this.displayAttrs) {
			freqMap.set(attr, this.dataProcessor.computeNodeFrequencies(attr));
		}

		this.axisManager.init(this.displayAttrs, freqMap);
		if (!this._legendInitialized) {
			this.legend.init(this.axisManager.axisLayouts);
			this._legendInitialized = true;
		} else {
			this.legend.update(this.axisManager.axisLayouts);
		}
		this.nodeRenderer.init();
		this.ribbonRenderer.init(this.nodeRenderer.colorScales);
	}
}
