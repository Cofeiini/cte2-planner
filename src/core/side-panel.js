import { colorMap, controls } from "../data/constants.js";
import { RELEASES } from "../releases.js";
import { ascendancySelections, talentExclusions, talentSelections, toggleNode } from "../type/talent-node.js";
import { drawLinesAscendancy } from "../util/drawing.js";
import { ascendancyContainer, ascendancyTreeContainer, boundingRects } from "../util/generating.js";
import { handleLoading } from "../util/loading.js";
import { handleViewport, resetMessageBox, setUpSeparator, setUpStatContainer, setUpStatIcon, setUpURL } from "../util/spuddling.js";

export const sidePanel = {
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

/** @type {Map<string, Map<string, Object>>} */
export const totalStats = new Map();

/** @type {Map<string, Object>} */
export const totalGameChangers = new Map();

/** @type {Map<string, Object>} */
export const totalAscendancy = new Map();

export let releaseInfo = undefined;
export const updateReleaseInfo = (json) => {
    releaseInfo = json;
};

export let presetInfo = undefined;
export const updatePresetInfo = (json) => {
    presetInfo = json;
};

/** @type {string} */
export let ascendancyInfo = "none";
export const updateAscendancyInfo = (ascendancy) => {
    ascendancyInfo = ascendancy;
};

/** @type {Map<string, HTMLDivElement>} */
const ascendancyCache = new Map();

/** @type {Map<string, HTMLDivElement>} */
const gameChangerCache = new Map();

/**
 * @param {HTMLSelectElement} select
 */
export const handleVersionOptions = (select) => {
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

export const handleAscendancyOptions = () => {
    updateAscendancyInfo(controls.ascendancy);

    ascendancyContainer.classList.add("hidden");
    if (controls.ascendancy !== "none") {
        const canvas = document.querySelector("#ascendancy-canvas").offscreenCanvasMap.get(controls.ascendancy);
        ascendancyTreeContainer.style.width = `${canvas.width}px`;
        ascendancyTreeContainer.style.height = `${canvas.height}px`;

        const tree = ascendancyTreeContainer.querySelector(`#${controls.ascendancy}_tree`);
        tree.classList.remove("hidden");
        drawLinesAscendancy();

        ascendancyContainer.classList.remove("hidden");

        boundingRects.trees.ascendancy.set(controls.ascendancy, tree.getBoundingClientRect());
        boundingRects.containers.ascendancy = ascendancyTreeContainer.getBoundingClientRect();
    }

    document.querySelector("#ascendancy-button").refresh();
};

export const handleSidePanel = () => {
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

    /** @type {Map<boolean, Map<string, Object>>} */
    const totalStatList = new Map();
    for (const [id, map] of totalStats) {
        for (const stat of map.values()) {
            const isPercent = stat["is_percent"];

            /** @type {Map<string, Object>} */
            const valueMap = totalStatList.get(isPercent) ?? new Map();
            valueMap.set(id, {
                id: id,
                values: [...stat["values"], ...(valueMap.get(id)?.values ?? [])],
                description: stat["description"],
                is_percent: isPercent,
                minus_is_good: stat["minus_is_good"],
            });

            totalStatList.set(isPercent, valueMap);
        }
    }

    const attributeContainer = document.createElement("div");
    attributeContainer.classList.add("panel-group-item-container");
    attributeContainer.classList.add("hidden");
    const totalStatAttributes = Array.from(totalStatList.get(false)?.values() ?? []);
    if (totalStatAttributes.length > 0) {
        attributeContainer.classList.remove("hidden");

        const attributesTitle = document.createElement("div");
        attributesTitle.classList.add("panel-group-title-small");
        attributesTitle.innerText = "Attributes";

        const attributeItems = [];
        for (const stat of totalStatAttributes) {
            attributeItems.push(setUpStatContainer(stat));
        }
        attributeItems.sort((a, b) => (parseFloat(a.innerText.match(/[-\d.]+/)[0]) * parseFloat(a.dataset.sign)) - (parseFloat(b.innerText.match(/[-\d.]+/)[0]) * parseFloat(b.dataset.sign)));

        attributeContainer.replaceChildren(attributesTitle, ...attributeItems);
    }

    const statContainer = document.createElement("div");
    statContainer.classList.add("panel-group-item-container", "hidden");
    const totalStatValues = Array.from(totalStatList.get(true)?.values() ?? []);
    if (totalStatValues.length > 0) {
        statContainer.classList.remove("hidden");

        const statsTitle = document.createElement("div");
        statsTitle.classList.add("panel-group-title-small");
        statsTitle.innerText = "Stats";

        const statItems = [];
        for (const stat of totalStatValues) {
            statItems.push(setUpStatContainer(stat));
        }
        statItems.sort((a, b) => (parseFloat(a.innerText.match(/[-\d.]+/)[0]) * parseFloat(a.dataset.sign)) - (parseFloat(b.innerText.match(/[-\d.]+/)[0]) * parseFloat(b.dataset.sign)));

        statContainer.replaceChildren(statsTitle, ...statItems);
    }

    const ascendancyStatContainer = document.createElement("div");
    ascendancyStatContainer.classList.add("panel-group-item-container", "hidden");
    if (totalAscendancy.size > 0) {
        ascendancyStatContainer.classList.remove("hidden");

        const mainTitle = document.createElement("div");
        mainTitle.classList.add("panel-group-title-small");
        mainTitle.innerText = "Ascendancy";

        const ascendancyItems = [];

        const ascendancyList = [...totalAscendancy.values()].sort((a, b) => a.name.localeCompare(b.name));
        const from = ascendancyList.findIndex(item => item.type === "asc");
        ascendancyList.splice(0, 0, ascendancyList.splice(from, 1).at(0));
        for (const majorAscendancy of ascendancyList) {
            let itemContainer = ascendancyCache.get(majorAscendancy.id);
            if (!itemContainer) {
                itemContainer = document.createElement("div");
                itemContainer.classList.add("panel-stats-group");
                itemContainer.append(setUpStatIcon(majorAscendancy.id, majorAscendancy.type));

                const statsContainer = document.createElement("div");
                statsContainer.classList.add("panel-stats-container-group");

                const title = document.createElement("div");
                title.classList.add("panel-stats-group-title");
                title.innerText = majorAscendancy.name;
                title.style.color = colorMap.minecraft.get("5");
                if (majorAscendancy.type === "asc") {
                    title.style.color = colorMap.minecraft.get("6");
                }
                statsContainer.append(title);

                for (const stat of majorAscendancy.value.values()) {
                    statsContainer.append(setUpStatContainer(stat));
                }
                itemContainer.append(statsContainer);
                ascendancyCache.set(majorAscendancy.id, itemContainer);
            }
            ascendancyItems.push(itemContainer);
            ascendancyItems.push(setUpSeparator());
        }
        ascendancyItems.splice(-1);
        ascendancyStatContainer.replaceChildren(mainTitle, ...ascendancyItems);
    }

    const gameChangerContainer = document.createElement("div");
    gameChangerContainer.classList.add("panel-group-item-container", "hidden");
    if (totalGameChangers.size > 0) {
        gameChangerContainer.classList.remove("hidden");

        const mainTitle = document.createElement("div");
        mainTitle.classList.add("panel-group-title-small");
        mainTitle.innerText = "Game Changers";

        const gameChangerItems = [];
        const gameChangerList = [...totalGameChangers.values()].sort((a, b) => a.name.localeCompare(b.name));
        for (const gameChanger of gameChangerList) {
            let itemContainer = gameChangerCache.get(gameChanger.id);
            if (!itemContainer) {
                itemContainer = document.createElement("div");
                itemContainer.classList.add("panel-stats-group");
                itemContainer.append(setUpStatIcon(gameChanger.id));

                const statsContainer = document.createElement("div");
                statsContainer.classList.add("panel-stats-container-group");

                const title = document.createElement("div");
                title.classList.add("panel-stats-group-title");
                title.innerText = gameChanger.name;
                title.style.color = colorMap.minecraft.get("5");
                statsContainer.append(title);

                for (const stat of gameChanger.value.values()) {
                    statsContainer.append(setUpStatContainer(stat));
                }

                itemContainer.append(statsContainer);
                gameChangerCache.set(gameChanger.id, itemContainer);
            }
            gameChangerItems.push(itemContainer);
            gameChangerItems.push(setUpSeparator());
        }
        gameChangerItems.splice(-1);
        gameChangerContainer.replaceChildren(mainTitle, ...gameChangerItems);
    }

    sidePanel.allocated.statList.replaceChildren(attributeContainer, statContainer, ascendancyStatContainer, gameChangerContainer);
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
    content.style.gap = "1.0em";
    content.style.height = "100%";

    const message = document.createElement("div");
    message.style.display = "flex";
    message.style.flexDirection = "column";
    message.style.fontSize = "larger";
    message.style.gap = "0.5em";
    message.style.height = "100%";
    message.style.width = "100%";
    content.append(message);

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
export const handleVersionChange = async (event) => {
    const shouldConfirm = (releaseInfo.version !== event.target.value);
    updateReleaseInfo(RELEASES.find(item => item.version === event.target.value));

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
        buttons.append(proceedButton);

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
        buttons.append(cancelButton);

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

/**
 * @param {InputEvent} event
 */
export const handleAscendancyChange = (event) => {
    if (controls.ascendancy && controls.ascendancy !== "none") {
        if (controls.ascendancy !== event.target.value) {
            const selectedNode = ascendancySelections.find(item => item.identifier.talent === controls.ascendancy);
            if (selectedNode) {
                toggleNode(selectedNode);
            }
        }

        const trees = ascendancyTreeContainer.querySelectorAll(".ascendancy-tree");
        for (const tree of trees) {
            tree.classList.add("hidden");
        }
    }
    controls.ascendancy = event.target.value;

    const mainNode = talentExclusions.get("ascendancy").find(item => item.identifier.talent === controls.ascendancy);
    if (mainNode && !mainNode.selected) {
        toggleNode(mainNode);
    }

    handleAscendancyOptions();
    setUpURL();
    handleViewport();
};

export const handleDataImport = () => {
    const content = setUpMessageBox([
        "You can import a build that was exported in JSON format by this tool.",
    ]);

    const footer = document.createElement("div");
    footer.classList.add("hidden");
    footer.style.color = "red";
    footer.style.display = "flex";
    footer.style.justifyContent = "center";
    footer.style.width = "100%";
    footer.fontSize = "larger";
    footer.innerText = "An error occurred while reading the data. Make sure it's valid and correctly formatted.";
    content.append(footer);

    const input = document.createElement("textarea");
    input.placeholder = "Paste JSON data here...";
    input.rows = 20;
    input.style.backgroundColor = "darkslategray";
    input.style.color = "white";
    content.append(input);

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

        updateReleaseInfo(RELEASES.find(item => item.version === json.version));
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

export const handleDataExport = () => {
    const content = setUpMessageBox([
        "You can export a build in JSON format.",
    ]);

    const input = document.createElement("textarea");
    input.readOnly = true;
    input.rows = 20;
    input.style.backgroundColor = "darkslategray";
    input.style.color = "white";
    input.value = JSON.stringify(presetInfo, null, 4);
    content.append(input);

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
