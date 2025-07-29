import { generateAscendancyPath, generatePath } from "../core/algorithm.js";
import { handleTooltip, infoTooltip, tooltipOffsets } from "../core/tooltip.js";
import { borderAssets, iconAssets, indicatorAssets } from "../data/assets.js";
import { CELL_HALF, CELL_SIZE, colorMap, controls, RAD_TO_DEG } from "../data/constants.js";
import {
    ascendancyAddLeftovers,
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
} from "../type/talent-node.js";
import { drawLinesAscendancy, drawLinesAscendancyInitial, drawLinesInitial, drawLinesRegular } from "./drawing.js";
import { setUpIcon } from "./spuddling.js";

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
export let viewportContainer = undefined;
export const updateViewportContainer = (element) => {
    viewportContainer = element;
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

/** @type {HTMLDivElement} */
export let canvasContainer = undefined;
export const updateCanvasContainer = (element) => {
    canvasContainer = element;
};

/** @type {HTMLDivElement} */
export let talentContainer = undefined;
export const updateTalentContainer = (element) => {
    talentContainer = element;
};

export const boundingRects = {
    containers: {
        /** @type {DOMRect}*/
        viewport: undefined,
        /** @type {DOMRect}*/
        canvas: undefined,
        /** @type {DOMRect}*/
        talent: undefined,
        /** @type {DOMRect}*/
        ascendancy: undefined,
    },
    trees: {
        /** @type {DOMRect}*/
        talent: undefined,
        /** @type {Map<string, DOMRect>}*/
        ascendancy: new Map(),
    },
    tooltip: {
        /** @type {DOMRect}*/
        main: undefined,
    },
};
export const refreshBoundingRects = () => {
    boundingRects.containers.canvas = canvasContainer.getBoundingClientRect();
    boundingRects.containers.talent = talentContainer.getBoundingClientRect();
    boundingRects.containers.viewport = viewportContainer.getBoundingClientRect();
    boundingRects.containers.ascendancy = ascendancyTreeContainer.getBoundingClientRect();

    boundingRects.trees.talent = talentTree.getBoundingClientRect();
    const ascendancyOptions = new Set(talentExclusions.get("ascendancy").map(item => item.identifier.talent));
    for (const ascendancy of ascendancyOptions) {
        boundingRects.trees.ascendancy.set(ascendancy, ascendancyTreeContainer.querySelector(`#${ascendancy}_tree`).getBoundingClientRect());
    }
};

export let fittedZoom = 1.0;
export const updateFittedZoom = () => {
    refreshBoundingRects();
    const viewportBounds = boundingRects.containers.viewport;
    const canvasContainerBounds = boundingRects.containers.canvas;
    fittedZoom = Math.max(viewportBounds.width / canvasContainerBounds.width, viewportBounds.height / canvasContainerBounds.height);
};

/**
 * @typedef {HTMLDivElement} CustomAscendancyButton
 * @property {function} refresh
 */
/** @type {CustomAscendancyButton} */
export let ascendancyButton = undefined;
export const updateAscendancyButton = (element) => {
    ascendancyButton = element;
};

/** @type {HTMLDivElement} */
export let ascendancyMenu = undefined;
export const updateAscendancyMenu = (element) => {
    ascendancyMenu = element;
};

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
        const words = part.split(/\s/).filter(element => element);
        for (const word of words) {
            elements.push(`<span class="word" style="color: ${color};">${word}</span>`);
        }
        results.push(elements.join(""));
    }

    return results.flat(Infinity).join("");
};

