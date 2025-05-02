import { colorMap } from "../data/constants.js";
import { startingNode, talentAddPreview, talentRemovePreview, talentSelections } from "../type/talent-node.js";
import { generateDescriptionHTML } from "../util/generating.js";
import { findDeadBranch, findShortestRoute, scaleValueToLevel } from "./algorithm.js";
import { sidePanel } from "./side-panel.js";

export const infoTooltip = {
    main: undefined,
    name: undefined,
    node: {
        count: undefined,
        text: undefined,
    },
    stats: undefined,
};

/**
 * @param {TalentNode} talent
 */
export const handleTooltip = (talent) => {
    let nodeTotal = 0;
    if (talent.selected) {
        const previewNeighbors = talentSelections.filter(item => talent.neighbors.some(element => item.identifier.number === element.identifier.number));
        talentRemovePreview.length = 0;
        talentRemovePreview.push(...findDeadBranch(startingNode, talent), ...previewNeighbors);
        nodeTotal = -(talentRemovePreview.length - previewNeighbors.length);
    } else {
        talentAddPreview.length = 0;
        talentAddPreview.push(...findShortestRoute(talent));
        nodeTotal = talentAddPreview.length;
        if (talentAddPreview.length > 1) {
            nodeTotal = talentAddPreview.length - 1;
        }
    }

    infoTooltip.name.innerText = talent.name;
    infoTooltip.name.style.color = (talent.type === "major") ? colorMap.get("5") : colorMap.get("f");
    infoTooltip.node.count.innerText = nodeTotal.toLocaleString("en", { signDisplay: "exceptZero" });
    infoTooltip.node.text.innerText = `Node${(Math.abs(nodeTotal) === 1) ? "" : "s"}`;

    const level = parseInt(sidePanel.character.level.value);
    const formatted = [];
    for (const stat of talent.stats) {
        let bullet = "";
        if (stat.type.toLowerCase() !== "more") {
            bullet = `<span style="color: purple;">&#9670;</span>`;
        }

        let value = parseFloat(stat["v1"]);
        if (stat["scale_to_lvl"]) {
            value = scaleValueToLevel(level, value);
        }
        const description = stat["description"].replace("[VAL1]", value.toLocaleString("en", { signDisplay: "exceptZero" }));
        formatted.push(`<div style="display: flex;">${bullet}<p style="display: inline-block; margin: 0;">${generateDescriptionHTML(description)}</p></div>`);
    }
    if (talent.type === "major") {
        formatted.push(`<span style="color: red;">Game Changer Talent</span>`);
    }
    infoTooltip.stats.innerHTML = formatted.join("");

    infoTooltip.main.classList.remove("invisible");
    infoTooltip.main.classList.add("visible");
};
