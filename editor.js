import { handleAscendancyChange, handleEditorExport, handleEditorImport, handleSidePanel, handleVersionChange, sidePanel } from "./src/core/side-panel.js";
import { infoTooltip, tooltipOffsets } from "./src/core/tooltip.js";
import { CELL_HALF, CELL_SIZE, controls } from "./src/data/constants.js";
import { RELEASES } from "./src/releases.js";
import { ascendancyGrid, fullNodeList, talentGrid } from "./src/type/talent-node.js";
import {
    drawLinesAscendancy,
    drawLinesAscendancyInitial,
    drawLinesInitial,
    drawLinesRegular,
    updateAscendancyCanvas,
    updateLineCanvas,
} from "./src/util/drawing.js";
import {
    ascendancyButton,
    ascendancyMenu,
    boundingRects,
    editorMenu,
    fittedZoom,
    generateAscendancyTree,
    generateEditorMenu,
    generateTree,
    refreshBoundingRects,
    resetTooltipArrow,
    talentContainer,
    updateAscendancyButton,
    updateAscendancyContainer,
    updateAscendancyMenu,
    updateAscendancyTreeContainer,
    updateCanvasContainer,
    updateEditorMenu,
    updateFittedZoom,
    updateTalentContainer,
    updateTalentTree,
    updateViewportContainer,
    viewport,
    viewportContainer,
} from "./src/util/generating.js";
import { handleLoading } from "./src/util/loading.js";
import { handleViewport, isSameTalent, setUpURL } from "./src/util/spuddling.js";

/** @type {HTMLInputElement} */
let searchInput = undefined;

/** @type {TalentNode} */
let previousFocus = undefined;

