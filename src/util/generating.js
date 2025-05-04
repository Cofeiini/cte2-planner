import { generatePath } from "../core/algorithm.js";
import { handleTooltip, infoTooltip } from "../core/tooltip.js";
import { borderAssets, iconAssets, indicatorAssets } from "../data/assets.js";
import { CELL_SIZE, colorMap, controls } from "../data/constants.js";
import {
    exclusiveNodeValues,
    startingNode,
    talentAddLeftovers,
    talentAddPreview,
    talentExclusions,
    talentGrid,
    TalentNode,
    talentNodes,
    talentRemovePreview,
    talentSelections,
    toggleNode,
} from "../type/talent-node.js";
import { drawLinesInitial, drawLinesRegular } from "./drawing.js";
import { setUpIcon } from "./spuddling.js";

export const viewport = {
    width: 0,
    height: 0,
    max: 0,
};

export let talentTree = undefined;
export const updateTalentTree = (element) => {
    talentTree = element;
};

let drawingTimer = undefined;

/**
 * @param {string} description
 * @returns {string}
 */
export const generateDescriptionHTML = (description) => {
    const results = [];
    const parts = description.split(/(§\w)/).filter(element => element);
    let color = colorMap.get("7");
    for (const part of parts) {
        if (part.startsWith("§")) {
            color = colorMap.get(part.at(1));
            continue;
        }

        const elements = [];
        const words = part.split(/\s/);
        for (const word of words) {
            elements.push(`<span class="word" style="color: ${color};">${word}</span>`);
        }
        results.push(elements.join("\u00A0"));
    }

    return results.flat().join("");
};

