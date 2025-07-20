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
        let preview = talentRemovePreview;
        if (talent.parentTree !== "main") {
            start = ascendancyStartNodes.get(talent.parentTree);
            preview = ascendancyRemovePreview;
        }

        const droppedNodes = new Set([...findDeadBranch(start, talent)]);
        preview.clear();
        for (const node of droppedNodes) {
            preview.set(node, new Set(node.neighbors.filter(item => droppedNodes.has(item)).map(item => item.identifier.number)));
        }
        nodeTotal = -preview.size;

        for (const node of preview.keys()) {
            node.visual.classList.add("preview-remove");
        }

        preview.set(talent, new Set(talent.neighbors.filter(item => item.selected).map(item => item.identifier.number)));
    } else {
        let selectionsLength = talentSelections.length;
        let preview = talentAddPreview;
        let leftovers = talentAddLeftovers;
        let totalPoints = TOTAL_POINTS;

        if (talent.parentTree !== "main") {
            selectionsLength = ascendancySelections.length;
            preview = ascendancyAddPreview;
            leftovers = ascendancyAddLeftovers;
            totalPoints = TOTAL_ASCENDANCY_POINTS;
        }

        const addedNodes = new Set(findShortestRoute(talent));
        const realPath = [...addedNodes].reverse();

        preview.clear();
        for (const node of addedNodes) {
            preview.set(node, new Set(node.neighbors.filter(item => addedNodes.has(item)).map(item => item.identifier.number)));
        }

        nodeTotal = preview.size;
        if (preview.size > 1) {
            nodeTotal = preview.size - 1;
            leftovers.clear();

            const possiblePoints = selectionsLength + (realPath.length - 1);
            if (possiblePoints > totalPoints) {
                nodeOverflow = totalPoints - possiblePoints;
                for (const node of realPath.slice(nodeOverflow - 1).slice(1)) {
                    leftovers.set(node, new Set(node.neighbors.filter(item => addedNodes.has(item)).map(item => item.identifier.number)));
                }
                realPath.splice(nodeOverflow);
            }
        }

        realPath.splice(0, 1);
        for (const node of realPath) {
            node.visual.classList.add("preview-add");
        }
    }

    let color = colorMap.minecraft.get("f");
    if (talent.type === "major") {
        color = colorMap.minecraft.get("5");
    } else if (talent.type === "asc") {
        color = colorMap.minecraft.get("6");
    }

    let countColor = colorMap.minecraft.get("f");
    if (nodeTotal > 0) {
        countColor = colorMap.minecraft.get("a");
    } else if (nodeTotal < 0) {
        countColor = colorMap.minecraft.get("c");
    }

    let overflowText = "";
    if (nodeOverflow !== 0) {
        overflowText = `<span>(<span style="color: ${colorMap.minecraft.get("c")}">${nodeOverflow.toLocaleString("en", { signDisplay: "exceptZero" })}</span>)</span>`;
    }

    infoTooltip.name.style.color = color;
    infoTooltip.name.innerText = talent.name;
    infoTooltip.node.count.innerHTML = `<span style="color: ${countColor}">${nodeTotal.toLocaleString("en", { signDisplay: "exceptZero" })}</span>${overflowText}`;
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

        const isMinusGood = stat["minus_is_good"];
        let valueColor = "§c";
        if ((value > 0) && !isMinusGood) {
            valueColor = "§a";
        } else if ((value < 0) && isMinusGood) {
            valueColor = "§a";
        }

        const percentText = stat["is_percent"] ? "%" : "";

        let moreText = "";
        if (stat["type"] === "more") {
            moreText = "§cLess";
            if (value > 0) {
                moreText = "§aMore";
            }
        }

        /** @type {string} */
        const description = stat["description"].replace(/\[VAL1]%?/, `${valueColor}${value.toLocaleString("en", { signDisplay: "exceptZero" })}${percentText}${moreText}`);
        formatted.push(`<div style="display: flex;">${bullet}<p style="display: inline-block; margin: 0;">${generateDescriptionHTML(description)}</p></div>`);
    }

    if (talent.exclusive) {
        for (const [key, values] of exclusiveNodeValues.nodes) {
            if (values.includes(talent.identifier.talent)) {
                formatted.push(`<span style="color: ${colorMap.minecraft.get("a")};">Can only have one Perk of this type: ${exclusiveNodeValues.lang.get(key)}</span>`);
                break;
            }
        }
    }

    if (talent.type === "major") {
        formatted.push(`<span style="color: red;">Game Changer Talent</span>`);
    }
    infoTooltip.stats.innerHTML = formatted.join("");

    infoTooltip.container.classList.remove("invisible");
    infoTooltip.container.classList.add("visible");
};
