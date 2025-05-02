import { findDeadBranch, findRoutes } from "../core/algorithm.js";
import { handleSidePanel } from "../core/side-panel.js";
import { CELL_HALF, CELL_SIZE } from "../data/constants.js";
import { collectStatInformation, setUpURL } from "../util/spuddling.js";

/** @type {TalentNode[][]} */
export const talentGrid = [];

/** @type {TalentNode[]} */
export const talentNodes = [];

/** @type {TalentNode[]} */
export const talentSelections = [];

/** @type {TalentNode[]} */
export const talentAddPreview = [];

/** @type {TalentNode[]} */
export const talentAddLeftovers = [];

/** @type {TalentNode[]} */
export const talentRemovePreview = [];

/** @type {Map<string, TalentNode[]>} */
export const talentExclusions = new Map();

/** @type {Map<string, string[]>} */
export const exclusiveNodeValues = new Map();

/** @type {TalentNode|undefined} */
export let startingNode = undefined;

export const updateStartingNode = (node) => {
    startingNode = node;
};

export let TOTAL_POINTS = 0;

export const updatePoints = (value) => {
    TOTAL_POINTS = value;
};

export class TalentNode {
    x = 0;
    y = 0;
    center = {
        x: 0,
        y: 0,
    };
    identifier = {
        number: 0,
        talent: "",
        data: "",
    };
    keywords = [];
    name = "";
    type = "stat";
    stats = [];
    visual = undefined;
    selectable = false;
    selected = false;
    update = () => {};
    neighbors = [];
    travel = {
        source: undefined,
        closed: false,
        visited: false,
        cost: {
            total: 0,
            accumulated: 0,
            heuristic: 0,
        },
    };

    constructor(input) {
        this.x = input.x;
        this.y = input.y;
        this.center.x = (input.x * CELL_SIZE) + CELL_HALF;
        this.center.y = (input.y * CELL_SIZE) + CELL_HALF;
        this.identifier.number = input.x + (input.y * input.length);
        this.identifier.talent = input.value;
        this.identifier.data = "";
        this.keywords = [];
        this.name = "";
        this.type = "stat";
        this.stats = [];
        this.visual = undefined;
        this.selectable = (input.value.length > 1) && input.value !== "[CENTER]";
        this.selected = false;
        this.update = undefined;
        this.neighbors = [];
        this.travel.source = undefined;
        this.travel.closed = false;
        this.travel.visited = false;
        this.travel.cost.total = 0;
        this.travel.cost.accumulated = 0;
        this.travel.cost.heuristic = 0;
    }
}

/**
 * @param {TalentNode} node
 * @param {boolean} isPreset
 */
export const toggleNode = (node, isPreset = false) => {
    const isClassNode = exclusiveNodeValues.get("start").includes(node.identifier.talent);
    if (!startingNode && !isClassNode) {
        return;
    }

    if (!node.selected) {
        for (const values of exclusiveNodeValues.values()) {
            const existingSelection = talentSelections.find(item => values.includes(item.identifier.talent));
            if (existingSelection && values.includes(node.identifier.talent)) {
                return;
            }
        }
    }

    node.selected = !node.selected;

    if (node.selected) {
        if ((talentSelections.length + (talentAddPreview.length - 1)) > TOTAL_POINTS) {
            node.selected = false;
        }

        if (node.selected) {
            if (!isPreset && startingNode && talentSelections.length > 0) {
                findRoutes(node);
            } else if (!startingNode || !exclusiveNodeValues.get("start").some(item => item === node.identifier.talent)) {
                talentSelections.push(node);
            }

            if (!startingNode && isClassNode) {
                updateStartingNode(node);
            }
        }
    } else {
        const deadBranch = findDeadBranch(startingNode, node);

        for (const talent of deadBranch) {
            talent.selected = false;
        }

        talentSelections.length = 0;
        talentSelections.push(...talentSelections.filter(item => item.selected));

        for (const talent of deadBranch) {
            talent.update();
        }

        for (const neighbor of node.neighbors) {
            neighbor.update();
        }

        if (startingNode?.identifier.number === node.identifier.number) {
            updateStartingNode(undefined);
        }
    }

    for (const talent of talentSelections) {
        talent.selected = true;
        talent.update();

        for (const neighbor of talent.neighbors) {
            neighbor.update();
        }
    }

    collectStatInformation();

    handleSidePanel();

    if (!isPreset) {
        setUpURL();
    }

    document.querySelector("#talent-points").innerText = `${TOTAL_POINTS - talentSelections.length}`;
};
