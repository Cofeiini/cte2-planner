import { BinaryHeap } from "../type/binary-heap.js";
import {
    ascendancyGrid,
    ascendancySelections,
    ascendancyStartNodes,
    exclusiveNodeValues,
    fullNodeList,
    startingNode,
    talentExclusions,
    talentGrid,
    talentSelections,
} from "../type/talent-node.js";

/**
 * @param {number} level
 * @param {number} value
 * @returns {number}
 */
export const scaleValueToLevel = (level, value) => {
    return value * (1 + (0.2 * (level - 1)));
};

/**
 * @param {TalentNode} node
 * @param {TalentNode[][]} paths
 * @param {Set<TalentNode>} collected
 */
export const searchNodes = (node, paths, collected) => {
    const visited = new Set();

    const search = (current) => {
        visited.add(current.identifier.number);
        collected.add(current);

        for (const neighbor of current.neighbors) {
            if (visited.has(neighbor.identifier.number)) {
                continue;
            }

            if (!neighbor.selected) {
                continue;
            }

            if (paths.some(item => item.some(element => element.identifier.number === neighbor.identifier.number))) {
                continue;
            }

            search(neighbor);
        }
    };

    search(node);
};

/**
 * @param {TalentNode} start
 * @param {TalentNode} end
 * @param {TalentNode[]} currentPath
 * @param {TalentNode[][]} allPaths
 */
export const findPaths = (start, end, currentPath, allPaths) => {
    const node = currentPath.at(-1);
    if (node.identifier.number === end.identifier.number) {
        allPaths.push(currentPath);
        return;
    }

    for (const neighbor of node.neighbors) {
        if (currentPath.some(item => item.identifier.number === neighbor.identifier.number)) {
            continue;
        }

        if (!neighbor.selected) {
            continue;
        }

        findPaths(start, end, [...currentPath, neighbor], allPaths);
    }
};

/**
 * @param {TalentNode} start
 * @param {TalentNode} target
 * @returns {TalentNode[]}
 */
export const findDeadBranch = (start, target) => {
    if (!start) {
        return [];
    }

    const paths = [];
    findPaths(start, target, [start], paths);

    if (!paths.some(item => item.some(element => element.identifier.number === target.identifier.number))) {
        return [];
    }

    const nodesToRemove = new Set();
    searchNodes(target, paths, nodesToRemove);

    return Array.from(nodesToRemove);
};

/**
 * @param {TalentNode} start
 * @param {TalentNode} end
 * @returns {number}
 */
export const findDistance = (start, end) => {
    const excluded = exclusiveNodeValues.nodes.get("start");

    const queue = [[start, 0]];
    const visited = new Set([start.identifier.number]);

    while (queue.length > 0) {
        const [node, distance] = queue.shift();
        if (node.identifier.number === end.identifier.number) {
            return distance;
        }

        for (const neighbor of node.neighbors) {
            if (visited.has(neighbor.identifier.number)) {
                continue;
            }

            if (excluded.includes(neighbor.identifier.talent)) {
                continue;
            }

            visited.add(neighbor.identifier.number);
            queue.push([neighbor, distance + 1]);
        }
    }

    return 0;
};

export const resetNodeHeuristics = () => {
    for (const talent of fullNodeList) {
        talent.travel.source = undefined;
        talent.travel.closed = false;
        talent.travel.cost.total = Number.MAX_VALUE;
        talent.travel.cost.accumulated = 0;
        talent.travel.cost.heuristic = 0;
    }
};

/**
 * @param {TalentNode} start
 * @param {TalentNode} end
 * @returns {TalentNode[]}
 */
export const algorithm = (start, end) => {
    resetNodeHeuristics();

    for (const node of talentExclusions.get("start")) {
        node.travel.closed = true;
    }

    const openHeap = new BinaryHeap();
    openHeap.push(start);
    start.travel.cost.heuristic = findDistance(start, end);

    while (openHeap.size() > 0) {
        const currentNode = openHeap.pop();

        if (currentNode.identifier.number === end.identifier.number) {
            const path = [currentNode];

            let temp = currentNode;
            while (temp.travel.source) {
                path.push(temp.travel.source);
                temp = temp.travel.source;
            }

            return path;
        }

        currentNode.travel.closed = true;
        for (const neighbor of currentNode.neighbors) {
            if (neighbor.travel.closed) {
                continue;
            }

            const accumulated = currentNode.travel.cost.accumulated + 1;
            const visited = neighbor.travel.closed;
            if (!visited || (accumulated < neighbor.travel.cost.accumulated)) {
                neighbor.travel.closed = true;
                neighbor.travel.source = currentNode;
                neighbor.travel.cost.heuristic = neighbor.travel.cost.heuristic || findDistance(neighbor, end);
                neighbor.travel.cost.accumulated = accumulated;
                neighbor.travel.cost.total = neighbor.travel.cost.accumulated + neighbor.travel.cost.heuristic;

                if (visited) {
                    openHeap.rescore(neighbor);
                } else {
                    openHeap.push(neighbor);
                }
            }
        }
    }

    return [];
};

/**
 * @param {TalentNode} target
 * @returns {TalentNode[]}
 */
export const findShortestRoute = (target) => {
    let origin = startingNode;
    let selections = talentSelections;
    let exclude = "start";
    if (target.parentTree !== "main") {
        origin = ascendancyStartNodes.get(target.parentTree);
        selections = ascendancySelections;
        exclude = "ascendancy";
    }

    /** @type {string[]} */
    const excluded = [];
    for (const values of exclusiveNodeValues.nodes.values()) {
        if (selections.some(item => values.some(element => item.identifier.talent === element))) {
            excluded.push(...values);
        }
    }

    if (!origin) {
        excluded.push(...exclusiveNodeValues.nodes.get(exclude));
    }

    if (excluded.some(item => item === target.identifier.talent)) {
        if (origin) {
            return [];
        }

        return [target];
    }

    let distant = Number.MAX_VALUE;
    const routeList = [];
    for (const start of selections) {
        if (start.identifier.number === target.identifier.number) {
            continue;
        }

        const current = findDistance(start, target);
        if (current <= distant) {
            distant = current;
            routeList.push(algorithm(start, target));
        }
    }

    let shortest = [];
    let min = Number.MAX_VALUE;
    for (const route of routeList) {
        if (route.length < min) {
            min = route.length;
            shortest = route;
        }
    }

    return shortest;
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

            if (route.some(item => item.identifier.number === node.identifier.number)) {
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

            if (route.some(item => item.identifier.number === node.identifier.number)) {
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
