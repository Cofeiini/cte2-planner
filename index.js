import { handleAscendancyChange, handleDataExport, handleDataImport, handleSidePanel, handleVersionChange, sidePanel } from "./src/core/side-panel.js";
import { infoTooltip, tooltipOffsets } from "./src/core/tooltip.js";
import { CELL_SIZE, controls } from "./src/data/constants.js";
import { RELEASES } from "./src/releases.js";
import { ascendancyGrid, fullNodeList, talentGrid } from "./src/type/talent-node.js";
import { updateAscendancyCanvas, updateLineCanvas } from "./src/util/drawing.js";
import {
    ascendancyButton,
    ascendancyMenu,
    boundingRects,
    fittedZoom,
    refreshBoundingRects,
    talentContainer,
    updateAscendancyButton,
    updateAscendancyContainer,
    updateAscendancyMenu,
    updateAscendancyTreeContainer,
    updateCanvasContainer,
    updateFittedZoom,
    updateTalentContainer,
    updateTalentTree,
    updateViewportContainer,
    viewport,
    viewportContainer,
} from "./src/util/generating.js";
import { handleLoading } from "./src/util/loading.js";
import { handleViewport, setUpURL } from "./src/util/spuddling.js";

/** @type {TalentNode} */
let previousFocus = undefined;

/** @param {MouseEvent} event */
const handleNodeFocus = (event) => {
    const zoomedCell = CELL_SIZE * controls.zoom;

    const viewportOffset = {
        x: viewport.offset.left * zoomedCell,
        y: viewport.offset.top * zoomedCell,
    };

    let currentTarget = event.target.closest("#talent-tree");
    let treeBounds = boundingRects.trees.talent;
    let canvasBounds = boundingRects.containers.canvas;
    let grid = talentGrid;
    if (!currentTarget) {
        viewportOffset.x = 0;
        viewportOffset.y = 0;

        currentTarget = event.target.closest(".ascendancy-tree");
        treeBounds = boundingRects.trees.ascendancy.get(controls.ascendancy);
        canvasBounds = boundingRects.containers.ascendancy;
        grid = ascendancyGrid.get(controls.ascendancy);
    }

    ascendancyButton.classList.remove("focused");
    if (!currentTarget) {
        ascendancyButton.classList.add("focused");
        return;
    }

    const layer = {
        x: (event.clientX - canvasBounds.left) - ((canvasBounds.width - treeBounds.width) * 0.5) + viewportOffset.x,
        y: (event.clientY - canvasBounds.top) - ((canvasBounds.height - treeBounds.height) * 0.5) + viewportOffset.y,
    };
    const cell = {
        x: Math.floor(layer.x / zoomedCell),
        y: Math.floor(layer.y / zoomedCell),
    };

    /** @type {TalentNode} */
    let focus = undefined;
    let closest = Number.MAX_VALUE;
    for (let row = cell.y - 1; row <= cell.y + 1; ++row) {
        for (let col = cell.x - 1; col <= cell.x + 1; ++col) {
            const item = grid.at(row)?.at(col);
            if (!item?.selectable) {
                continue;
            }

            const center = {
                x: (col + 0.5) * zoomedCell,
                y: (row + 0.5) * zoomedCell,
            };
            const delta = {
                x: layer.x - center.x,
                y: layer.y - center.y,
            };

            const distance = Math.pow(delta.x, 2) + Math.pow(delta.y, 2);
            if ((distance <= Math.pow(zoomedCell, 2)) && (distance < closest)) {
                closest = distance;
                focus = item;
            }
        }
    }

    if (focus?.identifier?.number !== previousFocus?.identifier?.number) {
        if (previousFocus?.selectable) {
            previousFocus.visual.classList.remove("focused");
        }
        if (focus?.selectable) {
            focus.visual.classList.add("focused");
        }
        previousFocus = focus;
    }
};

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

    const canvasBounds = boundingRects.containers.canvas;
    const talentBounds = boundingRects.containers.talent;

    controls.panning = true;
    controls.x = Math.min(Math.max(controls.x - event.movementX, 0), canvasBounds.width - talentBounds.width);
    controls.y = Math.min(Math.max(controls.y - event.movementY, 0), canvasBounds.height - talentBounds.height);

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
        isMatch = isMatch || node.stats.some(item => item.stat.includes(filter) || item.stat.includes(altFilter) || item.description.toLowerCase().includes(filter));

        if (isMatch) {
            node.visual.classList.remove("filtered");
            node.visual.classList.add("highlighted");
        }
    }
};

