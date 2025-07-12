import { handleAscendancyOptions, handleVersionOptions, presetInfo, releaseInfo, sidePanel, updatePresetInfo, updateReleaseInfo } from "../core/side-panel.js";
import { borderAssets, iconAssets, indicatorAssets } from "../data/assets.js";
import { controls } from "../data/constants.js";
import { RELEASES } from "../releases.js";
import {
    ascendancyNodes,
    exclusiveNodeValues,
    talentExclusions,
    talentNodes,
    talentSelections,
    toggleNode,
    TOTAL_ASCENDANCY_POINTS,
    TOTAL_POINTS,
    updateAscendancyPoints,
    updatePoints,
} from "../type/talent-node.js";
import { drawLinesAscendancy, drawLinesRegular } from "./drawing.js";
import { generateAscendancyGrid, generateAscendancyTree, generateTalentGrid, generateTree } from "./generating.js";
import { handleViewport } from "./spuddling.js";

export const handleLoadingImageAssets = async () => {
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

        const allNodes = [...talentNodes];
        for (const nodes of ascendancyNodes.values()) {
            allNodes.push(...nodes);
        }

        for (const node of allNodes) {
            let key = node.identifier.talent;

            const json = data.find(item => item.id === key);
            if (!json) {
                continue;
            }

            node.type = json.type.toLowerCase(); // This should be one of these: asc, start, major, special, stat
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

export const handleLoadingAssets = async () => {
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

    progress.innerText = "Processing the ascendancy tree...";
    await fetch(`data/${releaseInfo.version}/ascendancy.csv`).then(response => response.text()).then(data => {
        generateAscendancyGrid(data);
    });

    await handleLoadingImageAssets();

    progress.innerText = "Processing the talent nodes...";
    const allNodes = [...talentNodes];
    for (const nodes of ascendancyNodes.values()) {
        allNodes.push(...nodes);
    }

    for (const [key, values] of exclusiveNodeValues) {
        talentExclusions.set(key, allNodes.filter(item => values.includes(item.identifier.talent)));
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
        tasks.started = allNodes.reduce((accumulated, item) => accumulated + item.stats.length, 0);
        progress.innerText = `Processing talent details...\n${tasks.completed} of ${tasks.started} done.`;

        for (const node of allNodes) {
            for (const stat of node.stats) {
                const identifier = stat["stat"];
                let json = data.find(item => (item.id === identifier) || (item.data?.id === identifier));
                if (!json) {
                    json = {
                        is_perc: node.type !== "special",
                        format: (parseFloat(stat["v1"]) === 1.0) || undefined,
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

    const statNodeList = allNodes.filter(item => item.type === "stat" || item.type === "special");
    for (const node of statNodeList) {
        node.name = descriptionData[`mmorpg.stat.${node.identifier.data}`];
        if (!node.name) {
            node.name = descriptionData[`mmorpg.stat.${node.stats.at(0)["stat"]}`];
            if (!node.name) {
                console.error(node.identifier.talent, node.identifier.data, node.type, "not found!");
            }
        }
    }

    const talentNodeList = allNodes.filter(item => item.type === "start" || item.type === "major" || item.type === "asc");
    for (const node of talentNodeList) {
        node.name = descriptionData[`mmorpg.talent.${node.identifier.data}`];
        if (!node.name) {
            console.error(node.identifier.talent, node.identifier.data, node.type, "not found!");
        }
    }

    for (const node of allNodes) {
        const isStat = node.type === "stat" || node.type === "special" || node.type === "asc";
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

            item["is_long"] = info["is_long"] ?? false;
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

    const ascendancySelect = document.querySelector("#ascendancy-select");
    for (const option of ascendancySelect.options) {
        option.innerText = descriptionData[`mmorpg.talent.${option.value}`];
    }
    const options = Array.from(ascendancySelect.children);
    ascendancySelect.replaceChildren(...options.sort((a, b) => a.innerText.localeCompare(b.innerText)));

    const noneOption = document.createElement("option");
    noneOption.innerText = "None";
    noneOption.value = "none";
    ascendancySelect.prepend(noneOption);

    progress.innerText = "Processing done.";
};

export const handleLoading = async () => {
    const progress = document.querySelector("#progress");
    progress.innerText = "Processing...";

    const loading = document.querySelector("#loading");
    loading.classList.remove("invisible");

    let shouldLoadAssets = true;
    try {
        updatePresetInfo(JSON.parse(atob(new URLSearchParams(location.search).get("preset"))));

        const initialLoading = releaseInfo === undefined;
        if (!releaseInfo) {
            const overrideInfo = RELEASES.find(item => item.version === presetInfo.version);
            if (overrideInfo) {
                updateReleaseInfo(overrideInfo);
            } else {
                updateReleaseInfo(RELEASES.at(0));
            }
        }

        shouldLoadAssets = initialLoading || (presetInfo.version !== releaseInfo.version);
    } catch (_error) {
        updateReleaseInfo(RELEASES.at(0));
        updatePresetInfo({
            version: releaseInfo.version,
            level: 100,
            start: undefined,
            talents: [],
            ascendancy: {
                selection: "none",
                talents: [],
            },
        });
    }

    // Check these just in case some of the imported data is missing
    if (!presetInfo) {
        updatePresetInfo({});
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

    if (!presetInfo.ascendancy) {
        presetInfo["ascendancy"] = {};
    }
    if (!presetInfo.ascendancy.selection) {
        presetInfo.ascendancy["selection"] = "none";
    }
    if (!presetInfo.ascendancy.talents) {
        presetInfo.ascendancy["talents"] = [];
    }

    const versionSelect = document.querySelector("#version-select");
    versionSelect.value = presetInfo.version;
    handleVersionOptions(versionSelect);

    const points = releaseInfo.points;
    updatePoints(points.starting + points.leveling + points.questing);
    updateAscendancyPoints(points.ascendancy);
    document.querySelector("#talent-points").innerText = `${TOTAL_POINTS}`;
    document.querySelector("#ascendancy-points").innerText = `${TOTAL_ASCENDANCY_POINTS}`;

    controls.ascendancy = presetInfo.ascendancy.selection;

    sidePanel.character.level.value = presetInfo.level;
    sidePanel.character.levelLabel.innerText = presetInfo.level;

    if (shouldLoadAssets) {
        await handleLoadingAssets();
        generateTree();
        generateAscendancyTree();
    }

    document.querySelector("#ascendancy-select").value = controls.ascendancy;
    handleAscendancyOptions();

    for (const talent of talentSelections) {
        toggleNode(talent, true);
    }

    if (presetInfo.start) {
        toggleNode(talentExclusions.get("start").find(item => item.identifier.number === presetInfo.start), true);
        for (const id of presetInfo.talents) {
            toggleNode(talentNodes.find(item => item.identifier.number === id), true);
        }
    }

    if (presetInfo.ascendancy.selection !== "none") {
        toggleNode(talentExclusions.get("ascendancy").find(item => item.identifier.talent === presetInfo.ascendancy.selection), true);
        for (const id of presetInfo.ascendancy.talents) {
            toggleNode(ascendancyNodes.get(presetInfo.ascendancy.selection).find(item => item.identifier.number === id), true);
        }
    }

    drawLinesRegular();
    drawLinesAscendancy();
    handleViewport();

    progress.innerText = "Done.";
    loading.classList.add("invisible");
};
