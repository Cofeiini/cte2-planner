import { scaleValueToLevel } from "../core/algorithm.js";
import { presetInfo, releaseInfo, sidePanel, totalGameChangers, totalStats, updatePresetInfo } from "../core/side-panel.js";
import { borderAssets, iconAssets, indicatorAssets } from "../data/assets.js";
import { controls } from "../data/constants.js";
import { startingNode, talentSelections } from "../type/talent-node.js";
import { generateDescriptionHTML, talentTree } from "./generating.js";

let lineCanvas = undefined;
export const updateLineCanvas = (element) => {
    lineCanvas = element;
};

export const handleViewport = () => {
    lineCanvas.style.left = `${controls.x}px`;
    lineCanvas.style.top = `${controls.y}px`;
    lineCanvas.style.transform = `scale(${controls.zoom})`;

    talentTree.style.left = `${controls.x}px`;
    talentTree.style.top = `${controls.y}px`;
    talentTree.style.transform = `scale(${controls.zoom})`;
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
export const setUpIcon = (element) => {
    element.style.left = "50%";
    element.style.position = "absolute";
    element.style.top = "50%";
    element.style.transform = "translate(-50%, -50%)";
};

/**
 * @param {string} nodeId
 * @returns {HTMLDivElement}
 */
export const setUpStatIcon = (nodeId) => {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.height = "80px";
    container.style.imageRendering = "pixelated";
    container.style.padding = "0.25em";
    container.style.pointerEvents = "none";
    container.style.position = "relative";
    container.style.userSelect = "none";
    container.style.width = "80px";

    const indicator = document.createElement("img");
    indicator.src = indicatorAssets.get("yes");
    indicator.width = 40;
    indicator.height = 40;
    setUpIcon(indicator);
    container.appendChild(indicator);

    const border = document.createElement("img");
    border.src = borderAssets.get("major_on");
    border.width = 78;
    border.height = 78;
    setUpIcon(border);
    container.appendChild(border);

    const icon = document.createElement("img");
    icon.src = iconAssets.get(nodeId);
    icon.width = 32;
    icon.height = 32;
    setUpIcon(icon);
    container.appendChild(icon);

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
    updatePresetInfo(json || {
        version: releaseInfo.version,
        level: sidePanel.character.level.value,
        start: startingNode?.identifier.number,
        talents: talentSelections.filter(item => item.identifier.number !== startingNode?.identifier.number).map(item => item.identifier.number).sort(),
    });

    const url = new URL(location.href);
    url.searchParams.set("preset", btoa(JSON.stringify(presetInfo)));
    history.replaceState(null, "", url);
};

export const collectStatInformation = () => {
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
