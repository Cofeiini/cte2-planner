import { colorMap } from "../data/constants.js";
import {
    ascendancyAddLeftovers,
    ascendancyAddPreview,
    ascendancyRemovePreview,
    ascendancySelections,
    ascendancyStartNodes,
    exclusiveNodeValues,
    startingNode,
    talentAddLeftovers,
    talentAddPreview,
    talentRemovePreview,
    talentSelections,
    TOTAL_ASCENDANCY_POINTS,
    TOTAL_POINTS,
} from "../type/talent-node.js";
import { generateDescriptionHTML } from "../util/generating.js";
import { findDeadBranch, findShortestRoute, scaleValueToLevel } from "./algorithm.js";
import { sidePanel } from "./side-panel.js";

export const infoTooltip = {
    /** @type {HTMLDivElement} */
    container: undefined,
    /** @type {HTMLDivElement} */
    main: undefined,
    /** @type {HTMLDivElement} */
    arrow: undefined,
    /** @type {HTMLDivElement} */
    name: undefined,
    node: {
        /** @type {HTMLDivElement} */
        count: undefined,
        /** @type {HTMLDivElement} */
        text: undefined,
    },
    /** @type {HTMLDivElement} */
    stats: undefined,
};

export const tooltipOffsets = {
    pointer: 20,
    arrow: 6,
    edge: 2,
};

/**
 * @param {TalentNode} talent
 */
export const handleTooltip = (talent) => {
    let nodeTotal = 0;
    let nodeOverflow = 0;
    if (talent.selected) {
        let start = startingNode;
        let selections = talentSelections;
        if (talent.parentTree !== "main") {
            start = ascendancyStartNodes.get(talent.parentTree);
            selections = ascendancySelections;
        }

        const previewNeighbors = selections.filter(item => talent.neighbors.some(element => item.identifier.number === element.identifier.number));
        talentRemovePreview.length = 0;
        talentRemovePreview.push(...findDeadBranch(start, talent), ...previewNeighbors);
        nodeTotal = -(talentRemovePreview.length - previewNeighbors.length);
        if (talent.parentTree !== "main") {
            ascendancyRemovePreview.length = 0;
            ascendancyRemovePreview.push(...talentRemovePreview);

            talentRemovePreview.length = 0;
            nodeTotal = -(ascendancyRemovePreview.length - previewNeighbors.length);
        }
    } else {
        talentAddPreview.length = 0;
        talentAddPreview.push(...findShortestRoute(talent));

        if (talent.parentTree === "main") {
            nodeTotal = talentAddPreview.length;
            if (talentAddPreview.length > 1) {
                nodeTotal = talentAddPreview.length - 1;
                talentAddLeftovers.length = 0;

                const realPath = [...talentAddPreview].reverse();
                const possiblePoints = talentSelections.length + (realPath.length - 1);
                if (possiblePoints > TOTAL_POINTS) {
                    nodeOverflow = TOTAL_POINTS - possiblePoints;
                    talentAddLeftovers.push(...realPath.slice(TOTAL_POINTS - possiblePoints - 1));
                }
            }
        } else {
            ascendancyAddPreview.length = 0;
            ascendancyAddPreview.push(...talentAddPreview);
            talentAddPreview.length = 0;

            nodeTotal = ascendancyAddPreview.length;
            if (ascendancyAddPreview.length > 1) {
                nodeTotal = ascendancyAddPreview.length - 1;
                ascendancyAddLeftovers.length = 0;

                const realPath = [...ascendancyAddPreview].reverse();
                const possiblePoints = ascendancySelections.length + (realPath.length - 1);
                if (possiblePoints > TOTAL_ASCENDANCY_POINTS) {
                    nodeOverflow = TOTAL_ASCENDANCY_POINTS - possiblePoints;
                    ascendancyAddLeftovers.push(...realPath.slice(TOTAL_ASCENDANCY_POINTS - possiblePoints - 1));
                }
            }
        }
    }

    let color = colorMap.minecraft.get("f");
    if (talent.type === "major") {
        color = colorMap.minecraft.get("5");
    } else if (talent.type === "asc") {
        color = colorMap.minecraft.get("6");
    }

    let nodeColor = colorMap.minecraft.get("f");
    if (nodeTotal > 0) {
        nodeColor = colorMap.minecraft.get("a");
    } else if (nodeTotal < 0) {
        nodeColor = colorMap.minecraft.get("c");
    }

    let overflowText = "";
    if (nodeOverflow !== 0) {
        overflowText = `<span>(<span style="color: ${colorMap.minecraft.get("c")}">${nodeOverflow.toLocaleString("en", { signDisplay: "exceptZero" })}</span>)</span>`;
    }

    infoTooltip.name.style.color = color;
    infoTooltip.name.innerText = talent.name;
    infoTooltip.node.count.innerHTML = `<span style="color: ${nodeColor}">${nodeTotal.toLocaleString("en", { signDisplay: "exceptZero" })}</span>${overflowText}`;
    infoTooltip.node.text.innerText = `Node${(Math.abs(nodeTotal) === 1) ? "" : "s"}`;

    const level = parseInt(sidePanel.character.level.value);
    const formatted = [];
    for (const stat of talent.stats) {
        let bullet = "";
        if (stat["is_long"]) {
            bullet = `<span style="color: purple; margin-right: 0.25em;">&#9670;</span>`;
        }

        let value = parseFloat(stat["v1"]);
        if (stat["scale_to_lvl"]) {
            value = scaleValueToLevel(level, value);
        }
        if (Math.abs(value) >= 15.0) {
            value = Math.trunc(value);
        }

        const description = stat["description"].replace("[VAL1]", value.toLocaleString("en", { signDisplay: "exceptZero" }));
        formatted.push(`<div style="display: flex;">${bullet}<p style="display: inline-block; margin: 0;">${generateDescriptionHTML(description)}</p></div>`);
    }

    for (const [key, values] of exclusiveNodeValues.nodes) {
        if (values.some(item => talent.identifier.talent === item)) {
            formatted.push(`<span style="color: ${colorMap.minecraft.get("a")};">Can only have one Perk of this type: ${exclusiveNodeValues.lang.get(key)}</span>`);
            break;
        }
    }

    if (talent.type === "major") {
        formatted.push(`<span style="color: red;">Game Changer Talent</span>`);
    }
    infoTooltip.stats.innerHTML = formatted.join("");

    infoTooltip.container.classList.remove("invisible");
    infoTooltip.container.classList.add("visible");
};
