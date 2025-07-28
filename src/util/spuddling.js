import { scaleValueToLevel } from "../core/algorithm.js";
import { ascendancyInfo, presetInfo, releaseInfo, sidePanel, totalAscendancy, totalGameChangers, totalStats, updatePresetInfo } from "../core/side-panel.js";
import { borderAssets, iconAssets, indicatorAssets } from "../data/assets.js";
import { controls } from "../data/constants.js";
import { ascendancySelections, ascendancyStartNodes, fullNodeList, startingNode, talentSelections } from "../type/talent-node.js";
import { canvasContainer, generateDescriptionHTML, talentContainer } from "./generating.js";

export const handleViewport = () => {
    canvasContainer.style.transform = `scale(${controls.zoom})`;
    talentContainer.scroll(controls.x, controls.y);
};

export const resetMessageBox = () => {
    document.querySelector("#message-box-title").innerText = "";
    document.querySelector("#message-box-content").replaceChildren();
    document.querySelector("#message-box-buttons").replaceChildren();
    document.querySelector("#message-overlay").classList.add("hidden");
};

/**
 * @param {Object} stat
 */
export const calculateStatTotal = (stat) => {
    let flat = 0.0;
    let percent = 0.0;
    let more = 1.0;
    for (const value of stat["values"]) {
        if (value["type"] === "percent") {
            percent += value["v1"];
            continue;
        }

        if (value["type"] === "more") {
            more *= 1 + (value["v1"] * 0.01);
            continue;
        }

        flat += value["v1"];
    }

    const base = 100.0;
    const final = (base + flat) * (1 + (percent * 0.01)) * more;
    return ((final - base) / base) * 100.0;
};

/**
 * @param {Object} stat
 * @returns {HTMLDivElement}
 */
export const setUpStatContainer = (stat) => {
    /** @type {number} */
    let total = stat["total"];
    if (total === undefined) {
        total = calculateStatTotal(stat);
    }

    const isMinusGood = stat["minus_is_good"];
    let valueColor = "§c";
    if ((total > 0) && !isMinusGood) {
        valueColor = "§a";
    } else if ((total < 0) && isMinusGood) {
        valueColor = "§a";
    }

    const percentText = stat["is_percent"] ? "%" : "";

    let moreText = "";
    if (stat["type"] === "more") {
        moreText = "§cLess";
        if (total > 0) {
            moreText = "§aMore";
        }
    }

    /** @type {string} */
    const description = stat["description"].replace(/\[VAL1]%?/, `${valueColor}${total.toLocaleString("en", { signDisplay: "exceptZero" })}${percentText}${moreText}`);

    const container = document.createElement("div");
    container.classList.add("panel-group-item");
    container.style.color = "white";
    container.innerHTML = `<p style="display: inline-block; margin: 0;">${generateDescriptionHTML(description)}</p>`;
    container.dataset.sign = isMinusGood ? "-1.0" : "1.0";

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
    indicator.loading = "lazy";
    indicator.src = indicatorAssets.get("yes");
    indicator.width = 40;
    indicator.height = 40;
    setUpIcon(indicator);
    container.append(indicator);

    const border = document.createElement("img");
    border.loading = "lazy";
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
    icon.loading = "lazy";
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
    const level = parseInt(sidePanel.character.level.value);

    const processValue = (stat) => {
        const value = {
            v1: parseFloat(stat["v1"]),
            type: stat["type"].toLowerCase(),
        };

        if (stat["scale_to_lvl"]) {
            value["v1"] = scaleValueToLevel(level, value["v1"]);
        }

        return value;
    };

    const appendTotalStats = (stat) => {
        const key = stat["stat"];
        const type = stat["type"].toLowerCase();

        /** @type {Map<string, Object>} */
        const valueMap = totalStats.get(key) ?? new Map();
        valueMap.set(type, {
            type: type,
            values: [processValue(stat), ...(valueMap.get(type)?.values ?? [])],
            description: stat["description"],
            is_percent: stat["is_percent"],
            scale_to_lvl: stat["scale_to_lvl"],
            minus_is_good: stat["minus_is_good"],
        });

        totalStats.set(key, valueMap);
    };

    const allStats = new Set(fullNodeList.filter(item => (item.type !== "major")).map(item => item.stats.map(stat => stat["stat"])).flat(Infinity));
    const allNodes = [...talentSelections, ...ascendancySelections];

    totalStats.clear();
    const regularSelections = allNodes.filter(item => (item.type !== "major"));
    for (const talent of regularSelections) {
        for (const stat of talent.stats) {
            appendTotalStats(stat);
        }
    }

    totalAscendancy.clear();
    const majorAscendancy = allNodes.filter(item => ((item.type === "major") || (item.type === "asc")) && (item.parentTree !== "main"));
    for (const talent of majorAscendancy) {
        const ascendancyStats = new Map();
        for (const stat of talent.stats) {
            const key = stat["stat"];

            if (allStats.has(key)) {
                appendTotalStats(stat);
            }

            ascendancyStats.set(key, {
                type: stat["type"].toLowerCase(),
                values: [processValue(stat), ...(ascendancyStats.get(key)?.values ?? [])],
                description: stat["description"],
                is_percent: stat["is_percent"],
                scale_to_lvl: stat["scale_to_lvl"],
                minus_is_good: stat["minus_is_good"],
            });
        }
        totalAscendancy.set(talent.identifier.talent, {
            id: talent.identifier.talent,
            name: talent.name,
            value: ascendancyStats,
            type: talent.type,
        });
    }

    totalGameChangers.clear();
    const majorSelections = allNodes.filter(item => (item.type === "major") && (item.parentTree === "main"));
    for (const talent of majorSelections) {
        /** @type {Map<string, Object>} */
        const gameChangerStats = new Map();
        for (const stat of talent.stats) {
            const key = stat["stat"];

            if (allStats.has(key)) {
                appendTotalStats(stat);
            }

            gameChangerStats.set(key, {
                id: key,
                type: stat["type"].toLowerCase(),
                values: [processValue(stat), ...(gameChangerStats.get(key)?.values ?? [])],
                description: stat["description"],
                is_percent: stat["is_percent"],
                scale_to_lvl: stat["scale_to_lvl"],
                minus_is_good: stat["minus_is_good"],
            });
        }
        totalGameChangers.set(talent.identifier.talent, {
            id: talent.identifier.talent,
            name: talent.name,
            value: gameChangerStats,
        });
    }
};
