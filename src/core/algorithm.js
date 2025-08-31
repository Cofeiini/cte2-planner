import {
    ascendancyGrid,
    ascendancySelections,
    ascendancyStartNodes,
    exclusiveNodeValues,
    fullNodeList,
    startingNode,
    talentGrid,
    talentSelections,
} from "../type/talent-node.js";
import { isSameTalent } from "../util/spuddling.js";

/**
 * @param {number} level
 * @param {number} value
 * @returns {number}
 */
export const scaleValueToLevel = (level, value) => {
    return value * (1 + (0.2 * (level - 1)));
};

const resetHeuristics = () => {
    for (const talent of fullNodeList) {
        talent.travel.source = undefined;
        talent.travel.visited = false;
    }
};

/**
 * @param {TalentNode} start
 * @param {TalentNode} skip
 * @returns {Set<TalentNode>}
 */
const findReachable = (start, skip = undefined) => {
    resetHeuristics();

    const path = new Set();
    const stack = [start];

    while (stack.length > 0) {
        const node = stack.pop();
        if (!node.selected) {
            continue;
        }

        if (node.travel.visited) {
            continue;
        }

        if (node.identifier.number === skip?.identifier?.number) {
            continue;
        }

        node.travel.visited = true;
        path.add(node);

        for (const neighbor of node.neighbors) {
            if (neighbor.identifier.number === skip?.identifier?.number) {
                continue;
            }

            stack.push(neighbor);
        }
    }

    return path;
};

/**
 * @param {TalentNode} start
 * @param {TalentNode} target
 * @returns {Set<TalentNode>}
 */
export const findRemovedBranch = (start, target) => {
    const allSelected = findReachable(start);
    const reachable = findReachable(start, target);

    return allSelected.difference(reachable);
};

/**
 * @param {TalentNode} target
 * @returns {string[]}
 */
const listExcluded = (target) => {
    let selections = talentSelections;
    let exclude = "start";
    if (target.parentTree !== "main") {
        selections = ascendancySelections;
        exclude = "ascendancy";
    }

    /** @type {string[]} */
    const excluded = [];
    for (const values of exclusiveNodeValues.nodes.values()) {
        if (selections.some(item => item.exclusive && values.includes(item.identifier.talent))) {
            excluded.push(...values);
        }
    }

    if (!origin) {
        excluded.push(...exclusiveNodeValues.nodes.get(exclude));
    }

    return excluded;
};

/**
 * @param {TalentNode} target
 * @param {string[]} excluded
 * @returns {Set<TalentNode> | undefined}
 */
const checkOrigin = (target, excluded) => {
    let origin = startingNode;
    if (target.parentTree !== "main") {
        origin = ascendancyStartNodes.get(target.parentTree);
    }

    if (excluded.includes(target.identifier.talent)) {
        if (origin) {
            return new Set();
        }

        return new Set([target]);
    }

    return undefined;
};

/**
 * @param {TalentNode} target
 * @returns {Set<TalentNode>}
 */
export const findShortestRoute = (target) => {
    const excluded = listExcluded(target);
    const checkedPath = checkOrigin(target, excluded);
    if (checkedPath) {
        return checkedPath;
    }

    let selections = talentSelections;
    if (target.parentTree !== "main") {
        selections = ascendancySelections;
    }

    if (selections.some(item => isSameTalent(item, target))) {
        return new Set([target]);
    }

    for (const talent of fullNodeList) {
        talent.travel.source = undefined;
        talent.travel.visited = false;
    }

    /** @type {TalentNode[]} */
    const queue = [];

    for (const node of selections) {
        queue.push(node);
        node.travel.visited = true;
    }

    while (queue.length > 0) {
        const current = queue.shift();

        if (isSameTalent(current, target)) {
            /** @type {TalentNode[]} */
            const path = [];

            let node = current;
            while (node) {
                path.push(node);
                node = node.travel.source;
            }

            return new Set(path);
        }

        for (const neighbor of current.neighbors) {
            if (neighbor.travel.visited) {
                continue;
            }

            if (neighbor.exclusive && excluded.includes(neighbor.identifier.talent)) {
                continue;
            }

            neighbor.travel.visited = true;
            neighbor.travel.source = current;
            queue.push(neighbor);
        }
    }

    return new Set();
};

/**
 * @param {TalentNode} current
 * @param {TalentNode[]} route
 * @returns {TalentNode[]}
 */
export const generatePath = (current, route) => {
    const path = [];
    for (let y = -1; y <= 1; ++y) {
        for (let x = -1; x <= 1; ++x) {
            if (x === 0 && y === 0) {
                continue;
            }

            const node = talentGrid.at(current.y + y)?.at(current.x + x);
            if (!node) {
                continue;
            }

            if (route.some(item => isSameTalent(item, node))) {
                continue;
            }

            if (node.selectable) {
                path.push({
                    node: node,
                    steps: route.length,
                });
                continue;
            }

            if (node.identifier.talent === current.identifier.talent) {
                generatePath(node, [...route, node]).forEach(item => path.push({
                    node: item,
                    steps: route.length + 1,
                }));
            }
        }
    }

    if (path.length === 0) {
        return [];
    }

    let steps = Number.MAX_VALUE;
    for (const item of path) {
        if (item.steps < steps) {
            steps = item.steps;
        }
    }

    return path.filter(item => item.steps <= steps).map(item => item.node);
};

/**
 * @param {string} ascendancy
 * @param {TalentNode} current
 * @param {TalentNode[]} route
 * @returns {TalentNode[]}
 */
export const generateAscendancyPath = (ascendancy, current, route) => {
    const grid = ascendancyGrid.get(ascendancy);

    const path = [];
    for (let y = -1; y <= 1; ++y) {
        for (let x = -1; x <= 1; ++x) {
            if (x === 0 && y === 0) {
                continue;
            }

            const node = grid.at(current.y + y)?.at(current.x + x);
            if (!node) {
                continue;
            }

            if (route.some(item => isSameTalent(item, node))) {
                continue;
            }

            if (node.selectable) {
                path.push({
                    node: node,
                    steps: route.length,
                });
                continue;
            }

            if (node.identifier.talent === current.identifier.talent) {
                generateAscendancyPath(ascendancy, node, [...route, node]).forEach(item => path.push({
                    node: item,
                    steps: route.length + 1,
                }));
            }
        }
    }

    if (path.length === 0) {
        return [];
    }

    let steps = Number.MAX_VALUE;
    for (const item of path) {
        if (item.steps < steps) {
            steps = item.steps;
        }
    }

    return path.filter(item => item.steps <= steps).map(item => item.node);
};
