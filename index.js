import { RELEASES } from "./src/releases.js";
import { TalentNode } from "./src/talent-node.js";
import { BinaryHeap } from "./src/binary-heap.js";
import * as Constant from "./src/constants.js";
import * as Asset from "./src/assets.js";

const controls = {
    x: 0.0,
    y: 0.0,
    zoom: 1.0,
    panning: false,
    hovering: false,
    shouldRedraw: false,
    clickTarget: undefined,
};

const viewport = {
    width: 0,
    height: 0,
    max: 0,
};

const infoTooltip = {
    main: undefined,
    name: undefined,
    node: {
        count: undefined,
        text: undefined,
    },
    stats: undefined,
};

const sidePanel = {
    allocated: {
        points: undefined,
        start: undefined,
        major: undefined,
        special: undefined,
        stat: undefined,
        statList: undefined,
    },
};

let releaseInfo = undefined;
let presetInfo = undefined;

let drawingTimer = undefined;
let startingNode = undefined;

/** @type {TalentNode[][]} */
let talentGrid = [];

/** @type {TalentNode[]} */
let talentNodes = [];

/** @type {TalentNode[]} */
let talentSelections = [];

/** @type {TalentNode[]} */
let talentAddPreview = [];

/** @type {TalentNode[]} */
let talentAddLeftovers = [];

/** @type {TalentNode[]} */
let talentRemovePreview = [];

/** @type {Map<string, TalentNode[]>} */
const talentExclusions = new Map();

/** @type {Map<string, string[]>} */
const exclusiveNodeValues = new Map();

let TOTAL_POINTS = 0;

/** @type {Map<string, Object>} */
const totalStats = new Map();

/** @type {Map<string, Object>} */
const totalGameChangers = new Map();

/**
 * @param {CanvasRenderingContext2D} context
 * @param {TalentNode[]} collection
 * @param {TalentNode[]} excluded
 */
