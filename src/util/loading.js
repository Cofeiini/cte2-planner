import { handleAscendancyOptions, handleVersionOptions, presetInfo, releaseInfo, sidePanel, updatePresetInfo, updateReleaseInfo } from "../core/side-panel.js";
import { borderAssets, iconAssets, indicatorAssets } from "../data/assets.js";
import { controls, welcomeMessages } from "../data/constants.js";
import { RELEASES } from "../releases.js";
import {
    ascendancyNodes,
    ascendancySelections,
    excludedAscendancyNodes,
    excludedTalentNodes,
    exclusiveNodeValues,
    fullNodeList,
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

const updateProgress = async (text) => {
    document.querySelector("#progress").innerText = text;
    await new Promise(resolve => {
        setTimeout(resolve, 1);
    });
};

export const handleLoadingImageAssets = async () => {
    await updateProgress("Processing assets...");
    const promises = [];
    const tasks = {
        started: Array.from(borderAssets.keys()).length + Array.from(indicatorAssets.keys()).length,
        completed: 0,
    };

    for (const key of borderAssets.keys()) {
        if (borderAssets.get(key)) {
            continue;
        }

        promises.push(fetch(`assets/textures/gui/skill_tree/borders/${key}.png`).then(response => response.blob()).then(bitmap => {
            borderAssets.set(key, URL.createObjectURL(bitmap));
            updateProgress(`Processing assets...\n${++tasks.completed} of ${tasks.started} done.`);
        }));
    }

    for (const key of indicatorAssets.keys()) {
        if (indicatorAssets.get(key)) {
            continue;
        }

        promises.push(fetch(`assets/textures/gui/skill_tree/indic/${key}.png`).then(response => response.blob()).then(bitmap => {
            indicatorAssets.set(key, URL.createObjectURL(bitmap));
            updateProgress(`Processing assets...\n${++tasks.completed} of ${tasks.started} done.`);
        }));
    }

    await fetch(`assets/textures/gui/ascendancy.png`).then(response => response.blob()).then(bitmap => {
        iconAssets.set("ascendancy", URL.createObjectURL(bitmap));
    });

    await fetch(`data/${releaseInfo.version}/perks.json`).then(response => response.json()).then(data => {
        const requested = new Set();

        for (const node of fullNodeList) {
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
                node.exclusive = true;
                exclusiveNodeValues.nodes.set(oneKind, [node.identifier.talent, ...(exclusiveNodeValues.nodes.get(oneKind) ?? [])]);
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
                updateProgress(`Processing assets...\n${++tasks.completed} of ${tasks.started} done.`);
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
    await updateProgress("Processing fallback assets...");
    if (!iconAssets.has("default")) {
        await fetch(`assets/textures/gui/stat_icons/default.png`).then(response => response.blob()).then(bitmap => {
            iconAssets.set("default", URL.createObjectURL(bitmap));
        });
    }
    if (!iconAssets.has("missing")) {
        await fetch(`assets/textures/gui/stat_icons/missing.png`).then(response => response.blob()).then(bitmap => {
            iconAssets.set("missing", URL.createObjectURL(bitmap));
        });
    }

    await updateProgress("Processing the talent tree...");
    await fetch(`data/${releaseInfo.version}/talents_new.csv`).then(response => response.text()).then(data => {
        generateTalentGrid(data);
    });

    await updateProgress("Processing the ascendancy tree...");
    await fetch(`data/${releaseInfo.version}/ascendancy.csv`).then(response => response.text()).then(data => {
        generateAscendancyGrid(data);
    });

    fullNodeList.length = 0;
    fullNodeList.push(...talentNodes);
    for (const nodes of ascendancyNodes.values()) {
        fullNodeList.push(...nodes);
    }

    await handleLoadingImageAssets();

    await updateProgress("Processing the talent nodes...");
    for (const [key, values] of exclusiveNodeValues.nodes) {
        talentExclusions.set(key, fullNodeList.filter(item => values.includes(item.identifier.talent)));
    }

    await updateProgress("Processing talent descriptions...");
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

    Object.keys(descriptionData).filter(item => item.includes("mmorpg.one_of_a_kind")).forEach(key => {
        exclusiveNodeValues.lang.set(key.split(".").at(-1), descriptionData[key]);
    });

    await updateProgress("Processing talent details...");
    const statNodeList = fullNodeList.filter(item => item.type === "stat" || item.type === "special");
    for (const node of statNodeList) {
        node.name = descriptionData[`mmorpg.stat.${node.identifier.data}`];
        if (!node.name) {
            node.name = descriptionData[`mmorpg.stat.${node.stats.at(0)["stat"]}`];
            if (!node.name) {
                console.error(node.identifier.talent, node.identifier.data, node.type, "not found!");
            }
        }
    }

    const talentNodeList = fullNodeList.filter(item => item.type === "start" || item.type === "major" || item.type === "asc");
    for (const node of talentNodeList) {
        node.name = descriptionData[`mmorpg.talent.${node.identifier.data}`];
        if (!node.name) {
            console.error(node.identifier.talent, node.identifier.data, node.type, "not found!");
        }
    }

    const statData = new Map();
    await fetch(`data/${releaseInfo.version}/stats.json`).then(response => response.json().then(data => {
        for (const node of fullNodeList) {
            for (const stat of node.stats) {
                const identifier = stat["stat"];
                const type = stat["type"].toLowerCase();

                stat["description"] = descriptionData[`mmorpg.stat.${identifier}`].replaceAll(/\\u(\w{4})/gi, (match, p1) => String.fromCharCode(parseInt(p1, 16)));
                const hasPercent = stat["description"].match(/\[VAL1].*?%/) !== null;

                let json = structuredClone(data.find(item => (item.id === identifier) || (item.data?.id === identifier)));
                if (!json) {
                    json = {
                        is_perc: (type === "percent") || (type === "more"),
                        format: ((Math.abs(parseFloat(stat["v1"])) > 0.0) && (type !== "flat")) || undefined,
                    };
                }
                json["is_perc"] = (json["data"]?.["perc"] ?? json["is_perc"]) || (type === "percent") || (type === "more") || hasPercent;
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

    await updateProgress("Processing talent information...");
    for (const node of fullNodeList) {
        const nodeData = statData.get(node.identifier.talent);

        for (const stat of node.stats) {
            const type = stat["type"].toLowerCase();

            const info = nodeData.get(stat["stat"]);
            const isPercent = info["is_perc"];

            stat["is_long"] = info["is_long"] ?? false;
            stat["scale_to_lvl"] = ((stat["scale_to_lvl"] ?? false) && ((info["scaling"] ?? "normal").toLowerCase() !== "none"));

            let isFormat = info["format"] ?? ((type === "flat") || isPercent);
            if (stat["is_long"]) {
                isFormat = false;
            }

            let description = stat["description"];
            if (isFormat && !description.includes("[VAL1]")) {
                description = `[VAL1]§7 ${description}`;
            }

            stat["type"] = type;
            stat["is_percent"] = isPercent;
            stat["description"] = description;
            stat["minus_is_good"] = info["minus_is_good"] ?? false;
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

    await updateProgress("Processing done.");
};

export const handleLoading = async () => {
    const title = document.querySelector("#loading-title");
    title.classList.remove("hidden");

    await updateProgress("Preparing...");

    const loading = document.querySelector("#loading");
    loading.classList.remove("invisible");

    try {
        updatePresetInfo(JSON.parse(atob(new URLSearchParams(location.search).get("preset"))));

        if (!releaseInfo) {
            const overrideInfo = RELEASES.find(item => item.version === presetInfo.version);
            if (overrideInfo) {
                updateReleaseInfo(overrideInfo);
            } else {
                updateReleaseInfo(RELEASES.at(0));
            }
        }
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

    if (!RELEASES.find(item => item.version === presetInfo.version)) {
        presetInfo.version = RELEASES.at(0).version;
    }

    const versionSelect = document.querySelector("#version-select");
    versionSelect.value = presetInfo.version;
    handleVersionOptions(versionSelect);

    const points = releaseInfo.points;
    updatePoints(points.starting + points.leveling + points.questing);
    updateAscendancyPoints(points.ascendancy.starting + points.ascendancy.questing);
    document.querySelector("#talent-points").innerText = `${TOTAL_POINTS}`;
    document.querySelector("#ascendancy-points").innerText = `${TOTAL_ASCENDANCY_POINTS}`;

    controls.ascendancy = presetInfo.ascendancy.selection;

    sidePanel.character.level.value = presetInfo.level;
    sidePanel.character.levelLabel.innerText = presetInfo.level;

    await handleLoadingAssets();
    await updateProgress("Generating the node trees...");
    generateTree();
    generateAscendancyTree();

    document.querySelector("#ascendancy-select").value = controls.ascendancy;
    handleAscendancyOptions();

    for (const talent of talentSelections) {
        toggleNode(talent, true);
    }

    for (const talent of ascendancySelections) {
        toggleNode(talent, true);
    }

    if (presetInfo.start) {
        toggleNode(talentExclusions.get("start").find(item => item.identifier.number === presetInfo.start), true);
        for (const id of presetInfo.talents) {
            toggleNode(talentNodes.find(item => item.identifier.number === id), true);
        }

        excludedTalentNodes.length = 0;
        for (const values of talentExclusions.values()) {
            if (talentSelections.some(item => item.exclusive && values.some(element => item.identifier.number === element.identifier.number))) {
                excludedTalentNodes.push(...values);
            }
        }
    }

    if (presetInfo.ascendancy.selection !== "none") {
        toggleNode(talentExclusions.get("ascendancy").find(item => item.identifier.talent === presetInfo.ascendancy.selection), true);
        for (const id of presetInfo.ascendancy.talents) {
            toggleNode(ascendancyNodes.get(presetInfo.ascendancy.selection).find(item => item.identifier.number === id), true);
        }

        excludedAscendancyNodes.length = 0;
        for (const values of talentExclusions.values()) {
            if (ascendancySelections.some(item => item.exclusive && values.some(element => item.identifier.number === element.identifier.number))) {
                excludedAscendancyNodes.push(...values);
            }
        }
    }

    await updateProgress("Drawing node trees...");
    drawLinesRegular();
    drawLinesAscendancy();
    handleViewport();

    title.classList.add("hidden");
    let index = 0;
    if (presetInfo.start) {
        index = 1 + Math.floor(Math.random() * (welcomeMessages.length - 1));
    }
    await updateProgress(welcomeMessages.at(index));

    loading.classList.add("invisible");
};