export const generateCanvas = () => {
    viewport.width = talentGrid.at(0).length * CELL_SIZE;
    viewport.height = talentGrid.length * CELL_SIZE;
    viewport.max = Math.max(talentGrid.length, talentGrid.at(0).length);

    talentTree.style.height = `${viewport.height}px`;
    talentTree.style.width = `${viewport.width}px`;

    let centerNode = {
        center: {
            x: (viewport.width * -0.5),
            y: (viewport.height * -0.5),
        },
    };
    for (const branch of talentGrid) {
        for (const leaf of branch) {
            if (leaf.identifier.talent.includes("[CENTER]")) {
                centerNode = leaf;
                break;
            }
        }
    }

    const container = document.querySelector("#talent-container").getBoundingClientRect();
    controls.x = (centerNode.center.x * -controls.zoom) + (container.width * 0.5);
    controls.y = (centerNode.center.y * -controls.zoom) + (container.height * 0.5);

    const canvas = document.querySelector("#line-canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    canvas.offscreenCanvas = document.createElement("canvas");
    canvas.offscreenCanvas.width = viewport.width;
    canvas.offscreenCanvas.height = viewport.height;

    drawLinesInitial();
};

/**
 * @param {string} data
 */
export const generateTalentGrid = (data) => {
    talentGrid.length = 0;
    const rows = data.trim().split(/\r?\n/);
    for (let y = 0; y < rows.length; ++y) {
        /** @type {TalentNode[]} */
        const branch = [];
        const columns = rows.at(y).split(",");
        for (let x = 0; x < columns.length; ++x) {
            const value = columns.at(x).trim();
            branch.push(new TalentNode({
                x: x,
                y: y,
                length: columns.length,
                value: value,
            }));
        }

        talentGrid.push(branch);
    }

    talentNodes.length = 0;
    for (const branch of talentGrid) {
        for (const leaf of branch) {
            if (!leaf.selectable) {
                continue;
            }

            talentNodes.push(leaf);

            for (let y = -1; y <= 1; ++y) {
                for (let x = -1; x <= 1; ++x) {
                    if (x === 0 && y === 0) {
                        continue;
                    }

                    const node = talentGrid.at(leaf.y + y)?.at(leaf.x + x);
                    if (!node) {
                        continue;
                    }

                    if (node.identifier.talent.length !== 1) {
                        continue;
                    }

                    generatePath(node, [leaf, node]).forEach(item => leaf.neighbors.push(item));
                }
            }
        }
    }

    generateCanvas();
};

/**
 * @param {TalentNode} talent
 * @param {HTMLDivElement} container
 */
export const handleTalentEvents = (talent, container) => {
    container.onmouseenter = () => {
        controls.hovering = true;

        if (controls.panning) {
            return;
        }

        infoTooltip.node.count.classList.remove("hidden");
        infoTooltip.node.text.classList.remove("hidden");
        handleTooltip(talent);

        clearTimeout(drawingTimer);
        drawingTimer = setTimeout(() => {
            controls.shouldRedraw = true;

            drawLinesRegular();
        }, 80);
    };

    container.onmouseleave = () => {
        controls.hovering = false;

        infoTooltip.main.classList.remove("visible");
        infoTooltip.main.classList.add("invisible");

        talentAddPreview.length = 0;
        talentRemovePreview.length = 0;

        clearTimeout(drawingTimer);
        if (controls.shouldRedraw) {
            drawingTimer = setTimeout(() => {
                controls.shouldRedraw = false;
                drawLinesRegular();
            }, 80);
        }
    };

    container.onmousedown = (event) => {
        if (event.button !== 0) {
            return;
        }

        if (startingNode && (startingNode.identifier.number !== talent.identifier.number) && talentExclusions.get("start").some(item => item.identifier.number === talent.identifier.number)) {
            return;
        }

        controls.clickTarget = container;
    };

    container.onmouseup = (event) => {
        if (event.button !== 0) {
            return;
        }

        if (controls.panning) {
            return;
        }

        if (controls.clickTarget === container) {
            controls.clickTarget = undefined;

            toggleNode(talent);
            handleTooltip(talent);
            if (talent.selected) {
                talentAddPreview.length = 0;
                talentAddPreview.push(...talentAddLeftovers);
            } else {
                talentRemovePreview.length = 0;
            }
            drawLinesRegular();
        }
    };
};

export const generateTree = () => {
    talentTree.replaceChildren();

    for (const talent of talentNodes) {
        const container = document.createElement("div");
        container.classList.add("talent-node");
        container.style.left = `${talent.center.x}px`;
        container.style.top = `${talent.center.y}px`;

        const indicator = document.createElement("img");
        indicator.classList.add("talent-node-indicator");
        indicator.src = indicatorAssets.get("no");
        indicator.width = 40;
        indicator.height = 40;
        setUpIcon(indicator);
        container.appendChild(indicator);

        const border = document.createElement("img");
        border.classList.add("talent-node-border");
        border.src = borderAssets.get(`${talent.type}_off`);
        switch (talent.type) {
            case "stat": {
                border.width = 52;
                border.height = 52;
                break;
            }
            case "special": {
                border.width = 64;
                border.height = 64;
                break;
            }
            case "start": {
                border.width = 64;
                border.height = 64;
                break;
            }
            case "major": {
                border.width = 78;
                border.height = 78;
                break;
            }
        }
        setUpIcon(border);
        container.appendChild(border);

        const icon = document.createElement("img");
        icon.classList.add("talent-node-icon");
        icon.src = iconAssets.get(talent.identifier.talent);
        icon.width = 32;
        icon.height = 32;
        setUpIcon(icon);
        container.appendChild(icon);

        handleTalentEvents(talent, container);

        talent.update = () => {
            container.classList.remove("active");

            let isExcluded = false;
            if (!talent.selected) {
                for (const values of exclusiveNodeValues.values()) {
                    const existingSelection = talentSelections.some(item => values.includes(item.identifier.talent));
                    if (existingSelection && values.includes(talent.identifier.talent)) {
                        isExcluded = true;
                        break;
                    }
                }
            }

            let assetId = "no";
            if (talent.selected) {
                assetId = "yes";
                container.classList.add("active");
            } else if (!isExcluded && talent.neighbors.some(item => item.selected)) {
                assetId = "can";
            }

            border.src = borderAssets.get(`${talent.type}_${talent.selected ? "on" : "off"}`);
            indicator.src = indicatorAssets.get(assetId);
        };

        talent.visual = container;
        talentTree.appendChild(container);
    }
};
