import { findDeadBranch } from "../core/algorithm.js";
import { handleSidePanel } from "../core/side-panel.js";
import { collectStatInformation, setUpURL } from "../util/spuddling.js";

/** @type {TalentNode[][]} */
export const talentGrid = [];

/** @type {Map<string, TalentNode[][]>} */
export const ascendancyGrid = new Map();

/** @type {TalentNode[]} */
export const talentNodes = [];

/** @type {Map<string, TalentNode[]>} */
export const ascendancyNodes = new Map([["none", []]]);

/** @type {TalentNode[]} */
export const fullNodeList = [];

/** @type {TalentNode[]} */
export const talentSelections = [];

/** @type {TalentNode[]} */
export const ascendancySelections = [];

/** @type {TalentNode[]} */
export const talentAddPreview = [];

/** @type {TalentNode[]} */
export const talentAddLeftovers = [];

/** @type {TalentNode[]} */
export const ascendancyAddLeftovers = [];

/** @type {TalentNode[]} */
export const talentRemovePreview = [];

/** @type {TalentNode[]} */
export const ascendancyAddPreview = [];

/** @type {TalentNode[]} */
export const ascendancyRemovePreview = [];

/** @type {Map<string, TalentNode[]>} */
export const talentExclusions = new Map();

/** @type {{nodes: Map<string, string[]>, lang: Map<string, string>}} */
export const exclusiveNodeValues = {
    nodes: new Map(),
    lang: new Map(),
};

/** @type {TalentNode} */
export let startingNode = undefined;
export const updateStartingNode = (node) => {
    startingNode = node;
};

/** @type {Map<string, TalentNode>} */
export const ascendancyStartNodes = new Map();

/** @type {HTMLDivElement} */
export let targetTree = undefined;
export const updateTargetTree = (element) => {
    targetTree = element;
};

export let TOTAL_POINTS = 0;
export const updatePoints = (value) => {
    TOTAL_POINTS = value;
};

export let TOTAL_ASCENDANCY_POINTS = 0;
export const updateAscendancyPoints = (value) => {
    TOTAL_ASCENDANCY_POINTS = value;
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
    /** @type {string[]} */
    keywords = [];
    name = "";
    type = "stat";
    /** @type {Object[]} */
    stats = [];
    /** @type {HTMLDivElement} */
    visual = undefined;
    selectable = false;
    selected = false;
    update = () => {
        console.error("Non-overloaded talent update was called!");
    };
    /** @type {TalentNode[]} */
    neighbors = [];
    parentTree = "main";
    travel = {
        /** @type {TalentNode} */
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
        this.center.x = input.x;
        this.center.y = input.y;
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
        this.update = () => {
            console.error("Default talent update was called!");
        };
        this.neighbors = [];
        this.parentTree = input.parentTree;
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
    let origin = startingNode;
    let selections = talentSelections;
    let exclusive = "start";
    let totalPoints = TOTAL_POINTS;
    let preview = talentAddPreview;
    let leftovers = talentAddLeftovers;

    if (node.parentTree !== "main") {
        origin = ascendancyStartNodes.get(node.parentTree);
        selections = ascendancySelections;
        exclusive = "ascendancy";
        totalPoints = TOTAL_ASCENDANCY_POINTS;
        preview = ascendancyAddPreview;
        leftovers = ascendancyAddLeftovers;
    }

    const isClassNode = exclusiveNodeValues.nodes.get(exclusive).includes(node.identifier.talent);
    if (!origin && !isClassNode) {
        return;
    }

    if (!node.selected) {
        for (const values of exclusiveNodeValues.nodes.values()) {
            const existingSelection = selections.find(item => values.includes(item.identifier.talent));
            if (existingSelection && values.includes(node.identifier.talent)) {
                return;
            }
        }
    }

    if (node.selected) {
        const deadBranch = findDeadBranch(origin, node);

        for (const talent of deadBranch) {
            talent.selected = false;
        }

        const temp = selections.filter(item => item.selected);
        selections.length = 0;
        selections.push(...temp);

        for (const talent of deadBranch) {
            talent.update();
        }

        for (const neighbor of node.neighbors) {
            neighbor.update();
        }

        if (origin?.identifier.number === node.identifier.number) {
            if (node.parentTree === "main") {
                updateStartingNode(undefined);
            } else {
                ascendancyStartNodes.set(node.parentTree, undefined);
            }
        }
    } else {
        if ((selections.length + (preview.length - 1)) > totalPoints) {
            if (((preview.length - 1) - (leftovers.length - 1)) > 0) {
                selections.push(...preview.toSpliced(0, leftovers.length - 1).toSpliced(-1, 1));
            }
        } else {
            if (!isPreset && origin && selections.length > 0) {
                const allNodes = new Set([...selections, ...preview]);
                selections.length = 0;
                selections.push(...allNodes);
            } else if (!origin || !isClassNode) {
                selections.push(node);
            }

            if (!origin && isClassNode) {
                if (node.parentTree === "main") {
                    updateStartingNode(node);
                } else {
                    ascendancyStartNodes.set(node.parentTree, node);
                }
            }
        }
    }

    for (const talent of selections) {
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
    document.querySelector("#ascendancy-points").innerText = `${TOTAL_ASCENDANCY_POINTS - ascendancySelections.length}`;
};
