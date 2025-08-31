import { CELL_SIZE, colorMap, controls, LINE_WIDTH } from "../data/constants.js";
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
import { isSameTalent } from "./spuddling.js";

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
            if (excluded.some(item => isSameTalent(item, neighbor))) {
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

/**
 * @param {CanvasRenderingContext2D} context
 * @param {{width: number, height: number}} workspace
 */
const drawGridLines = (context, workspace) => {
    context.strokeStyle = colorMap.custom.get("grid");
    context.lineWidth = 1;
    context.beginPath();
    const height = Math.ceil(workspace.height / CELL_SIZE) - 1;
    const width = Math.ceil(workspace.width / CELL_SIZE) - 1;
    for (let y = 1; y < (height + 1); ++y) {
        context.moveTo(CELL_SIZE, y * CELL_SIZE);
        context.lineTo(width * CELL_SIZE, y * CELL_SIZE);
    }
    for (let x = 1; x < (width + 1); ++x) {
        context.moveTo(x * CELL_SIZE, CELL_SIZE);
        context.lineTo(x * CELL_SIZE, height * CELL_SIZE);
    }
    context.closePath();
    context.stroke();
};

export const drawLinesInitial = () => {
    const context = lineCanvas.offscreenCanvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = false;

    context.fillStyle = colorMap.custom.get("background");
    context.fillRect(0, 0, lineCanvas.offscreenCanvas.width, lineCanvas.offscreenCanvas.height);

    if (controls.editor.active) {
        drawGridLines(context, { width: lineCanvas.offscreenCanvas.width, height: lineCanvas.offscreenCanvas.height });
    }

    context.strokeStyle = colorMap.custom.get("line");
    context.lineWidth = LINE_WIDTH;
    drawLinesSimple(context, talentNodes);
};

export const drawLinesAscendancyInitial = () => {
    for (const [ascendancy, subCanvas] of ascendancyCanvas.offscreenCanvasMap) {
        const context = subCanvas.getContext("2d", { alpha: false });
        context.imageSmoothingEnabled = false;

        context.fillStyle = colorMap.custom.get("background");
        context.fillRect(0, 0, subCanvas.width, subCanvas.height);

        if (controls.editor.active) {
            drawGridLines(context, { width: subCanvas.width, height: subCanvas.height });
        }

        context.strokeStyle = colorMap.custom.get("line");
        context.lineWidth = LINE_WIDTH;
        drawLinesSimple(context, ascendancyNodes.get(ascendancy));
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
    drawLinesComplex(ascendancyCanvasContext, ascendancyRemovePreview);

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
    drawLinesComplex(lineCanvasContext, talentRemovePreview);

    lineCanvasContext.strokeStyle = colorMap.custom.get("line_add");
    drawLinesComplexOptional(lineCanvasContext, talentAddPreview, new Set([...talentAddLeftovers.keys().map(item => item.identifier.number)]));

    lineCanvasContext.strokeStyle = colorMap.custom.get("line_overflow");
    drawLinesComplexOptional(lineCanvasContext, talentAddLeftovers, new Set());
};
