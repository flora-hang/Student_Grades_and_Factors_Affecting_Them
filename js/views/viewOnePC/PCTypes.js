
export class NodeLayout {
	constructor(value, y, height) {
		this.value = value; // categoriy represented by this node
		this.y = y; // top y position
		this.height = height; // height of the node
	}
}

export class AxisLayout {
	constructor(attr, x, nodes) {
		this.attr = attr; // attribute represented by this axis
		this.x = x; // x position of the axis
		this.nodes = nodes; // a list of NodeLayout, top to bottom
	}
}

export class RibbonData {
	constructor(leftAttr, rightAttr, leftValue, rightValue,
		leftX, rightX, leftY1, leftY2, rightY1, rightY2, color, pathKey = null) {
		this.leftAttr = leftAttr; // attribute on the left axis of the ribbon
		this.rightAttr = rightAttr; // - on the right -
		this.leftValue = leftValue; // value of the node on the left axis of the ribbon
		this.rightValue = rightValue; // - on the right -
		this.leftX = leftX; // x position of left axis
		this.rightX = rightX; // - right -
		this.leftY1 = leftY1; // top y of ribbon on left end
		this.leftY2 = leftY2; // bottom y - left
		this.rightY1 = rightY1; // top y - rgiht
		this.rightY2 = rightY2; // bottom y - right
		this.color = color; // ribbon color
		this._pathKey = pathKey; // full path key encoding all axes from 0 to rightAttr
	}

	// unique key identifying this ribbon (includes full left-to-right path for AND logic)
	get key() {
		return this._pathKey ?? `${this.leftAttr}:${this.leftValue}||${this.rightAttr}:${this.rightValue}`;
	}
}
