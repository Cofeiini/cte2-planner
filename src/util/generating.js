import { generateAscendancyPath, generatePath } from "../core/algorithm.js";
import { handleTooltip, infoTooltip, tooltipOffsets } from "../core/tooltip.js";
import { borderAssets, iconAssets, indicatorAssets } from "../data/assets.js";
import { CELL_HALF, CELL_SIZE, colorMap, controls, RAD_TO_DEG } from "../data/constants.js";
import {
    ascendancyAddPreview,
    ascendancyGrid,
    ascendancyNodes,
    ascendancyRemovePreview,
    ascendancySelections,
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
    TOTAL_ASCENDANCY_POINTS,
    TOTAL_POINTS,
    updateTargetTree,
} from "../type/talent-node.js";
import { drawLinesAscendancyInitial, drawLinesInitial, drawLinesRegular } from "./drawing.js";
import { handleViewport, setUpIcon, updateAscendancyButton } from "./spuddling.js";

export const viewport = {
    width: 0,
    height: 0,
    offset: {
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    center: {
        x: 0,
        y: 0,
    },
};

/** @type {HTMLDivElement} */
export let talentTree = undefined;
export const updateTalentTree = (element) => {
    talentTree = element;
};

/** @type {HTMLDivElement} */
export let ascendancyContainer = undefined;
export const updateAscendancyContainer = (element) => {
    ascendancyContainer = element;
};

/** @type {HTMLDivElement} */
export let ascendancyTreeContainer = undefined;
export const updateAscendancyTreeContainer = (element) => {
    ascendancyTreeContainer = element;
};

let drawingTimer = undefined;

/**
 * @param {string} description
 * @returns {string}
 */
export const generateDescriptionHTML = (description) => {
    const results = [];
    const parts = description.split(/(§\w)/).filter(element => element);
    let color = colorMap.minecraft.get("7");
    for (const part of parts) {
        if (part.startsWith("§")) {
            color = colorMap.minecraft.get(part.at(1));
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
    viewport.width = (viewport.offset.right - viewport.offset.left) * CELL_SIZE;
    viewport.height = (viewport.offset.bottom - viewport.offset.top) * CELL_SIZE;

    talentTree.style.height = `${viewport.height}px`;
    talentTree.style.width = `${viewport.width}px`;

    let centerNode = {
        center: {
            x: (viewport.width * -0.5) - viewport.offset.left,
            y: (viewport.height * -0.5) - viewport.offset.top,
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

    viewport.center = centerNode.center;

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

export const generateAscendancyCanvas = () => {
    const canvas = document.querySelector("#ascendancy-canvas");
    canvas.offscreenCanvasMap = new Map();

    const bounds = {
        width: 0,
        height: 0,
    };

    for (const ascendancy of ascendancyNodes.keys()) {
        const subGrid = ascendancyGrid.get(ascendancy);

        const subCanvas = document.createElement("canvas");
        subCanvas.width = subGrid.at(0).length * CELL_SIZE;
        subCanvas.height = subGrid.length * CELL_SIZE;

        canvas.offscreenCanvasMap.set(ascendancy, subCanvas);

        if (subCanvas.width > bounds.width) {
            bounds.width = subCanvas.width;
        }

        if (subCanvas.height > bounds.height) {
            bounds.height = subCanvas.height;
        }
    }

    ascendancyContainer.style.width = `${bounds.width}px`;
    ascendancyContainer.style.height = `${bounds.height + 44}px`;

    canvas.width = bounds.width;
    canvas.height = bounds.height;

    drawLinesAscendancyInitial();
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
                parentTree: "main",
            }));
        }

        talentGrid.push(branch);
    }

    const bounds = {
        top: Number.MAX_VALUE,
        left: Number.MAX_VALUE,
        right: 0,
        bottom: 0,
    };
    for (const branch of talentGrid) {
        for (const node of branch) {
            if (!node.selectable) {
                continue;
            }

            if (node.x < bounds.left) {
                bounds.left = node.x;
            }
            if (node.x > bounds.right) {
                bounds.right = node.x;
            }
            if (node.y < bounds.top) {
                bounds.top = node.y;
            }
            if (node.y > bounds.bottom) {
                bounds.bottom = node.y;
            }
        }
    }

    // Add 1 cell of padding
    viewport.offset.top = Math.max(0, bounds.top - 1);
    viewport.offset.left = Math.max(0, bounds.left - 1);

    // Include the current cell and add 1 cell of padding
    viewport.offset.right = bounds.right + 2;
    viewport.offset.bottom = bounds.bottom + 2;

    talentNodes.length = 0;
    for (const branch of talentGrid) {
        for (const leaf of branch) {
            leaf.center.x = ((leaf.x - viewport.offset.left) * CELL_SIZE) + CELL_HALF;
            leaf.center.y = ((leaf.y - viewport.offset.top) * CELL_SIZE) + CELL_HALF;

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
 * @param {string[]} rows
 */
const extractAscendancy = (rows) => {
    const selector = document.querySelector("#ascendancy-select");
    selector.replaceChildren();

    const data = rows.map(row => row.split(",").map(item => item.trim()));

    /** @type {boolean[][]} */
    const visited = Array.from({ length: data.length }, () => Array(data.at(0).length).fill(false));
    for (let y = 0; y < data.length; ++y) {
        const columns = data.at(y);
        for (let x = 0; x < columns.length; ++x) {
            if ((columns.at(x) !== "X") || visited.at(y).at(x)) {
                continue;
            }

            const queue = [[y, x]];
            const bounds = {
                top: y,
                bottom: y,
                left: x,
                right: x,
            };

            while (queue.length > 0) {
                const [row, col] = queue.shift();
                if (row >= data.length) {
                    continue;
                }

                if (col >= columns.length) {
                    continue;
                }

                if (visited.at(row).at(col)) {
                    continue;
                }

                if (data.at(row).at(col) !== "X") {
                    continue;
                }

                visited[row][col] = true;

                bounds.top = Math.min(bounds.top, row);
                bounds.bottom = Math.max(bounds.bottom, row);
                bounds.left = Math.min(bounds.left, col);
                bounds.right = Math.max(bounds.right, col);

                for (let dr = -1; dr <= 1; ++dr) {
                    for (let dc = -1; dc <= 1; ++dc) {
                        if ((dr === 0) && (dc === 0)) {
                            continue;
                        }

                        queue.push([row + dr, col + dc]);
                    }
                }
            }

            let ascendancy = "";
            /** @type {TalentNode[][]} */
            const grid = [];
            for (let row = bounds.top; row <= bounds.bottom; ++row) {
                /** @type {TalentNode[]} */
                const nodes = [];
                for (let col = bounds.left; col <= bounds.right; ++col) {
                    let value = data.at(row).at(col);

                    if (value.match(/\w+_class$/)) {
                        const tree = document.createElement("div");
                        tree.classList.add("ascendancy-tree", "hidden");
                        tree.id = `${value}_tree`;
                        ascendancyTreeContainer.append(tree);

                        const option = document.createElement("option");
                        option.value = value;
                        option.innerText = value;
                        selector.append(option);

                        ascendancy = value;
                    }

                    if (visited.at(row).at(col)) {
                        value = "";
                    }

                    nodes.push(new TalentNode({
                        x: col - bounds.left,
                        y: row - bounds.top,
                        length: bounds.right - bounds.left,
                        value: value,
                        parentTree: "ascendancy",
                    }));
                }

                grid.push(nodes);
            }

            if (ascendancy.length > 0) {
                ascendancyGrid.set(ascendancy, grid);
            }
        }
    }
};

export const generateAscendancyGrid = (data) => {
    const rows = data.trim().split(/\r?\n/).map(item => item.trim());

    ascendancyGrid.clear();
    extractAscendancy(rows);

    ascendancyNodes.clear();
    for (const [ascendancy, grid] of ascendancyGrid) {
        /** @type {TalentNode[]} */
        const nodes = [];
        for (const branch of grid) {
            for (const leaf of branch) {
                leaf.parentTree = ascendancy;
                leaf.center.x = (leaf.x * CELL_SIZE) + CELL_HALF;
                leaf.center.y = (leaf.y * CELL_SIZE) + CELL_HALF;

                if (!leaf.selectable) {
                    continue;
                }

                nodes.push(leaf);

                for (let y = -1; y <= 1; ++y) {
                    for (let x = -1; x <= 1; ++x) {
                        if (x === 0 && y === 0) {
                            continue;
                        }

                        const node = grid.at(leaf.y + y)?.at(leaf.x + x);
                        if (!node) {
                            continue;
                        }

                        if (node.identifier.talent.length !== 1) {
                            continue;
                        }

                        generateAscendancyPath(ascendancy, node, [leaf, node]).forEach(item => leaf.neighbors.push(item));
                    }
                }
            }
        }

        ascendancyNodes.set(ascendancy, nodes);
    }

    generateAscendancyCanvas();
};

/**
 * @param {TalentNode} talent
 * @param {HTMLDivElement} container
 */
export const handleTalentEvents = (talent, container) => {
    container.onmouseenter = () => {
        controls.hovering = true;

        if (controls.panning) {
            container.classList.add("panning");
            return;
        }

        updateTargetTree(talent.parentTree);

        infoTooltip.node.count.classList.remove("hidden");
        infoTooltip.node.text.classList.remove("hidden");
        handleTooltip(talent);

        infoTooltip.arrow.style.left = `${tooltipOffsets.pointer + Math.floor(tooltipOffsets.arrow * 2.5)}px`;
        infoTooltip.arrow.style.top = `${tooltipOffsets.pointer - Math.floor(tooltipOffsets.arrow * 0.5)}px`;
        infoTooltip.arrow.style.transform = `translate(-50%, -50%) rotate(225deg)`;

        clearTimeout(drawingTimer);
        drawingTimer = setTimeout(() => {
            controls.shouldRedraw = true;

            drawLinesRegular();
        }, 10);
    };

    container.onmouseleave = () => {
        controls.hovering = false;
        container.classList.remove("panning");

        infoTooltip.container.classList.remove("visible");
        infoTooltip.container.classList.add("invisible");

        talentAddPreview.length = 0;
        talentRemovePreview.length = 0;
        ascendancyAddPreview.length = 0;
        ascendancyRemovePreview.length = 0;

        clearTimeout(drawingTimer);
        if (controls.shouldRedraw) {
            drawingTimer = setTimeout(() => {
                controls.shouldRedraw = false;
                drawLinesRegular();
            }, 10);
        }
    };

    container.onmousemove = (event) => {
        if (controls.panning) {
            infoTooltip.container.classList.remove("visible");
            infoTooltip.container.classList.add("invisible");
            return;
        }

        const containerBounds = infoTooltip.container.getBoundingClientRect();
        const contentBounds = infoTooltip.main.getBoundingClientRect();

        const origin = {
            x: Math.floor(event.clientX - containerBounds.left),
            y: Math.floor(event.clientY - containerBounds.top),
        };
        const center = {
            x: Math.floor(contentBounds.width * 0.5),
            y: Math.floor(contentBounds.height * 0.5),
        };
        const delta = {
            x: origin.x - center.x,
            y: origin.y - center.y,
        };
        const radians = Math.atan2(delta.y, delta.x);

        const limits = {
            x: Math.ceil(Math.cos(radians) * center.x),
            y: Math.floor(Math.sin(radians) * (contentBounds.height * 2.0)),
            left: tooltipOffsets.pointer + Math.floor(tooltipOffsets.arrow * 2.5),
            right: contentBounds.width - (tooltipOffsets.pointer - Math.floor(tooltipOffsets.arrow * 0.5)),
            top: tooltipOffsets.pointer - Math.floor(tooltipOffsets.arrow * 0.5),
            bottom: contentBounds.height - (tooltipOffsets.pointer - Math.floor(tooltipOffsets.arrow * 0.5)),
        };
        const arrow = {
            x: Math.min(Math.max(center.x + limits.x, limits.left), limits.right),
            y: Math.min(Math.max(center.y + limits.y, limits.top), limits.bottom),
        };
        infoTooltip.arrow.style.left = `${arrow.x}px`;
        infoTooltip.arrow.style.top = `${arrow.y}px`;

        const angle = ((radians * RAD_TO_DEG) + 360) % 360;
        const minAngle = ((Math.atan2(contentBounds.height - center.y, delta.x) * RAD_TO_DEG) + 360) % 360;
        const maxAngle = ((Math.atan2(-center.y, delta.x) * RAD_TO_DEG) + 360) % 360;

        const mapped = 135 + (((angle - minAngle) / (maxAngle - minAngle)) * (225 - 135));

        infoTooltip.arrow.style.transform = `translate(-50%, -50%) rotate(${Math.max(Math.min(mapped, 225), 135)}deg)`;
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
            container.classList.remove("panning");
            return;
        }

        if (controls.clickTarget === container) {
            controls.clickTarget = undefined;

            toggleNode(talent);
            handleTooltip(talent);
            if (talent.selected) {
                talentAddPreview.length = 0;
                ascendancyAddPreview.length = 0;
                if (talent.parentTree === "main") {
                    talentAddPreview.push(...talentAddLeftovers);
                } else {
                    ascendancyAddPreview.push(...talentAddLeftovers);
                }
            } else {
                talentRemovePreview.length = 0;
            }
            drawLinesRegular();
        }
    };
};

const generateTalentNode = (talent) => {
    const container = document.createElement("div");
    container.classList.add("talent-node");
    container.style.left = `${talent.center.x}px`;
    container.style.top = `${talent.center.y}px`;

    const indicator = document.createElement("img");
    indicator.loading = "lazy";
    indicator.classList.add("talent-node-indicator");
    indicator.src = indicatorAssets.get("no");
    indicator.width = 40;
    indicator.height = 40;
    setUpIcon(indicator);
    container.append(indicator);

    const border = document.createElement("img");
    border.loading = "lazy";
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
        case "major": {
            border.width = 78;
            border.height = 78;
            break;
        }
        case "start": {
            border.width = 64;
            border.height = 64;
            break;
        }
        case "asc": {
            border.width = 64;
            border.height = 64;
            break;
        }
    }
    setUpIcon(border);
    container.append(border);

    const icon = document.createElement("img");
    icon.loading = "lazy";
    icon.classList.add("talent-node-icon");
    icon.src = iconAssets.get(talent.identifier.talent);
    icon.width = 32;
    icon.height = 32;
    setUpIcon(icon);
    container.append(icon);

    handleTalentEvents(talent, container);

    talent.update = () => {
        let totalPoints = TOTAL_POINTS;
        let selections = talentSelections;
        if (talent.parentTree !== "main") {
            totalPoints = TOTAL_ASCENDANCY_POINTS;
            selections = ascendancySelections;
        }

        container.classList.remove("active");

        let isExcluded = false;
        if (!talent.selected) {
            for (const values of exclusiveNodeValues.values()) {
                const existingSelection = selections.some(item => values.includes(item.identifier.talent));
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
        } else if (!isExcluded && talent.neighbors.some(item => item.selected) && (selections.length < totalPoints)) {
            assetId = "can";
        }

        border.src = borderAssets.get(`${talent.type}_${talent.selected ? "on" : "off"}`);
        indicator.src = indicatorAssets.get(assetId);
    };

    talent.visual = container;

    return container;
};

export const generateTree = () => {
    const isActive = controls.ascendancy !== "none";

    const menu = document.querySelector("#ascendancy-menu");
    menu.replaceChildren();
    const selector = document.querySelector("#ascendancy-select");
    for (const option of selector.children) {
        const item = document.createElement("div");
        item.innerText = option.innerText;
        item.onmousedown = (event) => {
            if (event.button !== 0) {
                return;
            }

            selector.value = option.value;
            selector.dispatchEvent(new Event("change"));
        };
        menu.append(item);
    }

    const ascendancyButton = document.querySelector("#ascendancy-button");
    ascendancyButton.replaceChildren();
    ascendancyButton.classList.add("talent-node");
    ascendancyButton.setAttribute("base-scale", "1.0");
    ascendancyButton.style.left = `${viewport.center.x}px`;
    ascendancyButton.style.top = `${viewport.center.y}px`;

    const indicator = document.createElement("img");
    indicator.loading = "lazy";
    indicator.classList.add("talent-node-indicator");
    indicator.src = indicatorAssets.get(isActive ? "yes" : "can");
    indicator.width = 40;
    indicator.height = 40;
    setUpIcon(indicator);
    ascendancyButton.append(indicator);

    const border = document.createElement("img");
    border.loading = "lazy";
    border.classList.add("talent-node-border");
    border.src = borderAssets.get(`asc_${isActive ? "on" : "off"}`);
    border.width = 64;
    border.height = 64;
    setUpIcon(border);
    ascendancyButton.append(border);

    const icon = document.createElement("img");
    icon.loading = "lazy";
    icon.classList.add("talent-node-icon");
    icon.src = iconAssets.get("ascendancy");
    icon.width = 32;
    icon.height = 32;
    setUpIcon(icon);
    ascendancyButton.append(icon);

    if (isActive) {
        ascendancyButton.classList.add("active");
    }

    handleTalentEvents(undefined, ascendancyButton);

    const handleSimpleTooltip = () => {
        const isHidden = ascendancyContainer.classList.contains("hidden");

        infoTooltip.name.innerText = "Ascendancy";
        infoTooltip.name.style.color = colorMap.minecraft.get("5");
        infoTooltip.node.count.classList.add("hidden");
        infoTooltip.node.text.classList.add("hidden");
        infoTooltip.stats.innerHTML = [
            `<p style="margin: 0;">Left click toggles the menu and right click lets you quickly change Ascendancy.</p>`,
            `<p style="color: red; margin: 0;">${controls.ascendancy === "none" ? "Choose an Ascendancy first" : `${isHidden ? "Show" : "Hide"} the Ascendancy menu`}</p>`,
        ].join("");

        infoTooltip.container.classList.remove("invisible");
        infoTooltip.container.classList.add("visible");
    };

    ascendancyButton.onmouseenter = () => {
        controls.hovering = true;

        if (controls.panning) {
            ascendancyButton.classList.add("panning");
            return;
        }

        ascendancyButton.setAttribute("base-scale", "1.5");
        ascendancyButton.style.transform = `scale(${controls.zoom * 1.5})`;

        handleSimpleTooltip();
    };

    ascendancyButton.onmouseleave = () => {
        controls.hovering = false;

        ascendancyButton.classList.remove("panning");
        ascendancyButton.setAttribute("base-scale", "1.0");
        ascendancyButton.style.transform = `scale(${controls.zoom})`;

        infoTooltip.container.classList.remove("visible");
        infoTooltip.container.classList.add("invisible");
    };

    ascendancyButton.onmousedown = (event) => {
        if (event.button !== 0) {
            if (event.button === 2) {
                menu.classList.remove("hidden");

                const bounds = document.querySelector("#viewport-container").getBoundingClientRect();
                const menuBounds = menu.getBoundingClientRect();

                menu.style.left = `${Math.floor(event.clientX)}px`;
                menu.style.top = `${Math.min(Math.floor(event.clientY), bounds.height - menuBounds.height - 3)}px`;
            }
            return;
        }

        controls.clickTarget = ascendancyButton;
    };

    ascendancyButton.refresh = () => {
        const isHidden = ascendancyContainer.classList.contains("hidden");
        border.src = borderAssets.get(`asc_${isHidden ? "off" : "on"}`);

        let assetId = isHidden ? "can" : "yes";
        if (controls.ascendancy === "none") {
            assetId = "no";
        }
        indicator.src = indicatorAssets.get(assetId);

        ascendancyButton.classList.add("active");
        if (isHidden) {
            ascendancyButton.classList.remove("active");
        }
    };

    ascendancyButton.onmouseup = (event) => {
        if (event.button !== 0) {
            return;
        }

        if (controls.panning) {
            ascendancyButton.classList.remove("panning");
            return;
        }

        if (controls.clickTarget === ascendancyButton) {
            controls.clickTarget = undefined;

            if (controls.ascendancy !== "none") {
                ascendancyContainer.classList.toggle("hidden");
            }

            handleSimpleTooltip();
            ascendancyButton.refresh();
            handleViewport();
        }
    };

    updateAscendancyButton(ascendancyButton);

    talentTree.replaceChildren();

    for (const talent of talentNodes) {
        talentTree.append(generateTalentNode(talent));
    }
};

export const generateAscendancyTree = () => {
    for (const [ascendancy, nodes] of ascendancyNodes) {
        const tree = document.querySelector(`#${ascendancy}_tree`);
        tree.replaceChildren();

        for (const talent of nodes) {
            tree.append(generateTalentNode(talent));
        }
    }
};