const handleEvents = () => {
    talentContainer.onwheel = (event) => {
        event.preventDefault();

        const oldZoom = controls.zoom;
        const change = Math.pow(1 + controls.zoom, Math.sign(event.deltaY) * -0.25);
        controls.zoom = Math.min(Math.max(controls.zoom * change, fittedZoom), 3.0);

        const canvasBounds = boundingRects.containers.canvas;
        const talentBounds = boundingRects.containers.talent;

        const offset = {
            x: event.clientX - talentBounds.left,
            y: event.clientY - talentBounds.top,
        };
        const target = {
            x: (controls.x + offset.x) / oldZoom,
            y: (controls.y + offset.y) / oldZoom,
        };

        controls.x = Math.min(Math.max((target.x * controls.zoom) - offset.x, 0), canvasBounds.width - talentBounds.width);
        controls.y = Math.min(Math.max((target.y * controls.zoom) - offset.y, 0), canvasBounds.height - talentBounds.height);

        if (controls.zoom !== oldZoom) {
            ascendancyMenu.classList.add("hidden");
            handleViewport();

            refreshBoundingRects();
        }
    };

    talentContainer.onmousedown = (event) => {
        event.preventDefault();

        if (event.button !== 0) {
            return;
        }

        talentContainer.style.cursor = "grabbing";
        talentContainer.addEventListener("mousemove", handleMouseDrag);
        document.querySelector("#ascendancy-menu").classList.add("hidden");
        document.querySelector("#talent-search").blur();
    };

    talentContainer.onmouseup = (event) => {
        event.preventDefault();

        if (event.button !== 0) {
            return;
        }

        if (controls.panning) {
            refreshBoundingRects();
        }

        controls.panning = false;
        talentContainer.style.cursor = null;
        if (controls.hovering) {
            infoTooltip.container.classList.add("visible");
        }

        talentContainer.removeEventListener("mousemove", handleMouseDrag);
    };

    viewportContainer.oncontextmenu = () => {
        return false;
    };

    viewportContainer.onmouseenter = (event) => {
        if (event.buttons !== 0) {
            return;
        }

        if (controls.panning) {
            refreshBoundingRects();
        }

        controls.panning = false;
        talentContainer.style.cursor = null;
        talentContainer.removeEventListener("mousemove", handleMouseDrag);
    };

    viewportContainer.onmousemove = (event) => {
        if (controls.panning) {
            return;
        }

        handleNodeFocus(event);

        if (!previousFocus && !ascendancyButton.classList.contains("focused")) {
            return;
        }

        infoTooltip.main.style.width = "max-content";
        const bounds = boundingRects.containers.viewport;
        const contentBounds = infoTooltip.main.getBoundingClientRect();
        boundingRects.tooltip.main = contentBounds;
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

window.onresize = () => {
    updateFittedZoom();
    controls.zoom = Math.min(Math.max(controls.zoom, fittedZoom), 3.0);
    handleViewport();
};

window.onload = async () => {
    updateTalentTree(document.querySelector("#talent-tree"));
    updateViewportContainer(document.querySelector("#viewport-container"));
    updateAscendancyContainer(document.querySelector("#ascendancy-container"));
    updateAscendancyTreeContainer(document.querySelector("#ascendancy-tree-container"));
    updateCanvasContainer(document.querySelector("#canvas-container"));
    updateTalentContainer(document.querySelector("#talent-container"));

    updateLineCanvas(document.querySelector("#line-canvas"));
    updateAscendancyCanvas(document.querySelector("#ascendancy-canvas"));

    updateAscendancyButton(document.querySelector("#ascendancy-button"));
    updateAscendancyMenu(document.querySelector("#ascendancy-menu"));

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

        infoTooltip.container.classList.add("visible");
    };
    searchInfo.onmouseleave = () => {
        infoTooltip.container.classList.remove("visible");
    };

    handleEvents();

    await handleLoading();

    updateFittedZoom();
};