const drawLinesSimple = (context, collection, excluded = []) => {
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
const drawLinesComplex = (context, collection, optional = undefined) => {
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

const drawLinesInitial = () => {
    const canvas = document.querySelector("#line-canvas").offscreenCanvas;
    const context = canvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = false;

    context.fillStyle = "#191821";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "#222222";
    context.lineWidth = 10;
    drawLinesSimple(context, talentNodes);
    context.stroke();
};

const drawLinesRegular = () => {
    const canvas = document.querySelector("#line-canvas");
    const context = canvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = false;

    context.drawImage(canvas.offscreenCanvas, 0, 0);

    context.lineWidth = 10;

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

const handleViewport = () => {
    const lineCanvas = document.querySelector("#line-canvas");
    lineCanvas.style.left = `${controls.x}px`;
    lineCanvas.style.top = `${controls.y}px`;
    lineCanvas.style.transform = `scale(${controls.zoom})`;

    const tree = document.querySelector("#talent-tree");
    tree.style.left = `${controls.x}px`;
    tree.style.top = `${controls.y}px`;
    tree.style.transform = `scale(${controls.zoom})`;
};

/**
 * @param {TalentNode} node
 * @param {TalentNode[][]} paths
 * @param {Set<TalentNode>} collected
 */
const searchNodes = (node, paths, collected) => {
    const visited = new Set();

    const search = (current) => {
        visited.add(current.identifier.number);
        collected.add(current);

        for (const neighbor of current.neighbors) {
            if (visited.has(neighbor.identifier.number)) {
                continue;
            }

            if (!talentSelections.some(item => item.identifier.number === neighbor.identifier.number)) {
                continue;
            }

            if (paths.some(item => item.some(element => element.identifier.number === neighbor.identifier.number))) {
                continue;
            }

            search(neighbor);
        }
    };

    search(node);
};

/**
 * @param {TalentNode} start
 * @param {TalentNode} end
 * @param {TalentNode[]} currentPath
 * @param {TalentNode[][]} allPaths
 */
const findPaths = (start, end, currentPath, allPaths) => {
    const node = currentPath.at(-1);
    if (node.identifier.number === end.identifier.number) {
        allPaths.push(currentPath);
        return;
    }

    for (const neighbor of node.neighbors) {
        if (currentPath.some(item => item.identifier.number === neighbor.identifier.number)) {
            continue;
        }

        if (!talentSelections.some(item => item.identifier.number === neighbor.identifier.number)) {
            continue;
        }

        findPaths(start, end, [...currentPath, neighbor], allPaths);
    }
};

/**
 * @param {TalentNode} start
 * @param {TalentNode} target
 * @returns {TalentNode[]}
 */
const findDeadBranch = (start, target) => {
    if (!start) {
        return [];
    }

    const paths = [];
    findPaths(start, target, [start], paths);

    if (!paths.some(item => item.some(element => element.identifier.number === target.identifier.number))) {
        return [];
    }

    const nodesToRemove = new Set();
    searchNodes(target, paths, nodesToRemove);

    return Array.from(nodesToRemove);
};

/**
 * @param {TalentNode} start
 * @param {TalentNode} end
 * @returns {number}
 */
const findDistance = (start, end) => {
    const queue = [[start, 0]];
    const visited = new Set([start.identifier.number]);

    while (queue.length > 0) {
        const [node, distance] = queue.shift();
        if (node.identifier.number === end.identifier.number) {
            return distance;
        }

        for (const neighbor of node.neighbors) {
            if (visited.has(neighbor.identifier.number)) {
                continue;
            }
            visited.add(neighbor.identifier.number);
            queue.push([neighbor, distance + 1]);
        }
    }

    return 0;
};

const resetNodeHeuristics = () => {
    for (const talent of talentNodes) {
        talent.travel.source = undefined;
        talent.travel.closed = false;
        talent.travel.cost.total = Number.MAX_VALUE;
        talent.travel.cost.accumulated = 0;
        talent.travel.cost.heuristic = 0;
    }
};

/**
 * @param {TalentNode} start
 * @param {TalentNode} end
 * @returns {TalentNode[]}
 */
const algorithm = (start, end) => {
    resetNodeHeuristics();

    for (const node of talentExclusions.get("start")) {
        node.travel.closed = true;
    }

    const openHeap = new BinaryHeap();
    openHeap.push(start);
    start.travel.cost.heuristic = findDistance(start, end);

    while (openHeap.size() > 0) {
        const currentNode = openHeap.pop();

        if (currentNode.identifier.number === end.identifier.number) {
            const path = [currentNode];

            let temp = currentNode;
            while (temp.travel.source) {
                path.push(temp.travel.source);
                temp = temp.travel.source;
            }

            return path;
        }

        currentNode.travel.closed = true;
        for (const neighbor of currentNode.neighbors) {
            if (neighbor.travel.closed) {
                continue;
            }

            const accumulated = currentNode.travel.cost.accumulated + 1;
            const visited = neighbor.travel.closed;
            if (!visited || (accumulated < neighbor.travel.cost.accumulated)) {
                neighbor.travel.closed = true;
                neighbor.travel.source = currentNode;
                neighbor.travel.cost.heuristic = neighbor.travel.cost.heuristic || findDistance(neighbor, end);
                neighbor.travel.cost.accumulated = accumulated;
                neighbor.travel.cost.total = neighbor.travel.cost.accumulated + neighbor.travel.cost.heuristic;

                if (visited) {
                    openHeap.rescore(neighbor);
                } else {
                    openHeap.push(neighbor);
                }
            }
        }
    }

    return [];
};

/**
 * @param {TalentNode} target
 * @returns {TalentNode[]}
 */
const findShortestRoute = (target) => {
    /** @type {string[]} */
    const excluded = [];
    for (const values of exclusiveNodeValues.values()) {
        if (talentSelections.some(item => values.some(element => item.identifier.talent === element))) {
            excluded.push(...values);
        }
    }

    if (!startingNode) {
        excluded.push(...exclusiveNodeValues.get("start"));
    }

    if (excluded.some(item => item === target.identifier.talent)) {
        if (startingNode) {
            return [];
        }

        return [target];
    }

    const routeList = [];
    for (const start of talentSelections) {
        if (start.identifier.number === target.identifier.number) {
            continue;
        }

        routeList.push(algorithm(start, target));
    }

    let shortest = [];
    let min = viewport.max;
    for (const route of routeList) {
        if (route.length < min) {
            min = route.length;
            shortest = route;
        }
    }

    return shortest;
};

/**
 * @param {TalentNode} targetNode
 */
const findRoutes = (targetNode) => {
    /** @type {TalentNode[]} */
    let shortest = findShortestRoute(targetNode);

    resetNodeHeuristics();

    const allNodes = new Set();
    for (const node of talentSelections) {
        allNodes.add(node);
    }

    const possiblePoints = talentSelections.length + (shortest.length - 1); // Remember to offset by 1 because the array already has the starting node
    if (possiblePoints > TOTAL_POINTS) {
        if ((possiblePoints - TOTAL_POINTS) > shortest.length) {
            console.error("Actually too many points!");
            return;
        }

        const realPath = shortest.reverse().slice(0, TOTAL_POINTS - possiblePoints);
        talentAddLeftovers = shortest.slice(TOTAL_POINTS - possiblePoints - 1); // Offset by 1 to include the last selected node for forming a proper line segment
        shortest = realPath;
    }

    for (const node of shortest) {
        allNodes.add(node);
    }

    talentSelections = Array.from(allNodes);
};

/**
 * @param {string} description
 * @returns {string[]}
 */
const generateDescriptionHTML = (description) => {
    const results = [];
    const parts = description.split(/(§\w)/).filter(element => element);
    let color = Constant.colorMap.get("7");
    for (const part of parts) {
        if (part.startsWith("§")) {
            color = Constant.colorMap.get(part.at(1));
            continue;
        }

        const elements = [];
        const words = part.split(/\s/);
        for (const word of words) {
            elements.push(`<span class="word" style="color: ${color};">${word}</span>`);
        }
        results.push(elements.join("\u00A0"));
    }

    return results;
};

/**
 * @param {string} description
 * @param {number} value
 * @returns {HTMLDivElement}
 */
const setUpStatContainer = (description, value) => {
    const container = document.createElement("div");
    container.classList.add("panel-group-item");
    container.style.color = "white";
    container.innerHTML = `<p style="margin: 0;">${generateDescriptionHTML(description.replace("[VAL1]", value.toLocaleString("en", { signDisplay: "exceptZero" }))).flat().join("")}</p>`;

    return container;
};

/**
 * @param {HTMLElement} element
 */
const setUpIcon = (element) => {
    element.style.transform = "translate(-50%, -50%)";
    element.style.left = "50%";
    element.style.top = "50%";
    element.style.position = "absolute";
};

/**
 * @param {string} nodeId
 * @returns {HTMLDivElement}
 */
const setUpStatIcon = (nodeId) => {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.imageRendering = "pixelated";
    container.style.userSelect = "none";
    container.style.pointerEvents = "none";
    container.style.position = "relative";
    container.style.padding = "0.25em";
    container.style.width = "78px";
    container.style.height = "78px";

    const border = document.createElement("img");
    border.src = Asset.borderAssets.get("major_on");
    border.width = 78;
    border.height = 78;
    setUpIcon(border);
    container.appendChild(border);

    const indicator = document.createElement("img");
    indicator.src = Asset.indicatorAssets.get("yes");
    indicator.width = 40;
    indicator.height = 40;
    setUpIcon(indicator);
    container.appendChild(indicator);

    const icon = document.createElement("img");
    icon.src = Asset.iconAssets.get(nodeId);
    icon.width = 32;
    icon.height = 32;
    setUpIcon(icon);
    container.appendChild(icon);

    return container;
};

const setUpSeparator = () => {
    const separator = document.createElement("div");
    separator.classList.add("horizontal-line");
    separator.style.backgroundColor = "#384848";

    return separator;
};

const handleSidePanel = () => {
    sidePanel.allocated.points.innerText = `${talentSelections.length}`;
    sidePanel.allocated.start.innerText = `${talentSelections.filter(item => item.type === "start").length}`;
    sidePanel.allocated.major.innerText = `${talentSelections.filter(item => item.type === "major").length}`;
    sidePanel.allocated.special.innerText = `${talentSelections.filter(item => item.type === "special").length}`;
    sidePanel.allocated.stat.innerText = `${talentSelections.filter(item => item.type === "stat").length}`;

    const panelStatList = document.querySelector("#allocated-stat-list");
    panelStatList.classList.remove("hidden");
    if ((totalStats.size + totalGameChangers.size) === 0) {
        panelStatList.classList.add("hidden");
        return;
    }

    const totalStatList = Array.from(totalStats.values()).sort((a, b) => a.value - b.value);

    const attributeContainer = document.createElement("div");
    attributeContainer.classList.add("panel-group-item-container");
    attributeContainer.classList.add("hidden");
    const totalStatAttributes = totalStatList.filter(item => !item["is_percent"]);
    if (totalStatAttributes.length > 0) {
        attributeContainer.classList.remove("hidden");

        const attributesTitle = document.createElement("div");
        attributesTitle.classList.add("panel-group-title-small");
        attributesTitle.innerText = "Attributes";

        const attributeItems = [];
        for (const value of totalStatAttributes) {
            attributeItems.push(setUpStatContainer(value.description, value.value));
            attributeItems.push(setUpSeparator());
        }
        attributeItems.splice(-1);
        attributeContainer.replaceChildren(attributesTitle, ...attributeItems);
    }

    const statContainer = document.createElement("div");
    statContainer.classList.add("panel-group-item-container");
    statContainer.classList.add("hidden");
    const totalStatValues = totalStatList.filter(item => item["is_percent"]);
    if (totalStatValues.length > 0) {
        statContainer.classList.remove("hidden");

        const statsTitle = document.createElement("div");
        statsTitle.classList.add("panel-group-title-small");
        statsTitle.innerText = "Stats";

        const statItems = [];
        for (const value of totalStatValues) {
            statItems.push(setUpStatContainer(value.description, value.value));
            statItems.push(setUpSeparator());
        }
        statItems.splice(-1);
        statContainer.replaceChildren(statsTitle, ...statItems);
    }

    const gameChangerContainer = document.createElement("div");
    gameChangerContainer.classList.add("panel-group-item-container");
    gameChangerContainer.classList.add("hidden");
    if (totalGameChangers.size > 0) {
        gameChangerContainer.classList.remove("hidden");

        const mainTitle = document.createElement("div");
        mainTitle.classList.add("panel-group-title-small");
        mainTitle.innerText = "Game Changers";

        const gameChangerItems = [];
        const gameChangerList = [...totalGameChangers.values()].sort((a, b) => a.name.localeCompare(b.name));
        for (const value of gameChangerList) {
            const itemContainer = document.createElement("div");
            itemContainer.style.display = "flex";
            itemContainer.style.padding = "0.5em";
            itemContainer.style.gap = "1.0em";

            itemContainer.appendChild(setUpStatIcon(value.id));

            const statsContainer = document.createElement("div");
            statsContainer.style.display = "flex";
            statsContainer.style.flexDirection = "column";
            statsContainer.style.width = "100%";
            statsContainer.style.textAlign = "left";
            statsContainer.style.fontSize = "small";

            const title = document.createElement("div");
            title.innerText = value.name;
            title.style.color = "white";
            title.style.fontWeight = "bold";
            statsContainer.appendChild(title);

            for (const stat of value.value.values()) {
                statsContainer.appendChild(setUpStatContainer(stat.description, stat.value));
            }
            itemContainer.appendChild(statsContainer);
            gameChangerItems.push(itemContainer);
            gameChangerItems.push(setUpSeparator());
        }
        gameChangerItems.splice(-1);
        gameChangerContainer.replaceChildren(mainTitle, ...gameChangerItems);
    }

    sidePanel.allocated.statList.replaceChildren(attributeContainer, statContainer, gameChangerContainer);
};

/**
 * @param {Object | undefined} json
 */
const setUpURL = (json = undefined) => {
    presetInfo = json || {
        version: releaseInfo.version,
        talents: talentSelections.filter(item => item.identifier.number !== startingNode?.identifier.number).map(item => item.identifier.number).sort(),
        start: startingNode?.identifier.number,
    };

    const url = new URL(location.href);
    url.searchParams.set("preset", btoa(JSON.stringify(presetInfo)));
    history.replaceState(null, "", url);
};

/**
 * @param {TalentNode} node
 * @param {boolean} isPreset
 */
const toggleNode = (node, isPreset = false) => {
    const isClassNode = exclusiveNodeValues.get("start").includes(node.identifier.talent);
    if (!startingNode && !isClassNode) {
        return;
    }

    if (!node.selected) {
        for (const values of exclusiveNodeValues.values()) {
            const existingSelection = talentSelections.find(item => values.includes(item.identifier.talent));
            if (existingSelection && values.includes(node.identifier.talent)) {
                return;
            }
        }
    }

    node.selected = !node.selected;

    if (node.selected) {
        if ((talentSelections.length + (talentAddPreview.length - 1)) > TOTAL_POINTS) {
            node.selected = false;
        }

        if (node.selected) {
            if (!isPreset && startingNode && talentSelections.length > 0) {
                findRoutes(node);
            } else if (!startingNode || !exclusiveNodeValues.get("start").some(item => item === node.identifier.talent)) {
                talentSelections.push(node);
            }

            if (!startingNode && isClassNode) {
                startingNode = node;
            }
        }
    } else {
        const deadBranch = findDeadBranch(startingNode, node);

        for (const talent of deadBranch) {
            talent.selected = false;
        }

        talentSelections = talentSelections.filter(item => item.selected);

        for (const talent of deadBranch) {
            talent.update();
        }

        for (const neighbor of node.neighbors) {
            neighbor.update();
        }

        if (startingNode?.identifier.number === node.identifier.number) {
            startingNode = undefined;
        }
    }

    for (const talent of talentSelections) {
        talent.selected = true;
        talent.update();

        for (const neighbor of talent.neighbors) {
            neighbor.update();
        }
    }

    totalGameChangers.clear();
    const majorSelections = talentSelections.filter(item => item.type === "major");
    for (const talent of majorSelections) {
        const gameChangerStats = new Map();
        for (const stat of talent.stats) {
            const key = stat["stat"];
            const type = stat["type"].toLowerCase();

            let value = parseFloat(stat["v1"]);
            if (gameChangerStats.has(key)) {
                value += totalStats.get(key).value;
            }
            gameChangerStats.set(key, {
                type: type,
                value: value,
                description: stat["description"],
                is_percent: stat["is_percent"],
            });
        }
        totalGameChangers.set(talent.identifier.talent, {
            id: talent.identifier.talent,
            name: talent.name,
            value: gameChangerStats,
        });
    }

    totalStats.clear();
    const regularSelections = talentSelections.filter(item => item.type !== "major");
    for (const talent of regularSelections) {
        for (const stat of talent.stats) {
            const key = stat["stat"];
            const type = stat["type"].toLowerCase();

            let value = parseFloat(stat["v1"]);
            if (totalStats.has(key)) {
                value += totalStats.get(key).value;
            }
            totalStats.set(key, {
                type: type,
                value: value,
                description: stat["description"],
                is_percent: stat["is_percent"],
            });
        }
    }

    handleSidePanel();

    if (!isPreset) {
        setUpURL();
    }

    document.querySelector("#talent-points").innerText = `${TOTAL_POINTS - talentSelections.length}`;
};

const handleCanvas = () => {
    viewport.width = talentGrid.at(0).length * Constant.CELL_SIZE;
    viewport.height = talentGrid.length * Constant.CELL_SIZE;
    viewport.max = Math.max(talentGrid.length, talentGrid.at(0).length);

    const tree = document.querySelector("#talent-tree");
    tree.style.width = `${viewport.width}px`;
    tree.style.height = `${viewport.height}px`;

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
 * @param {MouseEvent} event
 */
const mouseDrag = (event) => {
    event.preventDefault();

    if (!controls.panning) {
        const distance = Math.pow(event.movementX, 2) + Math.pow(event.movementY, 2);
        if (distance < 4) {
            return;
        }
    }

    controls.panning = true;
    controls.x = controls.x + event.movementX;
    controls.y = controls.y + event.movementY;

    handleViewport();
};

/**
 * @param {TalentNode} current
 * @param {TalentNode[]} route
 * @returns {talentNodes[]}
 */
const generatePath = (current, route) => {
    const path = [];
    for (let y = -1; y <= 1; ++y) {
        for (let x = -1; x <= 1; ++x) {
            if (x === 0 && y === 0) {
                continue;
            }

            const node = talentGrid.at(current.y + y)?.at(current.x + x);
            if (!node) {
                continue;
            }

            if (route.some(item => item.identifier.number === node.identifier.number)) {
                continue;
            }

            if (node.selectable) {
                path.push({
                    node: node,
                    steps: route.length,
                });
                continue;
            }

            if (node.identifier.talent === current.identifier.talent) {
                generatePath(node, [...route, node]).forEach(item => path.push({
                    node: item,
                    steps: route.length + 1,
                }));
            }
        }
    }

    if (path.length === 0) {
        return [];
    }

    let steps = Number.MAX_VALUE;
    for (const item of path) {
        if (item.steps < steps) {
            steps = item.steps;
        }
    }

    return path.filter(item => item.steps <= steps).map(item => item.node);
};

/**
 * @param {string} data
 */
const generateTalentGrid = (data) => {
    talentGrid = [];
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

    talentNodes = [];
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

    handleCanvas();
};

const handleLoadingImageAssets = async () => {
    const progress = document.querySelector("#progress");

    progress.innerText = "Processing assets...";
    const promises = [];
    const tasks = {
        started: 0,
        completed: 0,
    };

    for (const key of Asset.borderAssets.keys()) {
        if (Asset.borderAssets.get(key)) {
            continue;
        }

        promises.push(fetch(`assets/textures/gui/skill_tree/borders/${key}.png`).then(response => response.blob()).then(bitmap => {
            Asset.borderAssets.set(key, URL.createObjectURL(bitmap));
            progress.innerText = `Processing assets...\n${++tasks.completed} of ${tasks.started} done.`;
        }));
    }

    for (const key of Asset.indicatorAssets.keys()) {
        if (Asset.indicatorAssets.get(key)) {
            continue;
        }

        promises.push(fetch(`assets/textures/gui/skill_tree/indic/${key}.png`).then(response => response.blob()).then(bitmap => {
            Asset.indicatorAssets.set(key, URL.createObjectURL(bitmap));
            progress.innerText = `Processing assets...\n${++tasks.completed} of ${tasks.started} done.`;
        }));
    }

    await fetch(`data/${releaseInfo.version}/perks.json`).then(response => response.json()).then(data => {
        const requested = new Set();
        for (const node of talentNodes) {
            let key = node.identifier.talent;

            const json = data.find(item => item.id === key);
            if (!json) {
                continue;
            }

            node.type = json.type.toLowerCase(); // This should be one of these: start, major, special, stat
            node.stats = json.stats;
            node.identifier.data = json.id;
            if (node.type === "stat" || node.type === "special") {
                if (node.stats.length === 1) {
                    node.identifier.data = node.stats.at(0)["stat"];
                }
            }

            const oneKind = json["one_kind"];
            if (oneKind) {
                const exclusiveList = [node.identifier.talent];
                if (exclusiveNodeValues.has(oneKind)) {
                    exclusiveList.push(...exclusiveNodeValues.get(oneKind));
                }
                exclusiveNodeValues.set(oneKind, exclusiveList);
            }

            if (requested.has(node.identifier.talent)) {
                continue;
            }
            requested.add(node.identifier.talent);

            if (Asset.iconAssets.has(node.identifier.talent)) {
                continue;
            }

            let path = "textures/gui/stat_icons";
            if (json.icon.length > 1) {
                const match = json.icon.match(/mmorpg:([\w/]+)\/(\w+).png/);
                if (match[2] !== key) {
                    key = match[2];
                }
                path = match[1];
            }

            promises.push(fetch(`assets/${path}/${key}.png`).then(response => response.blob()).then(bitmap => {
                Asset.iconAssets.set(node.identifier.talent, URL.createObjectURL(bitmap));
                progress.innerText = `Processing assets...\n${++tasks.completed} of ${tasks.started} done.`;
            }).catch(error => {
                Asset.iconAssets.set(node.identifier.talent, Asset.iconAssets.get("missing"));
                console.error(node.identifier.talent, error);
            }));
        }
    });

    tasks.started = promises.length;
    await Promise.all(promises);
};

const handleLoadingAssets = async () => {
    const progress = document.querySelector("#progress");

    if (!Asset.iconAssets.has("default")) {
        progress.innerText = "Processing fallback assets...";
        await fetch(`assets/textures/gui/stat_icons/default.png`).then(response => response.blob()).then(bitmap => {
            Asset.iconAssets.set("default", URL.createObjectURL(bitmap));
        });
    }

    if (!Asset.iconAssets.has("missing")) {
        await fetch(`assets/textures/gui/stat_icons/missing.png`).then(response => response.blob()).then(bitmap => {
            Asset.iconAssets.set("missing", URL.createObjectURL(bitmap));
        });
    }

    progress.innerText = "Processing the talent tree...";
    await fetch(`data/${releaseInfo.version}/talents_new.csv`).then(response => response.text()).then(data => {
        generateTalentGrid(data);
    });

    await handleLoadingImageAssets();

    for (const [key, values] of exclusiveNodeValues) {
        talentExclusions.set(key, talentNodes.filter(item => values.includes(item.identifier.talent)));
    }

    progress.innerText = "Processing talent descriptions...";
    const descriptionData = {};
    await fetch(`data/${releaseInfo.version}/lang/en_us.json`).then(response => response.json()).then(data => {
        Object.assign(descriptionData, data);
        progress.innerText = `Processing talent descriptions...\n${1} of ${2} done.`;
    });
    await fetch(`data/${releaseInfo.version}/lang/override/en_us.json`).then(response => response.json()).then(data => {
        Object.assign(descriptionData, data);
        progress.innerText = `Processing talent descriptions...\n${2} of ${2} done.`;
    });

    let overrideData = {};
    await fetch(`data/${releaseInfo.version}/overrides.json`).then(response => response.json()).then(data => {
        overrideData = data;
    });

    const tasks = {
        started: 0,
        completed: 0,
    };
    progress.innerText = "Processing talent details...";
    const statData = new Map();
    await fetch(`data/${releaseInfo.version}/stats.json`).then(response => response.json().then(data => {
        tasks.started = talentNodes.reduce((accumulated, item) => accumulated + item.stats.length, 0);
        progress.innerText = `Processing talent details...\n${tasks.completed} of ${tasks.started} done.`;
        for (const node of talentNodes) {
            for (const stat of node.stats) {
                progress.innerText = `Processing talent details...\n${++tasks.completed} of ${tasks.started} done.`;

                const identifier = stat["stat"];
                let json = data.find(item => (item.id === identifier) || (item.data?.id === identifier));
                const type = stat["type"].toLowerCase();
                if (!json) {
                    json = {
                        is_perc: node.type !== "special",
                    };
                }
                json["is_perc"] = json["is_perc"] || ((type === "percent") || (type === "more"));
                json["description"] = descriptionData[`mmorpg.stat.${identifier}`].replaceAll(/§\w/g, "");

                if (overrideData[identifier]) {
                    Object.assign(json, overrideData[identifier]);
                }

                let newData = new Map([[identifier, json]]);
                if (statData.has(node.identifier.talent)) {
                    newData = new Map([...newData, ...statData.get(node.identifier.talent)]);
                }
                statData.set(node.identifier.talent, newData);
            }
        }
    }));

    const statNodeList = talentNodes.filter(item => item.type === "stat" || item.type === "special");
    for (const node of statNodeList) {
        node.name = descriptionData[`mmorpg.stat.${node.identifier.data}`];
        if (!node.name) {
            node.name = descriptionData[`mmorpg.stat.${node.stats.at(0)["stat"]}`];
            if (!node.name) {
                console.error(node.identifier.talent, node.identifier.data, node.type, "not found!");
            }
        }
    }

    const talentNodeList = talentNodes.filter(item => item.type === "start" || item.type === "major");
    for (const node of talentNodeList) {
        node.name = descriptionData[`mmorpg.talent.${node.identifier.data}`];
        if (!node.name) {
            console.error(node.identifier.talent, node.identifier.data, node.type, "not found!");
        }
    }

    for (const node of talentNodes) {
        const isStat = node.type === "stat" || node.type === "special";
        const isPerk = node.type === "start" || node.type === "major";

        const nodeData = statData.get(node.identifier.talent);
        const moreStats = node.stats.filter(item => item.type.toLowerCase() === "more");
        node.stats = node.stats.filter(item => item.type.toLowerCase() !== "more").concat(...moreStats);

        for (let i = 0; i < node.stats.length; ++i) {
            const item = node.stats.at(i);
            const value = parseFloat(item["v1"]);

            const info = nodeData.get(item["stat"]);
            const isPercent = (info["is_perc"] ?? info["data"]?.["perc"]) ?? true;
            const isMinusGood = info["minus_is_good"] ?? false;
            const isScaled = item["scale_to_lvl"] ?? false;
            const isFormat = (info["format"] ?? false) || isStat || (isPerk && (Math.abs(value) > 1));

            // const trueValue = value * (isScaled ? 100.0 : 1.0);
            if (isScaled) {
                console.log("Scaled value", info, node);
            }

            let description = descriptionData[`mmorpg.stat.${item["stat"]}`].replaceAll(/\\u(\w{4})/gi, (match, p1) => String.fromCharCode(parseInt(p1, 16))).replaceAll(/(§\w)\1+/g, "$1");
            if (!description.includes("[VAL1]") && isFormat) {
                const valueColor = (((value > 0) && !isMinusGood) || ((value < 0) && isMinusGood)) ? "§a" : "§c";
                description = `${valueColor}[VAL1]${isPercent ? "%" : ""}§7 ${description}`;
            }

            item["is_percent"] = isPercent;
            item["description"] = description;

            item["description_html"] = generateDescriptionHTML(description.replace("[VAL1]", value.toLocaleString("en", { signDisplay: "exceptZero" }))).flat().join("");
        }

        switch (node.type) {
            case "start": {
                node.keywords.push("start");
                break;
            }
            case "major": {
                node.keywords.push("game_changer");
                break;
            }
            case "special": {
                node.keywords.push("special");
                break;
            }
            case "stat": {
                node.keywords.push("stat");
                break;
            }
        }
    }

    progress.innerText = "Processing done.";
};

/**
 * @param {InputEvent} event
 */
const handleSearch = (event) => {
    const filter = event.target.value.trim().toLowerCase();
    const altFilter = filter.replaceAll(" ", "_");
    if (filter.length === 0) {
        for (const node of talentNodes) {
            node.visual.classList.remove("filtered", "highlighted");
        }
        return;
    }

    for (const node of talentNodes) {
        node.visual.classList.add("filtered");
        node.visual.classList.remove("highlighted");

        const isNameMatch = node.name.toLowerCase().includes(filter) || node.name.toLowerCase().includes(altFilter);
        const isIdMatch = node.identifier.talent.includes(filter) || node.identifier.talent.includes(altFilter);
        const isKeywordMatch = node.keywords.includes(filter) || node.keywords.includes(altFilter);
        const isStatMatch = node.stats.some(item => item.stat.includes(filter) || item.description.toLowerCase().includes(filter) || item.stat.includes(altFilter));

        if (isNameMatch || isIdMatch || isKeywordMatch || isStatMatch) {
            node.visual.classList.remove("filtered");
            node.visual.classList.add("highlighted");
        }
    }
};

const handleEvents = () => {
    const container = document.querySelector("#talent-container");

    container.oncontextmenu = () => {
        return false;
    };

    container.onwheel = (event) => {
        event.preventDefault();

        const oldZoom = controls.zoom;
        const change = Math.pow(1 + controls.zoom, Math.sign(event.deltaY) * -0.25);
        controls.zoom = Math.min(Math.max(controls.zoom * change, 0.2), 3.0);

        const zoomRatio = controls.zoom / oldZoom;
        controls.x = event.clientX - ((event.clientX - controls.x) * zoomRatio);
        controls.y = event.clientY - ((event.clientY - controls.y) * zoomRatio);

        if (controls.zoom !== oldZoom) {
            handleViewport();
        }
    };

    container.onmousedown = (event) => {
        event.preventDefault();

        if (event.button !== 0) {
            return;
        }

        document.querySelector("#talent-container").style.cursor = "grabbing";
        container.addEventListener("mousemove", mouseDrag);
    };

    container.onmouseup = (event) => {
        event.preventDefault();

        if (event.button !== 0) {
            return;
        }

        controls.panning = false;
        document.querySelector("#talent-container").style.cursor = null;
        if (controls.hovering) {
            infoTooltip.main.classList.remove("invisible");
        }

        container.removeEventListener("mousemove", mouseDrag);
    };
};

/**
 * @param {TalentNode} talent
 */
const handleTooltip = (talent) => {
    let nodeTotal = 0;
    if (talent.selected) {
        const previewNeighbors = talentSelections.filter(item => talent.neighbors.some(element => item.identifier.number === element.identifier.number));
        talentRemovePreview = [...findDeadBranch(startingNode, talent), ...previewNeighbors];
        nodeTotal = -(talentRemovePreview.length - previewNeighbors.length);
    } else {
        talentAddPreview = findShortestRoute(talent);
        nodeTotal = talentAddPreview.length;
        if (talentAddPreview.length > 1) {
            nodeTotal = talentAddPreview.length - 1;
        }
    }

    infoTooltip.name.innerText = talent.name;
    infoTooltip.name.style.color = (talent.type === "major") ? Constant.colorMap.get("5") : Constant.colorMap.get("f");
    infoTooltip.node.count.innerText = nodeTotal.toLocaleString("en", { signDisplay: "exceptZero" });
    infoTooltip.node.text.innerText = `Node${(Math.abs(nodeTotal) === 1) ? "" : "s"}`;

    const formatted = [];
    for (const stat of talent.stats) {
        let bullet = "";
        if (stat.type.toLowerCase() !== "more") {
            bullet = `<span style="color: purple;">&#9670;</span>`;
        }
        formatted.push(`<div style="display: flex;">${bullet}<p style="display: inline-block; margin: 0;">${stat["description_html"]}</p></div>`);
    }
    if (talent.type === "major") {
        formatted.push(`<p style="margin: 0;"><span style="color: red;">Game Changer Talent</span></p>`);
    }
    infoTooltip.stats.innerHTML = formatted.join("");

    infoTooltip.main.classList.remove("invisible");
    infoTooltip.main.classList.add("visible");
};

/**
 * @param {TalentNode} talent
 * @param {HTMLDivElement} container
 */
const handleTalentEvents = (talent, container) => {
    container.onmouseenter = () => {
        controls.hovering = true;

        if (controls.panning) {
            return;
        }

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

        talentRemovePreview = [];
        talentAddPreview = [];

        clearTimeout(drawingTimer);
        if (controls.shouldRedraw) {
            drawingTimer = setTimeout(() => {
                controls.shouldRedraw = false;
                drawLinesRegular();
            }, 80);
        }
    };

    const bounds = document.querySelector("#talent-container").getBoundingClientRect();
    container.onmousemove = (event) => {
        const tooltipBounds = infoTooltip.main.getBoundingClientRect();

        infoTooltip.main.style.left = `${event.clientX + 20}px`;
        infoTooltip.main.style.top = `${Math.min(event.clientY + 20, bounds.height - tooltipBounds.height)}px`;
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
                talentAddPreview = talentAddLeftovers;
            } else {
                talentRemovePreview = [];
            }
            drawLinesRegular();
        }
    };
};

const generateTree = () => {
    const treeContainer = document.querySelector("#talent-tree");
    treeContainer.replaceChildren();

    for (const talent of talentNodes) {
        const container = document.createElement("div");
        container.classList.add("talent-node");
        container.style.left = `${talent.center.x}px`;
        container.style.top = `${talent.center.y}px`;

        const border = document.createElement("img");
        border.classList.add("talent-node-border");
        border.src = Asset.borderAssets.get(`${talent.type}_off`);
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

        const indicator = document.createElement("img");
        indicator.classList.add("talent-node-indicator");
        indicator.src = Asset.indicatorAssets.get("no");
        indicator.width = 40;
        indicator.height = 40;
        setUpIcon(indicator);
        container.appendChild(indicator);

        const icon = document.createElement("img");
        icon.classList.add("talent-node-icon");
        icon.src = Asset.iconAssets.get(talent.identifier.talent);
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

            border.src = Asset.borderAssets.get(`${talent.type}_${talent.selected ? "on" : "off"}`);
            indicator.src = Asset.indicatorAssets.get(assetId);
        };

        talent.visual = container;
        treeContainer.appendChild(container);
    }
};

const handleLoading = async () => {
    const loading = document.querySelector("#loading");
    loading.classList.remove("invisible");

    let shouldLoadAssets = true;
    try {
        presetInfo = JSON.parse(atob(new URLSearchParams(location.search).get("preset")));

        const initialLoading = releaseInfo === undefined;
        if (!releaseInfo) {
            const overrideInfo = RELEASES.find(item => item.version === presetInfo.version);
            if (overrideInfo) {
                releaseInfo = overrideInfo;
            } else {
                releaseInfo = RELEASES.at(0);
            }
        }

        shouldLoadAssets = initialLoading || (presetInfo.version !== releaseInfo.version);
    } catch (_error) {
        releaseInfo = RELEASES.at(0);
        presetInfo = {
            version: releaseInfo.version,
            start: undefined,
            talents: [],
        };
    }

    // Check these just in case some of the imported data is missing
    if (!presetInfo) {
        presetInfo = {};
    }
    if (!presetInfo.version) {
        presetInfo["version"] = releaseInfo.version;
    }
    if (!presetInfo.start) {
        presetInfo["start"] = undefined;
    }
    if (!presetInfo.start || !presetInfo.talents) {
        presetInfo["talents"] = [];
    }

    const points = releaseInfo.points;
    TOTAL_POINTS = points.starting + points.leveling + points.questing;
    document.querySelector("#talent-points").innerText = `${TOTAL_POINTS}`;

    if (shouldLoadAssets) {
        await handleLoadingAssets();

        handleEvents();
        generateTree();
    }

    for (const talent of talentSelections) {
        toggleNode(talent, true);
    }

    if (presetInfo.start) {
        toggleNode(talentExclusions.get("start").find(item => item.identifier.number === presetInfo.start), true);
        for (const id of presetInfo.talents) {
            toggleNode(talentNodes.find(item => item.identifier.number === id), true);
        }
    }

    drawLinesRegular();
    handleViewport();

    document.querySelector("#progress").innerText = "Done.";
    loading.classList.add("invisible");
};

/**
 * @param {HTMLSelectElement} select
 */
const handleVersionOptions = (select) => {
    const latest = RELEASES.at(0).version;
    for (const option of select.childNodes) {
        option.style.color = "white";
        option.innerText = option.value;
        if (option.value === latest) {
            option.innerText += " (latest)";
        }
    }

    select.style.color = "white";
    if (select.value !== latest) {
        select.style.color = "red";

        const option = select.childNodes[select.selectedIndex];
        option.innerText = `${option.value} (outdated)`;
        option.style.color = "red";
    }
};

const resetMessageBox = () => {
    document.querySelector("#message-box-title").innerText = "";
    document.querySelector("#message-box-content").replaceChildren();
    document.querySelector("#message-box-buttons").replaceChildren();
    document.querySelector("#message-overlay").classList.add("hidden");
};

/**
 * @returns {HTMLButtonElement}
 */
const setUpCancelButton = () => {
    const button = document.createElement("button");
    button.innerText = "Cancel";
    button.classList.add("custom-button");
    button.onclick = (mouse) => {
        if (mouse.button !== 0) {
            return;
        }

        resetMessageBox();
    };

    return button;
};

/**
 * @param {string[]} textList
 * @returns {HTMLDivElement}
 */
const setUpMessageBox = (textList) => {
    const content = document.createElement("div");
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.height = "100%";
    content.style.gap = "1.0em";

    const message = document.createElement("div");
    message.style.display = "flex";
    message.style.flexDirection = "column";
    message.style.width = "100%";
    message.style.height = "100%";
    message.style.fontSize = "larger";
    message.style.gap = "0.5em";
    content.appendChild(message);

    message.replaceChildren(...textList.map(item => {
        const element = document.createElement("div");
        element.innerText = item;
        return element;
    }));

    return content;
};

/**
 * @param {InputEvent} event
 */
const handleVersionChange = async (event) => {
    const shouldConfirm = (releaseInfo.version !== event.target.value);
    releaseInfo = RELEASES.find(item => item.version === event.target.value);

    if ((shouldConfirm || (releaseInfo.version !== presetInfo.version)) && (talentSelections.length > 0)) {
        const content = setUpMessageBox([
            "You are attempting to load a different version of the talent tree than what your preset is made for.",
            "This tool will attempt to convert the data, but the process might fail or have strange results.",
            "Are you sure you want to proceed?",
        ]);

        const buttons = document.querySelector("#message-box-buttons");

        const proceedButton = document.createElement("button");
        proceedButton.innerText = "Proceed";
        proceedButton.classList.add("custom-button");
        proceedButton.onclick = async (mouse) => {
            if (mouse.button !== 0) {
                return;
            }

            resetMessageBox();

            presetInfo.version = releaseInfo.version;
            setUpURL();
            handleVersionOptions(event.target);

            await handleLoading();
        };
        buttons.appendChild(proceedButton);

        const cancelButton = document.createElement("button");
        cancelButton.innerText = "Cancel";
        cancelButton.classList.add("custom-button");
        cancelButton.onclick = (mouse) => {
            if (mouse.button !== 0) {
                return;
            }

            document.querySelector("#version-select").value = presetInfo.version;
            handleVersionOptions(event.target);

            resetMessageBox();
        };
        buttons.appendChild(cancelButton);

        document.querySelector("#message-box-title").innerText = `Loading talent tree version ${releaseInfo.version}`;
        document.querySelector("#message-box-content").replaceChildren(content);

        document.querySelector("#message-overlay").classList.remove("hidden");

        return;
    }

    presetInfo.version = releaseInfo.version;
    setUpURL();
    handleVersionOptions(event.target);

    await handleLoading();
};

const handleDataImport = () => {
    const content = setUpMessageBox([
        "You can import a build that was exported in JSON format by this tool.",
    ]);

    const footer = document.createElement("div");
    footer.classList.add("hidden");
    footer.style.display = "flex";
    footer.style.width = "100%";
    footer.style.justifyContent = "center";
    footer.style.color = "red";
    footer.fontSize = "larger";
    footer.innerText = "An error occurred while reading the data. Make sure it's valid and correctly formatted.";
    content.appendChild(footer);

    const input = document.createElement("textarea");
    input.placeholder = "Paste JSON data here...";
    input.rows = 20;
    input.style.backgroundColor = "darkslategray";
    input.style.color = "white";
    content.appendChild(input);

    const buttons = [];

    const importFileInput = document.createElement("input");
    importFileInput.type = "file";
    importFileInput.classList.add("hidden");
    importFileInput.onchange = (event) => {
        const reader = new FileReader();
        reader.onload = () => {
            input.value = reader.result.toString();
            input.dispatchEvent(new Event("input"));
        };
        reader.readAsText(event.target.files[0]);
    };
    buttons.push(importFileInput);

    const importFile = document.createElement("button");
    importFile.innerText = "Import JSON File";
    importFile.classList.add("custom-button");
    importFile.onclick = (mouse) => {
        if (mouse.button !== 0) {
            return;
        }

        importFileInput.click();
    };
    buttons.push(importFile);

    const importTooltip = "You need to add some JSON before importing.";
    const importButton = document.createElement("button");
    importButton.innerText = "Import JSON";
    importButton.classList.add("custom-button");
    importButton.disabled = true;
    importButton.title = importTooltip;
    importButton.onclick = async (mouse) => {
        if (mouse.button !== 0) {
            return;
        }

        let json = {};
        try {
            json = JSON.parse(input.value);
        } catch (error) {
            console.error(error);
            footer.classList.remove("hidden");
            return;
        }

        if (!json.version || !RELEASES.some(item => item.version === json.version)) {
            footer.classList.remove("hidden");
            return;
        }

        releaseInfo = RELEASES.find(item => item.version === json.version);
        const versionSelect = document.querySelector("#version-select");
        versionSelect.value = json.version;
        handleVersionOptions(versionSelect);
        setUpURL(json);

        resetMessageBox();

        await handleLoading();
    };
    buttons.push(importButton);
    buttons.push(setUpCancelButton());

    input.oninput = () => {
        footer.classList.add("hidden");
        const hasData = input.value.length > 0;
        importButton.disabled = !hasData;
        importButton.title = hasData ? "" : importTooltip;
    };

    document.querySelector("#message-box-title").innerText = "Import your build";
    document.querySelector("#message-box-content").replaceChildren(content);
    document.querySelector("#message-box-buttons").replaceChildren(...buttons);

    document.querySelector("#message-overlay").classList.remove("hidden");
};

const handleDataExport = () => {
    const content = setUpMessageBox([
        "You can export a build in JSON format.",
    ]);

    const input = document.createElement("textarea");
    input.readOnly = true;
    input.rows = 20;
    input.style.backgroundColor = "darkslategray";
    input.style.color = "white";
    input.value = JSON.stringify(presetInfo, null, 4);
    content.appendChild(input);

    const buttons = [];

    const clipboardButton = document.createElement("button");
    clipboardButton.innerText = "Export to Clipboard";
    clipboardButton.classList.add("custom-button");
    clipboardButton.onclick = async (mouse) => {
        if (mouse.button !== 0) {
            return;
        }

        await navigator.clipboard.writeText(JSON.stringify(presetInfo, null, 4));

        resetMessageBox();
    };
    buttons.push(clipboardButton);

    const exportButton = document.createElement("button");
    exportButton.innerText = "Export to File";
    exportButton.classList.add("custom-button");
    exportButton.onclick = (mouse) => {
        if (mouse.button !== 0) {
            return;
        }

        const file = new Blob([JSON.stringify(presetInfo, null, 4)], { type: "application/json;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(file);
        link.download = `CtE2Planner_${new Date().toISOString().replace(/\..+$/, "").replaceAll(/\D/g, "")}.json`;
        link.click();
        link.remove();

        resetMessageBox();
    };
    buttons.push(exportButton);
    buttons.push(setUpCancelButton());

    document.querySelector("#message-box-title").innerText = "Export your build";
    document.querySelector("#message-box-content").replaceChildren(content);
    document.querySelector("#message-box-buttons").replaceChildren(...buttons);

    document.querySelector("#message-overlay").classList.remove("hidden");
};

window.onload = async () => {
    infoTooltip.main = document.querySelector("#info-tooltip");
    infoTooltip.name = document.querySelector("#info-name");
    infoTooltip.node.count = document.querySelector("#info-node-count");
    infoTooltip.node.text = document.querySelector("#info-node-text");
    infoTooltip.stats = document.querySelector("#info-stats");

    sidePanel.allocated.points = document.querySelector("#allocated-points");
    sidePanel.allocated.start = document.querySelector("#allocated-start");
    sidePanel.allocated.major = document.querySelector("#allocated-major");
    sidePanel.allocated.special = document.querySelector("#allocated-special");
    sidePanel.allocated.stat = document.querySelector("#allocated-stat");
    sidePanel.allocated.statList = document.querySelector("#allocated-stat-list");

    const latest = RELEASES.at(0).version;
    const versionSelect = document.querySelector("#version-select");
    for (const release of RELEASES) {
        const option = document.createElement("option");
        option.value = release.version;
        option.innerText = release.version;
        versionSelect.appendChild(option);
    }
    versionSelect.value = latest;
    versionSelect.onchange = handleVersionChange;
    handleVersionOptions(versionSelect);

    document.querySelector("#import-button").onclick = handleDataImport;
    document.querySelector("#export-button").onclick = handleDataExport;

    const search = document.querySelector("#talent-search");
    search.value = "";
    search.oninput = handleSearch;

    const searchInfo = document.querySelector("#talent-search-info");
    searchInfo.onmouseenter = () => {
        infoTooltip.name.innerText = "Search options";
        infoTooltip.name.style.color = "white";
        infoTooltip.node.count.classList.add("hidden");
        infoTooltip.node.text.classList.add("hidden");

        const keywords = new Set();
        for (const talent of talentNodes) {
            for (const key of talent.keywords) {
                keywords.add(key);
            }
        }
        const tooltip = [
            `<p style="margin: 0 0 0.5em 0;">You can search talents or stats by name or description.</p>`,
            `<p style="margin: 0">The following keywords are recognized:</p>`,
            `<ul style="margin: 0;">${Array.from(keywords).sort().map(item => `<li>${item}</li>`).join("")}</ul>`,
        ];
        infoTooltip.stats.innerHTML = tooltip.join("");

        infoTooltip.main.classList.remove("invisible");
        infoTooltip.main.classList.add("visible");
    };
    searchInfo.onmouseleave = () => {
        infoTooltip.node.count.classList.remove("hidden");
        infoTooltip.node.text.classList.remove("hidden");
        infoTooltip.main.classList.remove("visible");
        infoTooltip.main.classList.add("invisible");
    };
    searchInfo.onmousemove = (event) => {
        infoTooltip.main.style.left = `${event.clientX + 20}px`;
        infoTooltip.main.style.top = `${event.clientY + 20}px`;
    };

    await handleLoading();
};
