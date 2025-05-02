import { LINE_WIDTH } from "../data/constants.js";
import { talentAddPreview, talentExclusions, talentNodes, talentRemovePreview, talentSelections } from "../type/talent-node.js";

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

    context.fillStyle = "#191821";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "#222222";
    context.lineWidth = LINE_WIDTH;
    drawLinesSimple(context, talentNodes);
    context.stroke();
};

export const drawLinesRegular = () => {
    const canvas = document.querySelector("#line-canvas");
    const context = canvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = false;

    context.drawImage(canvas.offscreenCanvas, 0, 0);

    context.lineWidth = LINE_WIDTH;

    context.strokeStyle = "#3E3E3E";
    const excluded = [];
    for (const values of talentExclusions.values()) {
        if (talentSelections.some(item => values.some(element => item.identifier.number === element.identifier.number))) {
            excluded.push(...values);
        }
    }
    drawLinesSimple(context, talentSelections, excluded);

    context.strokeStyle = "#1A5A1A";
    drawLinesComplex(context, talentSelections);

    context.strokeStyle = "#9F1F1F";
    drawLinesComplex(context, talentRemovePreview, []);

    context.strokeStyle = "#1F1F9F";
    drawLinesComplex(context, talentAddPreview, []);
};
