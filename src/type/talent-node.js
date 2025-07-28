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
export const excludedTalentNodes = [];

/** @type {TalentNode[]} */
export const excludedAscendancyNodes = [];

/** @type {TalentNode[]} */
export const fullNodeList = [];

/** @type {TalentNode[]} */
export const talentSelections = [];

/** @type {TalentNode[]} */
export const ascendancySelections = [];

/** @type {Map<TalentNode, Set<number>>} */
export const talentAddPreview = new Map();

/** @type {Map<TalentNode, Set<number>>} */
export const talentAddLeftovers = new Map();

/** @type {Map<TalentNode, Set<number>>} */
export const ascendancyAddLeftovers = new Map();

/** @type {Map<TalentNode, Set<number>>} */
export const talentRemovePreview = new Map();

/** @type {Map<TalentNode, Set<number>>} */
export const ascendancyAddPreview = new Map();

/** @type {Map<TalentNode, Set<number>>} */
export const ascendancyRemovePreview = new Map();

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
    exclusive = false;
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
        visited: false,
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
        this.exclusive = false;
        this.selected = false;
        this.update = () => {
            console.error("Default talent update was called!");
        };
        this.neighbors = [];
        this.parentTree = input.parentTree;
        this.travel.source = undefined;
        this.travel.visited = false;
    }
}

/**
 * @param {TalentNode} node
 * @param {boolean} isPreset
 */
export const toggleNode = (node, isPreset = false) => {
    let origin = startingNode;
    let selections = talentSelections;
    let excluded = excludedTalentNodes;
    let preview = talentAddPreview;
    let removePreview = talentRemovePreview;
    let leftovers = talentAddLeftovers;
    let oneKind = "start";
    let totalPoints = TOTAL_POINTS;

    if (node.parentTree !== "main") {
        origin = ascendancyStartNodes.get(node.parentTree);
        selections = ascendancySelections;
        excluded = excludedAscendancyNodes;
        preview = ascendancyAddPreview;
        removePreview = ascendancyRemovePreview;
        leftovers = ascendancyAddLeftovers;
        oneKind = "ascendancy";
        totalPoints = TOTAL_ASCENDANCY_POINTS;
    }

    const isStartingNode = exclusiveNodeValues.nodes.get(oneKind).includes(node.identifier.talent);
    if (!origin && !isStartingNode) {
        return;
    }

    if (!node.selected) {
        for (const values of exclusiveNodeValues.nodes.values()) {
            const existingSelection = selections.find(item => item.exclusive && values.includes(item.identifier.talent));
            if (existingSelection && values.includes(node.identifier.talent)) {
                return;
            }
        }
    }

    const selectedCount = selections.length;
    if (node.selected) {
        let removed = Array.from(removePreview.keys());
        if (removePreview.size === 0) {
            removed = findDeadBranch(origin, node);
        }

        for (const talent of removed) {
            talent.selected = false;
            talent.update();

            for (const neighbor of talent.neighbors) {
                neighbor.update();
            }
        }

        const temp = selections.filter(item => item.selected);
        selections.length = 0;
        selections.push(...temp);

        if (origin?.identifier.number === node.identifier.number) {
            if (node.parentTree === "main") {
                updateStartingNode(undefined);
            } else {
                ascendancyStartNodes.set(node.parentTree, undefined);
            }
        }
    } else {
        let addedNodes = Array.from(preview.keys()).filter(item => !item.selected);
        if (leftovers.size > 0) {
            addedNodes = new Set(addedNodes).difference(new Set(leftovers.keys()));
        }

        if (isPreset || (addedNodes.length === 0)) {
            addedNodes = [node];
            selections.push(node);
        } else {
            const allNodes = new Set([...selections, ...addedNodes]);
            selections.length = 0;
            selections.push(...allNodes);
        }

        for (const talent of addedNodes) {
            talent.selected = true;
            talent.update();

            for (const neighbor of talent.neighbors) {
                neighbor.update();
            }
        }

        if (!origin && isStartingNode) {
            if (node.parentTree === "main") {
                updateStartingNode(node);
            } else {
                ascendancyStartNodes.set(node.parentTree, node);
            }
        }
    }

    if (selections.length !== selectedCount) {
        if ((selections.length >= totalPoints) || (selectedCount >= totalPoints)) {
            /** @type {Set<TalentNode>} */
            const updatable = new Set(selections.map(item => item.neighbors.filter(neighbor => !neighbor.selected)).flat(Infinity));
            for (const talent of updatable) {
                talent.update();
            }
        }

        if (!isPreset) {
            collectStatInformation();
            handleSidePanel();

            excluded.length = 0;
            for (const values of talentExclusions.values()) {
                if (selections.some(item => item.exclusive && values.some(element => item.identifier.number === element.identifier.number))) {
                    excluded.push(...values);
                }
            }

            setUpURL();
        }
    }

    document.querySelector("#talent-points").innerText = `${TOTAL_POINTS - talentSelections.length}`;
    document.querySelector("#ascendancy-points").innerText = `${TOTAL_ASCENDANCY_POINTS - ascendancySelections.length}`;
};
