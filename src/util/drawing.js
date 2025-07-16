import { colorMap, controls, LINE_WIDTH } from "../data/constants.js";
import {
    ascendancyAddPreview,
    ascendancyNodes,
    ascendancyRemovePreview,
    ascendancySelections,
    talentAddPreview,
    talentExclusions,
    talentNodes,
    talentRemovePreview,
    talentSelections,
    TOTAL_ASCENDANCY_POINTS,
    TOTAL_POINTS,
} from "../type/talent-node.js";

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
 * @param {TalentNode[] | undefined} optional
 */
export const drawLinesComplex = (context, collection, optional = undefined) => {
    context.beginPath();
    for (const leaf of collection) {
        for (const neighbor of leaf.neighbors) {
            if (optional) {
                if (optional.some(item => item.identifier.number === neighbor.identifier.number)) {
                    continue;
                }
                optional.push(neighbor);
            }

            if (collection.some(item => item.identifier.number === neighbor.identifier.number)) {
                context.moveTo(leaf.center.x, leaf.center.y);
                context.lineTo(neighbor.center.x, neighbor.center.y);
            }
        }
    }
    context.closePath();
    context.stroke();
};

export const drawLinesInitial = () => {
    const canvas = document.querySelector("#line-canvas").offscreenCanvas;
    const context = canvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = false;

    context.fillStyle = colorMap.custom.get("background");
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = colorMap.custom.get("line");
    context.lineWidth = LINE_WIDTH;
    drawLinesSimple(context, talentNodes);
    context.stroke();
};

export const drawLinesAscendancyInitial = () => {
    for (const [ascendancy, subCanvas] of document.querySelector("#ascendancy-canvas").offscreenCanvasMap) {
        const subContext = subCanvas.getContext("2d", { alpha: false });
        subContext.imageSmoothingEnabled = false;

        subContext.fillStyle = colorMap.custom.get("background");
        subContext.fillRect(0, 0, subCanvas.width, subCanvas.height);

        subContext.strokeStyle = colorMap.custom.get("line");
        subContext.lineWidth = LINE_WIDTH;
        drawLinesSimple(subContext, ascendancyNodes.get(ascendancy));
        subContext.stroke();
    }
};

export const drawLinesAscendancy = () => {
    const canvas = document.querySelector("#ascendancy-canvas");
    const context = canvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = false;

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!controls.ascendancy || controls.ascendancy === "none") {
        return;
    }

    context.drawImage(canvas.offscreenCanvasMap.get(controls.ascendancy), 0, 0);

    context.lineWidth = LINE_WIDTH;

    if (ascendancySelections.length < TOTAL_ASCENDANCY_POINTS) {
        context.strokeStyle = colorMap.custom.get("line_connect");
        const excluded = [];
        for (const values of talentExclusions.values()) {
            if (ascendancySelections.some(item => values.some(element => item.identifier.number === element.identifier.number))) {
                excluded.push(...values);
            }
        }
        drawLinesSimple(context, ascendancySelections, excluded);
    }

    context.strokeStyle = colorMap.custom.get("line_select");
    drawLinesComplex(context, ascendancySelections);

    context.strokeStyle = colorMap.custom.get("line_remove");
    drawLinesComplex(context, ascendancyRemovePreview, []);

    context.strokeStyle = colorMap.custom.get("line_add");
    drawLinesComplex(context, ascendancyAddPreview, []);
};

export const drawLinesRegular = () => {
    const canvas = document.querySelector("#line-canvas");
    const context = canvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = false;

    context.drawImage(canvas.offscreenCanvas, 0, 0);

    context.lineWidth = LINE_WIDTH;

    if (talentSelections.length < TOTAL_POINTS) {
        context.strokeStyle = colorMap.custom.get("line_connect");
        const excluded = [];
        for (const values of talentExclusions.values()) {
            if (talentSelections.some(item => values.some(element => item.identifier.number === element.identifier.number))) {
                excluded.push(...values);
            }
        }
        drawLinesSimple(context, talentSelections, excluded);
    }

    context.strokeStyle = colorMap.custom.get("line_select");
    drawLinesComplex(context, talentSelections);

    context.strokeStyle = colorMap.custom.get("line_remove");
    drawLinesComplex(context, talentRemovePreview, []);

    context.strokeStyle = colorMap.custom.get("line_add");
    drawLinesComplex(context, talentAddPreview, []);

    drawLinesAscendancy();
};