export const generateCanvas = () => {
    viewport.width = (viewport.offset.right - viewport.offset.left) * CELL_SIZE;
    viewport.height = (viewport.offset.bottom - viewport.offset.top) * CELL_SIZE;

    talentTree.style.height = `${viewport.height}px`;
    talentTree.style.width = `${viewport.width}px`;
    talentTree.style.left = "50%";
    talentTree.style.top = "50%";

    canvasContainer.style.width = `${viewport.width * 2.0}px`;
    canvasContainer.style.height = `${viewport.height * 2.0}px`;

    let centerNode = {
        center: {
            x: (viewport.width * 0.5),
            y: (viewport.height * 0.5),
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

    viewport.center.x = (viewport.width * 0.5) + centerNode.center.x;
    viewport.center.y = (viewport.height * 0.5) + centerNode.center.y;

    const container = talentContainer.getBoundingClientRect();
    controls.x = viewport.center.x - (container.width * 0.5);
    controls.y = viewport.center.y - (container.height * 0.5);

    /** @type {CustomLineCanvas} */
    const canvas = document.querySelector("#line-canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.left = "50%";
    canvas.style.top = "50%";
    canvas.style.transform = "translate(-50%, -50%)";

    canvas.offscreenCanvas = document.createElement("canvas");
    canvas.offscreenCanvas.width = viewport.width;
    canvas.offscreenCanvas.height = viewport.height;

    drawLinesInitial();
};

export const generateAscendancyCanvas = () => {
    /** @type {CustomAscendancyCanvas} */
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

    const topBarHeight = 44;
    ascendancyContainer.style.width = `${bounds.width}px`;
    ascendancyContainer.style.height = `${bounds.height + topBarHeight}px`;
    ascendancyContainer.style.left = `${((viewport.center.x - Math.floor(bounds.width * 0.5)))}px`;
    ascendancyContainer.style.top = `${((viewport.center.y - (bounds.height + topBarHeight)))}px`;

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
    let draw = drawLinesRegular;
    let addPreview = talentAddPreview;
    let leftovers = talentAddLeftovers;
    let removePreview = talentRemovePreview;

    if (talent?.parentTree !== "main") {
        draw = drawLinesAscendancy;
        addPreview = ascendancyAddPreview;
        leftovers = ascendancyAddLeftovers;
        removePreview = ascendancyRemovePreview;
    }

    container.onmouseenter = () => {
        controls.hovering = true;

        if (controls.panning) {
            return;
        }

        infoTooltip.node.count.classList.remove("hidden");
        infoTooltip.node.text.classList.remove("hidden");
        handleTooltip(talent);

        infoTooltip.arrow.style.left = `${tooltipOffsets.pointer + Math.floor(tooltipOffsets.arrow * 2.5)}px`;
        infoTooltip.arrow.style.top = `${tooltipOffsets.pointer - Math.floor(tooltipOffsets.arrow * 0.5)}px`;
        infoTooltip.arrow.style.transform = `translate(-50%, -50%) rotate(225deg)`;

        draw();
    };

    container.onmouseleave = () => {
        controls.hovering = false;

        infoTooltip.container.classList.remove("visible");

        const previewNodes = [
            ...talentTree.querySelectorAll(".preview-add, .preview-remove"),
            ...ascendancyTreeContainer.querySelector(".ascendancy-tree:not(.hidden)")?.querySelectorAll(".preview-add, .preview-remove") ?? [],
        ];
        for (const item of previewNodes) {
            item.classList.remove("preview-add", "preview-remove");
        }

        addPreview.clear();
        removePreview.clear();
        leftovers.clear();

        draw();
    };

    container.onmousemove = (event) => {
        if (controls.panning) {
            infoTooltip.container.classList.remove("visible");
            return;
        }

        const containerBounds = infoTooltip.container.getBoundingClientRect();
        const contentBounds = boundingRects.tooltip.main;

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
            return;
        }

        if (controls.clickTarget === container) {
            controls.clickTarget = undefined;

            document.querySelectorAll(".preview-add, .preview-remove").forEach(item => {
                item.classList.remove("preview-add", "preview-remove");
            });

            toggleNode(talent);

            removePreview.clear();
            addPreview.clear();

            handleTooltip(talent);

            draw();
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
    indicator.src = indicatorAssets.get("no");
    indicator.width = 40;
    indicator.height = 40;
    setUpIcon(indicator);
    container.append(indicator);

    const border = document.createElement("img");
    border.loading = "lazy";
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
    container.style.width = `${border.width}px`;
    container.style.height = `${border.height}px`;
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

        let assetId = "no";
        if (talent.selected) {
            assetId = "yes";
            container.classList.add("active");
        } else {
            let isExcluded = false;
            for (const values of exclusiveNodeValues.nodes.values()) {
                const existingSelection = selections.some(item => item.exclusive && values.includes(item.identifier.talent));
                if (existingSelection && values.includes(talent.identifier.talent)) {
                    isExcluded = true;
                    break;
                }
            }

            if (!isExcluded && talent.neighbors.some(item => item.selected) && (selections.length < totalPoints)) {
                assetId = "can";
            }
        }

        const borderSource = borderAssets.get(`${talent.type}_${talent.selected ? "on" : "off"}`);
        if (border.src !== borderSource) {
            border.src = borderSource;
        }

        const indicatorSource = indicatorAssets.get(assetId);
        if (indicator.src !== indicatorSource) {
            indicator.src = indicatorSource;
        }
    };

    talent.visual = container;

    return container;
};

export const generateAscendancyMenu = () => {
    const isActive = controls.ascendancy !== "none";

    ascendancyMenu.replaceChildren();
    const selector = document.querySelector("#ascendancy-select");
    for (const option of selector.children) {
        const item = document.createElement("div");
        item.style.userSelect = "none";
        item.innerText = option.innerText;
        item.onmousedown = (event) => {
            if (event.button !== 0) {
                return;
            }

            selector.value = option.value;
            selector.dispatchEvent(new Event("change"));

            ascendancyMenu.classList.add("hidden");
        };
        ascendancyMenu.append(item);
    }

    ascendancyButton.replaceChildren();
    ascendancyButton.classList.add("talent-node");
    ascendancyButton.style.pointerEvents = "auto";
    ascendancyButton.style.left = `${viewport.center.x}px`;
    ascendancyButton.style.top = `${viewport.center.y}px`;

    const indicator = document.createElement("img");
    indicator.loading = "lazy";
    indicator.src = indicatorAssets.get(isActive ? "yes" : "can");
    indicator.width = 40;
    indicator.height = 40;
    setUpIcon(indicator);
    ascendancyButton.append(indicator);

    const border = document.createElement("img");
    border.loading = "lazy";
    border.src = borderAssets.get(`asc_${isActive ? "on" : "off"}`);
    border.width = 64;
    border.height = 64;
    setUpIcon(border);
    ascendancyButton.style.width = `${border.width}px`;
    ascendancyButton.style.height = `${border.height}px`;
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

        let text = "Choose an Ascendancy first";
        if (controls.ascendancy !== "none") {
            text = `${isHidden ? "Show" : "Hide"} the Ascendancy menu`;
        }
        infoTooltip.stats.innerHTML = [
            `<p style="margin: 0;">Left click toggles the menu and right click lets you quickly change Ascendancy.</p>`,
            `<p style="color: red; margin: 0;">${text}</p>`,
        ].join("");

        infoTooltip.container.classList.add("visible");
    };

    ascendancyButton.onmouseenter = () => {
        controls.hovering = true;

        if (controls.panning) {
            return;
        }

        handleSimpleTooltip();
    };

    ascendancyButton.onmouseleave = () => {
        controls.hovering = false;

        infoTooltip.container.classList.remove("visible");
    };

    ascendancyButton.onmousedown = (event) => {
        if (event.button !== 0) {
            if (event.button === 2) {
                ascendancyMenu.classList.remove("hidden");

                const bounds = boundingRects.containers.talent;
                const menuBounds = ascendancyMenu.getBoundingClientRect();

                ascendancyMenu.style.left = `${event.clientX}px`;
                ascendancyMenu.style.top = `${Math.min(event.clientY, bounds.height - menuBounds.height - 3)}px`;
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
        event.preventDefault();

        if (event.button !== 0) {
            return;
        }

        if (controls.panning) {
            return;
        }

        if (controls.clickTarget === ascendancyButton) {
            controls.clickTarget = undefined;

            if ((controls.ascendancy !== "none") && !ascendancyContainer.classList.toggle("hidden")) {
                const tree = ascendancyTreeContainer.querySelector(`#${controls.ascendancy}_tree`);
                boundingRects.trees.ascendancy.set(controls.ascendancy, tree.getBoundingClientRect());
                boundingRects.containers.ascendancy = ascendancyTreeContainer.getBoundingClientRect();
            }

            handleSimpleTooltip();
            ascendancyButton.refresh();
        }
    };
};

export const generateTree = () => {
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