/** @param {MouseEvent} event */
const handleNodeFocus = (event) => {
    if (!editorMenu.classList.contains("hidden")) {
        previousFocus?.visual.classList.remove("focused");
        return;
    }

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

        currentTarget = event.target.closest("#ascendancy-tree-container");
        treeBounds = boundingRects.trees.ascendancy.get(controls.ascendancy);
        canvasBounds = boundingRects.containers.ascendancy;
        grid = ascendancyGrid.get(controls.ascendancy);
    }

    ascendancyButton.classList.remove("focused");
    if (!currentTarget) {
        controls.editor.target = undefined;
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

    if (previousFocus && (controls.editor.action === "none")) {
        controls.editor.target = previousFocus;
    }

    controls.editor.focus = grid.at(cell.y)?.at(cell.x);
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

const handleSearch = () => {
    const filter = searchInput.value.trim().toLowerCase();

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

/** @param {WheelEvent} event */
const handleZoom = (event) => {
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
        editorMenu.classList.add("hidden");
        handleViewport();

        refreshBoundingRects();
    }
};

/**
 * @param {MouseEvent} event
 */
const handleEditorIndicator = (event) => {
    const canvasBounds = boundingRects.containers.canvas;
    const offset = {
        x: 0,
        y: 0,
        cell: {
            x: 0,
            y: 0,
        },
    };
    if (controls.editor.focus?.parentTree === "main") {
        offset.y = CELL_HALF;
        offset.cell.y = CELL_HALF;
    }

    const layer = {
        x: event.clientX - canvasBounds.left,
        y: event.clientY - canvasBounds.top,
    };
    const cell = {
        x: (Math.floor(((layer.x / controls.zoom) - (CELL_HALF - offset.x)) / CELL_SIZE) * CELL_SIZE) + CELL_HALF,
        y: (Math.floor(((layer.y / controls.zoom) - (CELL_HALF - offset.y)) / CELL_SIZE) * CELL_SIZE) + CELL_HALF,
    };

    controls.editor.indicator.style.left = `${cell.x - offset.cell.x}px`;
    controls.editor.indicator.style.top = `${cell.y - offset.cell.y}px`;
};

/** @type {number} */
let scrollFrameId = undefined;
const handleEvents = () => {
    talentContainer.onwheel = (event) => {
        event.preventDefault();

        if (scrollFrameId === undefined) {
            cancelAnimationFrame(scrollFrameId);
        }
        scrollFrameId = requestAnimationFrame(handleZoom.bind(null, event));
    };

    talentContainer.onmousedown = (event) => {
        event.preventDefault();

        if (event.button !== 0) {
            if (event.button === 2) {
                const isAction = controls.editor.action !== "none";
                if (isAction) {
                    controls.editor.action = "none";
                    controls.editor.indicator.replaceChildren();

                    const highlighted = document.querySelectorAll(".highlighted");
                    for (const node of highlighted) {
                        node.classList.remove("active", "highlighted");
                    }
                    document.body.style.cursor = null;
                }

                if (!ascendancyMenu.classList.contains("hidden")) {
                    editorMenu.classList.add("hidden");
                    return;
                }

                if (isAction) {
                    editorMenu.classList.add("hidden");
                    return;
                }

                if (controls.editor.focus) {
                    editorMenu.classList.remove("hidden");

                    generateEditorMenu();

                    const bounds = boundingRects.containers.talent;
                    const menuBounds = editorMenu.getBoundingClientRect();

                    editorMenu.style.left = `${event.clientX}px`;
                    editorMenu.style.top = `${Math.min(event.clientY, bounds.height - menuBounds.height - 3)}px`;

                    handleEditorIndicator(event);
                }
            }
            return;
        }

        editorMenu.classList.add("hidden");

        if (controls.editor.action !== "none") {
            switch (controls.editor.action) {
                case "move": {
                    const focus = controls.editor.focus;
                    if (!focus.selectable) {
                        const target = controls.editor.target;
                        if (target) {
                            focus.x = [target.x, target.x = focus.x][0];
                            focus.y = [target.y, target.y = focus.y][0];
                            focus.center = [structuredClone(target.center), target.center = structuredClone(focus.center)][0];
                            focus.identifier.number = [target.identifier.number, target.identifier.number = focus.identifier.number][0];

                            let grid = talentGrid;
                            if (target.parentTree !== "main") {
                                grid = ascendancyGrid.get(controls.ascendancy);
                            }
                            grid[focus.y][focus.x] = [grid[target.y][target.x], grid[target.y][target.x] = grid[focus.y][focus.x]][0];
                        }
                    }
                    break;
                }
                case "connect": {
                    const focus = controls.editor.focus;
                    if (focus.selectable) {
                        const target = controls.editor.target;
                        target.neighbors.push(focus);
                        focus.neighbors.push(target);
                    }
                    break;
                }
                case "disconnect": {
                    const focus = controls.editor.focus;
                    if (focus.selectable) {
                        const target = controls.editor.target;
                        target.neighbors = target.neighbors.filter(item => !isSameTalent(item, focus));
                        focus.neighbors = focus.neighbors.filter(item => !isSameTalent(item, target));
                    }
                    break;
                }
            }

            generateTree();
            generateAscendancyTree();
            drawLinesInitial();
            drawLinesAscendancyInitial();
            drawLinesRegular();
            drawLinesAscendancy();
            controls.editor.action = "none";
            controls.editor.indicator.replaceChildren();

            document.body.style.cursor = null;
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
        infoTooltip.container.classList.remove("visible");

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
            previousFocus = undefined;
            return;
        }

        handleNodeFocus(event);

        if (editorMenu.classList.contains("hidden")) {
            handleEditorIndicator(event);
        }

        if (!previousFocus && !ascendancyButton.classList.contains("focused")) {
            return;
        }

        infoTooltip.main.style.width = "max-content";
        const bounds = boundingRects.containers.viewport;
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

window.onresize = () => {
    updateFittedZoom();
    controls.zoom = Math.min(Math.max(controls.zoom, fittedZoom), 3.0);
    handleViewport();
};

window.onload = async () => {
    controls.editor.active = true;

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

    updateEditorMenu(document.querySelector("#editor-menu"));
    controls.editor.indicator = document.querySelector("#editor-indicator");

    infoTooltip.container = document.querySelector("#tooltip-container");
    infoTooltip.main = document.querySelector("#info-tooltip");
    infoTooltip.arrow = document.querySelector("#tooltip-arrow");
    infoTooltip.name = document.querySelector("#info-name");
    infoTooltip.stats = document.querySelector("#info-stats");

    sidePanel.allocated.statList = document.querySelector("#allocated-stat-list");

    sidePanel.character.levelLabel = document.querySelector("#player-level-label");
    sidePanel.character.level = document.querySelector("#player-level");
    sidePanel.character.level.oninput = (event) => {
        sidePanel.character.levelLabel.innerText = event.target.value;
        setUpURL();
        handleSidePanel();
    };

    document.querySelector("#import-button").onclick = handleEditorImport;
    document.querySelector("#export-button").onclick = handleEditorExport;

    const versionSelect = document.querySelector("#version-select");
    for (const release of RELEASES) {
        const option = document.createElement("option");
        option.value = release.version;
        option.innerText = release.version;
        versionSelect.append(option);
    }
    versionSelect.onchange = handleVersionChange;

    document.querySelector("#ascendancy-select").onchange = handleAscendancyChange;

    searchInput = document.querySelector("#talent-search");
    searchInput.value = "";
    searchInput.oninput = () => {
        handleSearch();
    };

    const searchInfo = document.querySelector("#talent-search-info");
    searchInfo.onmouseenter = () => {
        infoTooltip.name.innerText = "Search options";
        infoTooltip.name.style.color = "white";

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
    resetTooltipArrow();

    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            entry.target.style.visibility = entry.isIntersecting ? "visible" : "hidden";
        }
    }, {
        root: talentContainer,
    });
    for (const node of fullNodeList) {
        observer.observe(node.visual);
    }
};
