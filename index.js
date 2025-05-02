import { findDeadBranch, findRoutes, findShortestRoute, generateTalentGrid } from "./src/core/algorithms.js";
import { borderAssets, iconAssets, indicatorAssets } from "./src/data/assets.js";
import { colorMap, controls } from "./src/data/constants.js";
import { drawLinesRegular } from "./src/core/drawing.js";
import { RELEASES } from "./src/releases.js";
import {
    exclusiveNodeValues,
    startingNode,
    talentAddLeftovers,
    talentAddPreview,
    talentExclusions,
    talentNodes,
    talentRemovePreview,
    talentSelections,
    TOTAL_POINTS,
    updatePoints,
    updateStartingNode,
} from "./src/core/talent-node.js";

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
    character: {
        level: undefined,
        levelLabel: undefined,
    },
};

let releaseInfo = undefined;
let presetInfo = undefined;

let drawingTimer = undefined;

/** @type {Map<string, Object>} */
const totalStats = new Map();

/** @type {Map<string, Object>} */
const totalGameChangers = new Map();

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
 * @param {string} description
 * @returns {string}
 */
const generateDescriptionHTML = (description) => {
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

/**
 * @param {number} level
 * @param {number} value
 * @returns {number}
 */
const scaleValueToLevel = (level, value) => {
    if (value > 1.0) {
        value = 4;
        if (level > 1) {
            value = 4 + level;
        }
    } else {
        value = 1 + (0.2 * (level - 1)) + Math.min(Math.max(0, level - 71), 5);
        if (level > 71) {
            value = 15.0 + Math.floor((level - 71) / 5.0);
        }
    }

    return value;
};

/**
 * @param {Object} stat
 * @param {string} stat.description
 * @param {number[]} stat.values
 * @returns {HTMLDivElement}
 */
const setUpStatContainer = (stat) => {
    let total = stat.values.reduce((accumulated, item) => accumulated + item, 0);
    if (stat["scale_to_lvl"]) {
        total = stat.values.reduce((accumulated, item) => accumulated + scaleValueToLevel(parseInt(sidePanel.character.level.value), item), 0);
    }

    const container = document.createElement("div");
    container.classList.add("panel-group-item");
    container.style.color = "white";
    const description = stat.description.replace("[VAL1]", total.toLocaleString("en", { signDisplay: "exceptZero" }));
    container.innerHTML = `<p style="margin: 0;">${generateDescriptionHTML(description)}</p>`;

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
    border.src = borderAssets.get("major_on");
    border.width = 78;
    border.height = 78;
    setUpIcon(border);
    container.appendChild(border);

    const indicator = document.createElement("img");
    indicator.src = indicatorAssets.get("yes");
    indicator.width = 40;
    indicator.height = 40;
    setUpIcon(indicator);
    container.appendChild(indicator);

    const icon = document.createElement("img");
    icon.src = iconAssets.get(nodeId);
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

    const totalStatList = Array.from(totalStats.values());

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
        for (const stat of totalStatAttributes) {
            attributeItems.push(setUpStatContainer(stat));
        }
        attributeItems.sort((a, b) => parseFloat(a.innerText.match(/[\d.]+/)[0]) - parseFloat(b.innerText.match(/[\d.]+/)[0]));

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
        for (const stat of totalStatValues) {
            statItems.push(setUpStatContainer(stat));
        }
        statItems.sort((a, b) => parseFloat(a.innerText.match(/[\d.]+/)[0]) - parseFloat(b.innerText.match(/[\d.]+/)[0]));

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
        for (const gameChanger of gameChangerList) {
            const itemContainer = document.createElement("div");
            itemContainer.style.display = "flex";
            itemContainer.style.padding = "0.5em";
            itemContainer.style.gap = "1.0em";

            itemContainer.appendChild(setUpStatIcon(gameChanger.id));

            const statsContainer = document.createElement("div");
            statsContainer.style.display = "flex";
            statsContainer.style.flexDirection = "column";
            statsContainer.style.width = "100%";
            statsContainer.style.textAlign = "left";
            statsContainer.style.fontSize = "small";

            const title = document.createElement("div");
            title.innerText = gameChanger.name;
            title.style.color = "white";
            title.style.fontWeight = "bold";
            statsContainer.appendChild(title);

            for (const stat of gameChanger.value.values()) {
                statsContainer.appendChild(setUpStatContainer(stat));
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
        level: sidePanel.character.level.value,
        start: startingNode?.identifier.number,
        talents: talentSelections.filter(item => item.identifier.number !== startingNode?.identifier.number).map(item => item.identifier.number).sort(),
    };

    const url = new URL(location.href);
    url.searchParams.set("preset", btoa(JSON.stringify(presetInfo)));
    history.replaceState(null, "", url);
};

const collectStatInformation = () => {
    totalGameChangers.clear();
    const majorSelections = talentSelections.filter(item => item.type === "major");
    for (const talent of majorSelections) {
        const gameChangerStats = new Map();
        for (const stat of talent.stats) {
            const key = stat["stat"];
            const type = stat["type"].toLowerCase();

            const valueList = [parseFloat(stat["v1"])];
            if (gameChangerStats.has(key)) {
                valueList.push(...totalStats.get(key).values);
            }
            gameChangerStats.set(key, {
                type: type,
                values: valueList,
                description: stat["description"],
                is_percent: stat["is_percent"],
                scale_to_lvl: stat["scale_to_lvl"],
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

            const valueList = [parseFloat(stat["v1"])];
            if (totalStats.has(key)) {
                valueList.push(...totalStats.get(key).values);
            }
            totalStats.set(key, {
                type: type,
                values: valueList,
                description: stat["description"],
                is_percent: stat["is_percent"],
                scale_to_lvl: stat["scale_to_lvl"],
            });
        }
    }
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
                updateStartingNode(node);
            }
        }
    } else {
        const deadBranch = findDeadBranch(startingNode, node);

        for (const talent of deadBranch) {
            talent.selected = false;
        }

        talentSelections.length = 0;
        talentSelections.push(...talentSelections.filter(item => item.selected));

        for (const talent of deadBranch) {
            talent.update();
        }

        for (const neighbor of node.neighbors) {
            neighbor.update();
        }

        if (startingNode?.identifier.number === node.identifier.number) {
            updateStartingNode(undefined);
        }
    }

    for (const talent of talentSelections) {
        talent.selected = true;
        talent.update();

        for (const neighbor of talent.neighbors) {
            neighbor.update();
        }
    }

    collectStatInformation();

    handleSidePanel();

    if (!isPreset) {
        setUpURL();
    }

    document.querySelector("#talent-points").innerText = `${TOTAL_POINTS - talentSelections.length}`;
};

/**
 * @param {MouseEvent} event
 */
const handleMouseDrag = (event) => {
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

const handleLoadingImageAssets = async () => {
    const progress = document.querySelector("#progress");

    progress.innerText = "Processing assets...";
    const promises = [];
    const tasks = {
        started: 0,
        completed: 0,
    };

    for (const key of borderAssets.keys()) {
        if (borderAssets.get(key)) {
            continue;
        }

        promises.push(fetch(`assets/textures/gui/skill_tree/borders/${key}.png`).then(response => response.blob()).then(bitmap => {
            borderAssets.set(key, URL.createObjectURL(bitmap));
            progress.innerText = `Processing assets...\n${++tasks.completed} of ${tasks.started} done.`;
        }));
    }

    for (const key of indicatorAssets.keys()) {
        if (indicatorAssets.get(key)) {
            continue;
        }

        promises.push(fetch(`assets/textures/gui/skill_tree/indic/${key}.png`).then(response => response.blob()).then(bitmap => {
            indicatorAssets.set(key, URL.createObjectURL(bitmap));
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

            if (iconAssets.has(node.identifier.talent)) {
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
                iconAssets.set(node.identifier.talent, URL.createObjectURL(bitmap));
                progress.innerText = `Processing assets...\n${++tasks.completed} of ${tasks.started} done.`;
            }).catch(error => {
                iconAssets.set(node.identifier.talent, iconAssets.get("missing"));
                console.error(node.identifier.talent, error);
            }));
        }
    });

    tasks.started = promises.length;
    await Promise.all(promises);
};

const handleLoadingAssets = async () => {
    const progress = document.querySelector("#progress");

    if (!iconAssets.has("default")) {
        progress.innerText = "Processing fallback assets...";
        await fetch(`assets/textures/gui/stat_icons/default.png`).then(response => response.blob()).then(bitmap => {
            iconAssets.set("default", URL.createObjectURL(bitmap));
        });
    }

    if (!iconAssets.has("missing")) {
        await fetch(`assets/textures/gui/stat_icons/missing.png`).then(response => response.blob()).then(bitmap => {
            iconAssets.set("missing", URL.createObjectURL(bitmap));
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
    });
    await fetch(`data/${releaseInfo.version}/lang/override/en_us.json`).then(response => response.json()).then(data => {
        Object.assign(descriptionData, data);
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
                const identifier = stat["stat"];
                let json = data.find(item => (item.id === identifier) || (item.data?.id === identifier));
                if (!json) {
                    json = {
                        is_perc: node.type !== "special",
                    };
                }
                const type = stat["type"].toLowerCase();
                json["is_perc"] = (json["data"]?.["perc"] ?? json["is_perc"]) || ((type === "percent") || (type === "more"));
                json["description"] = descriptionData[`mmorpg.stat.${identifier}`].replaceAll(/§\w/g, "");

                if (overrideData[identifier]) {
                    Object.assign(json, overrideData[identifier]);
                }

                let newData = new Map([[identifier, json]]);
                if (statData.has(node.identifier.talent)) {
                    newData = new Map([...newData, ...statData.get(node.identifier.talent)]);
                }
                statData.set(node.identifier.talent, newData);

                progress.innerText = `Processing talent details...\n${++tasks.completed} of ${tasks.started} done.`;
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
            const isPercent = (info["data"]?.["perc"] ?? info["is_perc"]) ?? true;
            const isMinusGood = info["minus_is_good"] ?? false;
            const isScaled = item["scale_to_lvl"] ?? false;
            const isFormat = info["format"] ?? (isStat || (isPerk && (Math.abs(value) > 1)));

            let description = descriptionData[`mmorpg.stat.${item["stat"]}`].replaceAll(/\\u(\w{4})/gi, (match, p1) => String.fromCharCode(parseInt(p1, 16)));
            if (!description.includes("[VAL1]") && isFormat) {
                const valueColor = (((value > 0) && !isMinusGood) || ((value < 0) && isMinusGood)) ? "§a" : "§c";
                description = `${valueColor}[VAL1]${isPercent ? "%" : ""}§7 ${description}`;
            }

            item["scale_to_lvl"] = isScaled;
            item["is_percent"] = isPercent;
            item["description"] = description;
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

        container.style.cursor = "grabbing";
        container.addEventListener("mousemove", handleMouseDrag);
    };

    container.onmouseup = (event) => {
        event.preventDefault();

        if (event.button !== 0) {
            return;
        }

        controls.panning = false;
        container.style.cursor = null;
        if (controls.hovering) {
            infoTooltip.main.classList.remove("invisible");
        }

        container.removeEventListener("mousemove", handleMouseDrag);
    };

    const viewport = document.querySelector("#viewport-container");
    const bounds = viewport.getBoundingClientRect();

    viewport.oncontextmenu = () => {
        return false;
    };

    viewport.onmousemove = (event) => {
        const tooltipBounds = infoTooltip.main.getBoundingClientRect();
        infoTooltip.main.style.left = `${event.clientX + 20}px`;
        infoTooltip.main.style.top = `${Math.min(event.clientY + 20, bounds.height - tooltipBounds.height)}px`;
    };
};

/**
 * @param {TalentNode} talent
 */
const handleTooltip = (talent) => {
    let nodeTotal = 0;
    if (talent.selected) {
        const previewNeighbors = talentSelections.filter(item => talent.neighbors.some(element => item.identifier.number === element.identifier.number));
        talentRemovePreview.length = 0;
        talentRemovePreview.push(...findDeadBranch(startingNode, talent), ...previewNeighbors);
        nodeTotal = -(talentRemovePreview.length - previewNeighbors.length);
    } else {
        talentAddPreview.length = 0;
        talentAddPreview.push(...findShortestRoute(talent));
        nodeTotal = talentAddPreview.length;
        if (talentAddPreview.length > 1) {
            nodeTotal = talentAddPreview.length - 1;
        }
    }

    infoTooltip.name.innerText = talent.name;
    infoTooltip.name.style.color = (talent.type === "major") ? colorMap.get("5") : colorMap.get("f");
    infoTooltip.node.count.innerText = nodeTotal.toLocaleString("en", { signDisplay: "exceptZero" });
    infoTooltip.node.text.innerText = `Node${(Math.abs(nodeTotal) === 1) ? "" : "s"}`;

    const level = parseInt(sidePanel.character.level.value);
    const formatted = [];
    for (const stat of talent.stats) {
        let bullet = "";
        if (stat.type.toLowerCase() !== "more") {
            bullet = `<span style="color: purple;">&#9670;</span>`;
        }

        let value = parseFloat(stat["v1"]);
        if (stat["scale_to_lvl"]) {
            value = scaleValueToLevel(level, value);
        }
        const description = stat["description"].replace("[VAL1]", value.toLocaleString("en", { signDisplay: "exceptZero" }));
        formatted.push(`<div style="display: flex;">${bullet}<p style="display: inline-block; margin: 0;">${generateDescriptionHTML(description)}</p></div>`);
    }
    if (talent.type === "major") {
        formatted.push(`<span style="color: red;">Game Changer Talent</span>`);
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

        const indicator = document.createElement("img");
        indicator.classList.add("talent-node-indicator");
        indicator.src = indicatorAssets.get("no");
        indicator.width = 40;
        indicator.height = 40;
        setUpIcon(indicator);
        container.appendChild(indicator);

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
        treeContainer.appendChild(container);
    }
};

const handleLoading = async () => {
    const progress = document.querySelector("#progress");
    progress.innerText = "Processing...";

    const loading = document.querySelector("#loading");
    loading.classList.remove("invisible", "hidden");

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
            level: 100,
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
    if (!presetInfo.level) {
        presetInfo["level"] = 100;
    }
    if (!presetInfo.start) {
        presetInfo["start"] = undefined;
    }
    if (!presetInfo.start || !presetInfo.talents) {
        presetInfo["talents"] = [];
    }

    const points = releaseInfo.points;
    updatePoints(points.starting + points.leveling + points.questing);
    document.querySelector("#talent-points").innerText = `${TOTAL_POINTS}`;

    sidePanel.character.level.value = presetInfo.level;
    sidePanel.character.levelLabel.innerText = presetInfo.level;

    if (shouldLoadAssets) {
        await handleLoadingAssets();
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

    progress.innerText = "Done.";
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

    sidePanel.character.levelLabel = document.querySelector("#player-level-label");
    sidePanel.character.level = document.querySelector("#player-level");
    sidePanel.character.level.oninput = (event) => {
        sidePanel.character.levelLabel.innerText = event.target.value;
        setUpURL();
        handleSidePanel();
    };

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

    const loading = document.querySelector("#loading");
    loading.ontransitionend = () => {
        loading.classList.add("hidden");
    };

    handleEvents();

    await handleLoading();
};
