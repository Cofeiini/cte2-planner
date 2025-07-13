import { scaleValueToLevel } from "../core/algorithm.js";
import { ascendancyInfo, presetInfo, releaseInfo, sidePanel, totalAscendancy, totalGameChangers, totalStats, updatePresetInfo } from "../core/side-panel.js";
import { borderAssets, iconAssets, indicatorAssets } from "../data/assets.js";
import { controls } from "../data/constants.js";
import { ascendancySelections, ascendancyStartNodes, startingNode, talentSelections } from "../type/talent-node.js";
import { ascendancyContainer, generateDescriptionHTML, talentTree, viewport } from "./generating.js";

/** @type {HTMLCanvasElement} */
let lineCanvas = undefined;
export const updateLineCanvas = (element) => {
    lineCanvas = element;
};

/** @type {HTMLDivElement} */
let ascendancyButton = undefined;
export const updateAscendancyButton = (element) => {
    ascendancyButton = element;
};

export const handleViewport = () => {
    [
        lineCanvas,
        talentTree,
    ].forEach(item => {
        item.style.transform = `scale(${controls.zoom})`;
        item.style.left = `${controls.x}px`;
        item.style.top = `${controls.y}px`;
    });

    ascendancyButton.style.transform = `scale(calc(${controls.zoom} * ${parseFloat(ascendancyButton.getAttribute("base-scale"))}))`;
    ascendancyButton.style.left = `${controls.x + (viewport.center.x * controls.zoom)}px`;
    ascendancyButton.style.top = `${controls.y + (viewport.center.y * controls.zoom)}px`;

    ascendancyContainer.style.transform = `scale(${controls.zoom})`;
    ascendancyContainer.style.left = `${controls.x + ((viewport.center.x - Math.floor(ascendancyContainer.offsetWidth * 0.5)) * controls.zoom)}px`;
    ascendancyContainer.style.top = `${controls.y + ((viewport.center.y - ascendancyContainer.offsetHeight) * controls.zoom)}px`;
};

export const resetMessageBox = () => {
    document.querySelector("#message-box-title").innerText = "";
    document.querySelector("#message-box-content").replaceChildren();
    document.querySelector("#message-box-buttons").replaceChildren();
    document.querySelector("#message-overlay").classList.add("hidden");
};

/**
 * @param {Object} stat
 * @param {string} stat.description
 * @param {number[]} stat.values
 * @returns {HTMLDivElement}
 */
export const setUpStatContainer = (stat) => {
    let total = stat.values.reduce((accumulated, item) => accumulated + item, 0);
    if (stat["scale_to_lvl"]) {
        const level = parseInt(sidePanel.character.level.value);
        total = stat.values.reduce((accumulated, item) => accumulated + scaleValueToLevel(level, item), 0);
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
export const setUpIcon = (element) => {
    element.style.left = "50%";
    element.style.position = "absolute";
    element.style.top = "50%";
    element.style.transform = "translate(-50%, -50%)";
};

/**
 * @param {string} nodeId
 * @param {string} type
 * @returns {HTMLDivElement}
 */
export const setUpStatIcon = (nodeId, type = "major") => {
    const container = document.createElement("div");
    container.style.aspectRatio = "1/1";
    container.style.display = "flex";
    container.style.height = "80px";
    container.style.imageRendering = "pixelated";
    container.style.padding = "0.25em";
    container.style.position = "relative";
    container.style.userSelect = "none";

    const indicator = document.createElement("img");
    indicator.src = indicatorAssets.get("yes");
    indicator.width = 40;
    indicator.height = 40;
    setUpIcon(indicator);
    container.append(indicator);

    const border = document.createElement("img");
    border.src = borderAssets.get(`${type}_on`);
    border.width = 78;
    border.height = 78;
    if (type === "asc") {
        border.width = 68;
        border.height = 68;
    }
    setUpIcon(border);
    container.append(border);

    const icon = document.createElement("img");
    icon.src = iconAssets.get(nodeId);
    icon.width = 32;
    icon.height = 32;
    setUpIcon(icon);
    container.append(icon);

    return container;
};

export const setUpSeparator = () => {
    const separator = document.createElement("div");
    separator.classList.add("horizontal-line");
    separator.style.backgroundColor = "#384848";

    return separator;
};

/**
 * @param {Object} json
 */
export const setUpURL = (json = undefined) => {
    const talents = new Set(talentSelections.filter(item => item.identifier.number !== startingNode?.identifier.number).map(item => item.identifier.number).sort());
    const ascendancyStart = ascendancyStartNodes.get(ascendancyInfo);
    const ascendancy = new Set(ascendancySelections.filter(item => item.identifier.number !== ascendancyStart?.identifier.number).map(item => item.identifier.number).sort());

    updatePresetInfo(json || {
        version: releaseInfo.version,
        level: sidePanel.character.level.value,
        start: startingNode?.identifier.number,
        talents: Array.from(talents),
        ascendancy: {
            selection: ascendancyInfo,
            talents: Array.from(ascendancy),
        },
    });

    const url = new URL(location.href);
    url.searchParams.set("preset", btoa(JSON.stringify(presetInfo)));
    history.replaceState(null, "", url);
};

export const collectStatInformation = () => {
    const allNodes = [...talentSelections, ...ascendancySelections];

    totalGameChangers.clear();
    const majorSelections = allNodes.filter(item => item.type === "major" && item.parentTree === "main");
    for (const talent of majorSelections) {
        const gameChangerStats = new Map();
        for (const stat of talent.stats) {
            const key = stat["stat"];
            const type = stat["type"].toLowerCase();

            const valueList = [parseFloat(stat["v1"])];
            if (gameChangerStats.has(key)) {
                valueList.push(...gameChangerStats.get(key).values);
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

    totalAscendancy.clear();
    const majorAscendancy = allNodes.filter(item => (item.type === "major" || item.type === "asc") && item.parentTree !== "main");
    for (const talent of majorAscendancy) {
        const ascendancyStats = new Map();
        for (const stat of talent.stats) {
            const key = stat["stat"];

            const valueList = [parseFloat(stat["v1"])];
            if (ascendancyStats.has(key)) {
                valueList.push(...ascendancyStats.get(key).values);
            }

            ascendancyStats.set(key, {
                type: stat["type"].toLowerCase(),
                values: valueList,
                description: stat["description"],
                is_percent: stat["is_percent"],
                scale_to_lvl: stat["scale_to_lvl"],
            });
        }
        totalAscendancy.set(talent.identifier.talent, {
            id: talent.identifier.talent,
            name: talent.name,
            value: ascendancyStats,
            type: talent.type,
        });
    }

    totalStats.clear();
    const regularSelections = allNodes.filter(item => item.type !== "major");
    for (const talent of regularSelections) {
        for (const stat of talent.stats) {
            const key = stat["stat"];
            const type = stat["type"].toLowerCase();

            const valueList = [parseFloat(stat["v1"])];

            const valueMap = new Map();
            valueMap.set(type, {
                values: valueList,
                description: stat["description"],
                is_percent: stat["is_percent"],
                scale_to_lvl: stat["scale_to_lvl"],
            });

            if (!totalStats.has(key)) {
                totalStats.set(key, valueMap);
                continue;
            }

            if (totalStats.get(key).has(type)) {
                valueList.push(...totalStats.get(key).get(type).values);
            }

            totalStats.get(key).set(type, {
                values: valueList,
                description: stat["description"],
                is_percent: stat["is_percent"],
                scale_to_lvl: stat["scale_to_lvl"],
            });
        }
    }
};
