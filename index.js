import { handleAscendancyChange, handleDataExport, handleDataImport, handleSidePanel, handleVersionChange, sidePanel } from "./src/core/side-panel.js";
import { infoTooltip, tooltipOffsets } from "./src/core/tooltip.js";
import { controls } from "./src/data/constants.js";
import { RELEASES } from "./src/releases.js";
import { fullNodeList, updateTargetTree } from "./src/type/talent-node.js";
import { talentTree, updateAscendancyContainer, updateAscendancyTreeContainer, updateTalentTree } from "./src/util/generating.js";
import { handleLoading } from "./src/util/loading.js";
import { handleViewport, setUpURL, updateLineCanvas } from "./src/util/spuddling.js";

/**
 * @param {MouseEvent} event
 */
const handleMouseDrag = (event) => {
    event.preventDefault();

    if (!controls.panning) {
        const distance = Math.pow(event.movementX, 2) + Math.pow(event.movementY, 2);
        if (distance < 2) {
            return;
        }
    }

    controls.panning = true;
    controls.x = controls.x + event.movementX;
    controls.y = controls.y + event.movementY;

    handleViewport();
};

/**
 * @param {InputEvent} event
 */
const handleSearch = (event) => {
    const filter = event.target.value.trim().toLowerCase();
    const altFilter = filter.replaceAll(" ", "_");
    if (filter.length === 0) {
        for (const node of fullNodeList) {
            node.visual.classList.remove("filtered", "highlighted");
        }
        return;
    }

    for (const node of fullNodeList) {
        node.visual.classList.add("filtered");
        node.visual.classList.remove("highlighted");

        let isMatch = node.name.toLowerCase().includes(filter) || node.name.toLowerCase().includes(altFilter);
        isMatch = isMatch || node.identifier.talent.includes(filter) || node.identifier.talent.includes(altFilter);
        isMatch = isMatch || node.keywords.includes(filter) || node.keywords.includes(altFilter);
        isMatch = isMatch || node.stats.some(item => item.stat.includes(filter) || item.description.toLowerCase().includes(filter) || item.stat.includes(altFilter));

        if (isMatch) {
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
        document.querySelector("#ascendancy-menu").classList.add("hidden");
    };

    container.onmouseup = (event) => {
        event.preventDefault();

        if (event.button !== 0) {
            return;
        }

        controls.panning = false;
        container.style.cursor = null;
        if (controls.hovering) {
            infoTooltip.container.classList.add("visible");
            infoTooltip.container.classList.remove("invisible");
        }

        container.removeEventListener("mousemove", handleMouseDrag);
    };

    const viewport = document.querySelector("#viewport-container");

    viewport.oncontextmenu = () => {
        return false;
    };

    viewport.onmouseenter = (event) => {
        if (event.buttons !== 0) {
            return;
        }

        controls.panning = false;
        container.style.cursor = null;
        container.removeEventListener("mousemove", handleMouseDrag);
    };

    viewport.onmousemove = (event) => {
        infoTooltip.main.style.width = "max-content";
        const bounds = viewport.getBoundingClientRect();
        const contentBounds = infoTooltip.main.getBoundingClientRect();
        infoTooltip.container.style.left = `${Math.floor(event.clientX) + tooltipOffsets.pointer}px`;
        infoTooltip.container.style.top = `${Math.min(Math.floor(event.clientY) + tooltipOffsets.pointer, bounds.bottom - contentBounds.height - tooltipOffsets.edge)}px`;

        let target = 400;
        if (contentBounds.width < target) {
            target = contentBounds.width;
        }

        const padding = bounds.right - Math.floor(event.clientX) - tooltipOffsets.pointer - tooltipOffsets.edge;
        if (padding < Math.max(target, contentBounds.width)) {
            infoTooltip.main.style.width = `max(${target}px, min(33vw, ${padding}px))`;
        }
    };
};

window.onload = async () => {
    updateLineCanvas(document.querySelector("#line-canvas"));
    updateTalentTree(document.querySelector("#talent-tree"));
    updateAscendancyContainer(document.querySelector("#ascendancy-container"));
    updateAscendancyTreeContainer(document.querySelector("#ascendancy-tree-container"));
    updateTargetTree(talentTree);

    infoTooltip.container = document.querySelector("#tooltip-container");
    infoTooltip.main = document.querySelector("#info-tooltip");
    infoTooltip.arrow = document.querySelector("#tooltip-arrow");
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

    document.querySelector("#import-button").onclick = handleDataImport;
    document.querySelector("#export-button").onclick = handleDataExport;

    const versionSelect = document.querySelector("#version-select");
    for (const release of RELEASES) {
        const option = document.createElement("option");
        option.value = release.version;
        option.innerText = release.version;
        versionSelect.append(option);
    }
    versionSelect.onchange = handleVersionChange;

    document.querySelector("#ascendancy-select").onchange = handleAscendancyChange;

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
        for (const talent of fullNodeList) {
            for (const key of talent.keywords) {
                keywords.add(key.replaceAll("_", " "));
            }
        }
        infoTooltip.stats.innerHTML = [
            `<p style="margin: 0 0 0.5em 0;">You can search talents or stats by name or description.</p>`,
            `<p style="margin: 0">The following keywords are also recognized:</p>`,
            `<ul style="margin: 0;">${Array.from(keywords).sort().map(item => `<li style="color: darkorange;">${item}</li>`).join("")}</ul>`,
        ].join("");

        infoTooltip.container.classList.remove("invisible");
        infoTooltip.container.classList.add("visible");
    };
    searchInfo.onmouseleave = () => {
        infoTooltip.container.classList.remove("visible");
        infoTooltip.container.classList.add("invisible");
    };

    handleEvents();

    await handleLoading();
};
