import { colorMap, controls, LINE_WIDTH } from "../data/constants.js";
import {
    ascendancyAddLeftovers,
    ascendancyAddPreview,
    ascendancyNodes,
    ascendancyRemovePreview,
    ascendancySelections,
    excludedAscendancyNodes,
    excludedTalentNodes,
    talentAddLeftovers,
    talentAddPreview,
    talentNodes,
    talentRemovePreview,
    talentSelections,
    TOTAL_ASCENDANCY_POINTS,
    TOTAL_POINTS,
} from "../type/talent-node.js";

/**
 * @typedef {HTMLCanvasElement} CustomLineCanvas
 * @property {HTMLCanvasElement} offscreenCanvas
 */
/** @type {CustomLineCanvas} */
export let lineCanvas = undefined;
/** @type {CanvasRenderingContext2D} */
let lineCanvasContext = undefined;
export const updateLineCanvas = (element) => {
    lineCanvas = element;
    lineCanvasContext = lineCanvas.getContext("2d", { alpha: false });
    lineCanvasContext.imageSmoothingEnabled = false;
};

/**
 * @typedef {HTMLCanvasElement} CustomAscendancyCanvas
 * @property {Map<string, HTMLCanvasElement>} offscreenCanvasMap
 */
/** @type {CustomAscendancyCanvas} */
export let ascendancyCanvas = undefined;
/** @type {CanvasRenderingContext2D} */
let ascendancyCanvasContext = undefined;
export const updateAscendancyCanvas = (element) => {
    ascendancyCanvas = element;
    ascendancyCanvasContext = ascendancyCanvas.getContext("2d", { alpha: false });
    ascendancyCanvasContext.imageSmoothingEnabled = false;
};

/**
 * @param {CanvasRenderingContext2D} context
 * @param {TalentNode[]} collection
 * @param {TalentNode[]} excluded
 */
export const drawLinesSimple = (context, collection, excluded = []) => {
    context.beginPath();
    for (const leaf of collection) {
        for (const neighbor of leaf.neighbors) {
            if (excluded.some(item => item.identifier.number === neighbor.identifier.number)) {
                continue;
            }

            context.moveTo(leaf.center.x, leaf.center.y);
            context.lineTo(neighbor.center.x, neighbor.center.y);
        }
    }
    context.closePath();
    context.stroke();
};

/**
 * @param {CanvasRenderingContext2D} context
 * @param {TalentNode[]} collection
 */
const drawLinesComplex = (context, collection) => {
    context.beginPath();
    for (const leaf of collection) {
        for (const neighbor of leaf.neighbors) {
            if (neighbor.selected) {
                context.moveTo(leaf.center.x, leaf.center.y);
                context.lineTo(neighbor.center.x, neighbor.center.y);
            }
        }
    }
    context.closePath();
    context.stroke();
};

/**
 * @param {CanvasRenderingContext2D} context
 * @param {Map<TalentNode, Set<number>>} collection
 * @param {Set<number>} optional
 */
const drawLinesComplexOptional = (context, collection, optional) => {
    context.beginPath();
    for (const [leaf, dataset] of collection) {
        for (const neighbor of leaf.neighbors) {
            if (optional.has(neighbor.identifier.number)) {
                continue;
            }
            optional.add(neighbor.identifier.number);

            if (dataset.has(neighbor.identifier.number)) {
                context.moveTo(leaf.center.x, leaf.center.y);
                context.lineTo(neighbor.center.x, neighbor.center.y);
            }
        }
    }
    context.closePath();
    context.stroke();
};

export const drawLinesInitial = () => {
    const context = lineCanvas.offscreenCanvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = false;

    context.fillStyle = colorMap.custom.get("background");
    context.fillRect(0, 0, lineCanvas.offscreenCanvas.width, lineCanvas.offscreenCanvas.height);

    context.strokeStyle = colorMap.custom.get("line");
    context.lineWidth = LINE_WIDTH;
    drawLinesSimple(context, talentNodes);
    context.stroke();
};

export const drawLinesAscendancyInitial = () => {
    for (const [ascendancy, subCanvas] of ascendancyCanvas.offscreenCanvasMap) {
        const context = subCanvas.getContext("2d", { alpha: false });
        context.imageSmoothingEnabled = false;

        context.fillStyle = colorMap.custom.get("background");
        context.fillRect(0, 0, subCanvas.width, subCanvas.height);

        context.strokeStyle = colorMap.custom.get("line");
        context.lineWidth = LINE_WIDTH;
        drawLinesSimple(context, ascendancyNodes.get(ascendancy));
        context.stroke();
    }
};

export const drawLinesAscendancy = () => {
    if (!controls.ascendancy || (controls.ascendancy === "none")) {
        return;
    }

    ascendancyCanvasContext.drawImage(ascendancyCanvas.offscreenCanvasMap.get(controls.ascendancy), 0, 0);

    ascendancyCanvasContext.lineWidth = LINE_WIDTH;

    if (ascendancySelections.length < TOTAL_ASCENDANCY_POINTS) {
        ascendancyCanvasContext.strokeStyle = colorMap.custom.get("line_connect");
        drawLinesSimple(ascendancyCanvasContext, ascendancySelections, excludedAscendancyNodes);
    }

    ascendancyCanvasContext.strokeStyle = colorMap.custom.get("line_select");
    drawLinesComplex(ascendancyCanvasContext, ascendancySelections);

    ascendancyCanvasContext.strokeStyle = colorMap.custom.get("line_remove");
    drawLinesComplexOptional(ascendancyCanvasContext, ascendancyRemovePreview, new Set());

    ascendancyCanvasContext.strokeStyle = colorMap.custom.get("line_add");
    drawLinesComplexOptional(ascendancyCanvasContext, ascendancyAddPreview, new Set([...ascendancyAddLeftovers.keys().map(item => item.identifier.number)]));

    ascendancyCanvasContext.strokeStyle = colorMap.custom.get("line_overflow");
    drawLinesComplexOptional(ascendancyCanvasContext, ascendancyAddLeftovers, new Set());
};

export const drawLinesRegular = () => {
    lineCanvasContext.drawImage(lineCanvas.offscreenCanvas, 0, 0);

    lineCanvasContext.lineWidth = LINE_WIDTH;

    if (talentSelections.length < TOTAL_POINTS) {
        lineCanvasContext.strokeStyle = colorMap.custom.get("line_connect");
        drawLinesSimple(lineCanvasContext, talentSelections, excludedTalentNodes);
    }

    lineCanvasContext.strokeStyle = colorMap.custom.get("line_select");
    drawLinesComplex(lineCanvasContext, talentSelections);

    lineCanvasContext.strokeStyle = colorMap.custom.get("line_remove");
    drawLinesComplexOptional(lineCanvasContext, talentRemovePreview, new Set());

    lineCanvasContext.strokeStyle = colorMap.custom.get("line_add");
    drawLinesComplexOptional(lineCanvasContext, talentAddPreview, new Set([...talentAddLeftovers.keys().map(item => item.identifier.number)]));

    lineCanvasContext.strokeStyle = colorMap.custom.get("line_overflow");
    drawLinesComplexOptional(lineCanvasContext, talentAddLeftovers, new Set());
};
