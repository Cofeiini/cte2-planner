import { isSameTalent } from "./spuddling.js";

/**
 * @typedef GridPoint
 * @property {string} value
 * @property {Set<TalentNode>} origins
 */

/**
 * @typedef Plan
 * @property {TalentNode} start
 * @property {TalentNode} end
 * @property {TalentNode[]} path
 */

const charSet = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]);

/** @type {TalentNode[][]} */
let editorGrid = undefined;
export const updateEditorGrid = (grid) => {
    editorGrid = grid;
};

/**
 * @param {TalentNode[]} first
 * @param {TalentNode[]} second
 * @returns {boolean}
 */
export const isOverlappingPath = (first, second) => {
    for (const outer of first) {
        if (outer.selectable) {
            continue;
        }

        for (const inner of second) {
            if (inner.selectable) {
                continue;
            }

            if (isSameTalent(outer, inner)) {
                return true;
            }
        }
    }

    return false;
};

/**
 * @param {TalentNode} leftStart
 * @param {TalentNode} leftEnd
 * @param {TalentNode} rightStart
 * @param {TalentNode} rightEnd
 * @returns {boolean}
 */
const isIntersectingSegment = (leftStart, leftEnd, rightStart, rightEnd) => {
    const det = ((leftEnd.x - leftStart.x) * (rightEnd.y - rightStart.y)) - ((rightEnd.x - rightStart.x) * (leftEnd.y - leftStart.y));
    if (det === 0) {
        return false;
    }

    const lambda = (((rightEnd.y - rightStart.y) * (rightEnd.x - leftStart.x)) + ((rightStart.x - rightEnd.x) * (rightEnd.y - leftStart.y))) / det;
    const gamma = (((leftStart.y - leftEnd.y) * (rightEnd.x - leftStart.x)) + ((leftEnd.x - leftStart.x) * (rightEnd.y - leftStart.y))) / det;
    return ((lambda > 0) && (lambda < 1)) && ((gamma > 0) && (gamma < 1));
};

/**
 * @param {TalentNode[]} left
 * @param {TalentNode[]} right
 * @returns {boolean}
 */
export const isIntersectingPath = (left, right) => {
    for (let o = 0; o < left.length - 1; ++o) {
        for (let i = 0; i < right.length - 1; ++i) {
            if (isIntersectingSegment(left.at(o), left.at(o + 1), right.at(i), right.at(i + 1))) {
                return true;
            }
        }
    }

    return false;
};

/**
 * @param {TalentNode[]} line
 * @returns {{left: number, top: number, right: number, bottom: number}}
 */
const getLineBounds = (line) => {
    const bounds = {
        left: Number.MAX_VALUE,
        top: Number.MAX_VALUE,
        right: 0,
        bottom: 0,
    };

    for (const point of line) {
        if (point.x < bounds.left) {
            bounds.left = point.x;
        }

        if (point.x > bounds.right) {
            bounds.right = point.x;
        }

        if (point.y < bounds.top) {
            bounds.top = point.y;
        }

        if (point.y > bounds.bottom) {
            bounds.bottom = point.y;
        }
    }

    return bounds;
};

/**
 * @param {TalentNode[]} left
 * @param {TalentNode[]} right
 * @returns {boolean}
 */
export const isIntersectingLine = (left, right) => {
    const a = getLineBounds(left);
    const b = getLineBounds(right);
    return (a.left <= b.right) && (a.right >= b.left) && (a.top <= b.bottom) && (a.bottom >= b.top);
};

/**
 * @param {TalentNode} point
 * @returns {TalentNode[]}
 */
const getBorder = (point) => {
    /** @type {TalentNode[]} */
    const border = [];
    for (let y = -1; y <= 1; ++y) {
        for (let x = -1; x <= 1; ++x) {
            if ((x === 0) && (y === 0)) {
                continue;
            }

            const talent = editorGrid.at(point.y + y)?.at(point.x + x);
            if (talent) {
                border.push(talent);
            }
        }
    }

    return border;
};

/**
 * @param {GridPoint[][]} grid
 * @param {TalentNode} point
 */
const checkBorderConnectors = (grid, point) => {
    /** @type {Set<string>} */
    const connectors = new Set();
    const borders = getBorder(point);
    for (const border of borders) {
        const connector = grid.at(border.y).at(border.x).value;
        if (connector.length > 0) {
            connectors.add(connector);
        }
    }

    return connectors;
};

/**
 * @param {GridPoint[][]} grid
 * @param {Plan} plan
 */
export const resetPlan = (grid, plan) => {
    for (const talent of plan.path) {
        if (talent.selectable) {
            continue;
        }

        const point = grid.at(talent.y).at(talent.x);
        point.origins = new Set(Array.from(point.origins).filter(item => !isSameTalent(item, plan.start) && !isSameTalent(item, plan.end)));
        if (point.origins.size === 0) {
            point.value = "";
        }
    }
};

/**
 * @param {GridPoint[][]} grid
 * @param {Plan} plan
 */
export const drawPlan = (grid, plan) => {
    const chars = structuredClone(charSet);
    for (const talent of plan.path) {
        const connectors = checkBorderConnectors(grid, talent);
        for (const connector of connectors) {
            chars.delete(connector);
        }
    }

    const char = Array.from(chars).at(0);
    for (const talent of plan.path) {
        if (talent.selectable) {
            continue;
        }

        const point = grid.at(talent.y).at(talent.x);
        point.origins.add(plan.start);
        point.origins.add(plan.end);
        if (point.value.length === 0) {
            point.value = char;
            continue;
        }

        const neighbors = getBorder(talent).filter(item => item.selectable);
        if ((neighbors.length === 0) || !neighbors.every(item => isSameTalent(item, plan.start) || isSameTalent(item, plan.end) || item.neighbors.some(element => (isSameTalent(element, plan.start) || isSameTalent(item, plan.end))))) {
            point.value = "X";
        }
    }
};

/**
 * @param {GridPoint[][]} grid
 * @param {string} char
 */
export const setUpBorder = (grid, char = "E") => {
    const right = grid.at(0).length - 1;
    const bottom = grid.length - 1;

    for (let y = 0; y <= bottom; ++y) {
        grid.at(y).at(0).value = char;
        grid.at(y).at(right).value = char;
    }

    for (let x = 0; x <= right; ++x) {
        grid.at(0).at(x).value = char;
        grid.at(bottom).at(x).value = char;
    }
};

/**
 * @param {GridPoint[][]} grid
 */
export const setUpCenter = (grid) => {
    for (const row of editorGrid) {
        for (const talent of row) {
            if (talent.selectable) {
                continue;
            }

            if (talent.identifier.talent.length <= 1) {
                continue;
            }

            if (talent.identifier.talent === "[CENTER]") {
                grid.at(talent.y).at(talent.x).value = "[CENTER]";
                return;
            }
        }
    }
};

/**
 * @param {GridPoint[][]} grid
 */
export const setUpLiteralCenter = (grid) => {
    const center = {
        x: Math.floor(grid.at(0).length * 0.5),
        y: Math.floor(grid.length * 0.5),
    };
    grid.at(center.y).at(center.x).value = "[CENTER]";
};

/**
 * @param {TalentNode} point
 * @param {TalentNode} other
 * @returns {number}
 */
const getPointDistance = (point, other) => {
    return Math.pow(other.x - point.x, 2) + Math.pow(other.y - point.y, 2);
};

/**
 * @param {TalentNode[]} path
 * @returns {number}
 */
const getSegmentDistance = (path) => {
    let distance = 0;
    for (let i = 0; i < (path.length - 1); ++i) {
        distance += getPointDistance(path.at(i), path.at(i + 1));
    }
    return distance;
};

/**
 * @param {TalentNode} point
 * @param {TalentNode[]} line
 * @returns {number}
 */
const getPointNeighborCount = (point, line) => {
    let count = 0;
    const neighbors = getBorder(point);
    for (const neighbor of neighbors) {
        if (line.some(item => isSameTalent(item, neighbor))) {
            count++;
        }
    }

    return count;
};

/**
 * @param {GridPoint[][]} grid
 * @param {TalentNode} point
 * @param {TalentNode} start
 * @param {TalentNode} end
 * @returns {boolean}
 */
const isOccupiedPoint = (grid, point, start, end) => {
    if (isSameTalent(point, start) || isSameTalent(point, end)) {
        return false;
    }

    const gridPoint = grid.at(point.y).at(point.x);
    if (gridPoint.origins.size === 0) {
        return false;
    }

    let sharedCount = 0;
    for (const origin of gridPoint.origins) {
        const border = getBorder(origin);
        for (const talent of border) {
            if (isSameTalent(talent, point)) {
                ++sharedCount;
            }
        }
    }

    return sharedCount < 2;
};

/**
 * @param {GridPoint[][]} grid
 * @param {TalentNode} point
 * @param {TalentNode} start
 * @param {TalentNode} end
 * @returns {boolean}
 */
const isValidPoint = (grid, point, start, end) => {
    if (point.selectable && !isSameTalent(point, end)) {
        return false;
    }

    if (isOccupiedPoint(grid, point, start, end)) {
        return false;
    }

    let isNeighbor = true;
    const border = getBorder(point).filter(item => item.selectable && !isSameTalent(item, start) && !isSameTalent(item, end));
    for (const talent of border) {
        const isStartNeighbor = talent.neighbors.some(neighbor => isSameTalent(neighbor, start));
        const isEndNeighbor = talent.neighbors.some(neighbor => isSameTalent(neighbor, end));
        isNeighbor = isNeighbor && (isStartNeighbor && isEndNeighbor);
    }

    return isNeighbor;
};

/**
 * @param {GridPoint[][]} grid
 * @param {TalentNode} start
 * @param {TalentNode} end
 * @returns {TalentNode[]}
 */
const setUpConnection = (grid, start, end) => {
    const open = [{ point: start, f: getPointDistance(start, end), path: [start] }];
    const visited = new Set([start.identifier.number]);
    while (open.length > 0) {
        open.sort((a, b) => a.f - b.f);

        const { point, f, path } = open.shift();

        if (isSameTalent(point, end)) {
            return path;
        }

        const maxDistance = getPointDistance(point, end);
        const border = getBorder(point);
        for (const next of border) {
            const distance = getPointDistance(next, end);
            if (distance > maxDistance) {
                continue;
            }

            if (getPointNeighborCount(next, path) > 1) {
                continue;
            }

            if (!isValidPoint(grid, next, start, end)) {
                continue;
            }

            if (visited.has(next.identifier.number)) {
                continue;
            }
            visited.add(next.identifier.number);

            let override = 1;
            const neighbors = getBorder(next).filter(item => item.selectable);
            const isNeighbor = (neighbors.length > 2) && neighbors.every(item => isSameTalent(item, start) || isSameTalent(item, end) || item.neighbors.some(element => isSameTalent(element, start) || isSameTalent(element, end)));
            if (isNeighbor) {
                override = 0;
            }

            open.push({
                point: next,
                f: (f + distance) * override,
                path: [...path, next],
            });
        }
    }

    return [];
};

/**
 * @param {GridPoint[][]} grid
 * @param {Plan} plan
 * @returns {boolean}
 */
export const setUpBestPath = (grid, plan) => {
    const forward = {
        path: setUpConnection(grid, plan.start, plan.end),
        distance: Number.MAX_VALUE,
    };
    forward.distance = getSegmentDistance(forward.path);

    const backward = {
        path: setUpConnection(grid, plan.end, plan.start),
        distance: Number.MAX_VALUE,
    };
    backward.distance = getSegmentDistance(backward.path);

    const isForward = forward.path.length > 0;
    const isBackward = backward.path.length > 0;
    if (isForward) {
        plan.path = forward.path;
    } else if (isBackward) {
        plan.path = backward.path;
    }

    if (isForward && isBackward && (backward.distance < forward.distance)) {
        plan.path = backward.path;
    }

    return (forward.path.length > 0) || (backward.path.length > 0);
};

/**
 * @param {GridPoint[][]} grid
 * @param {Plan[]} planned
 * @returns {boolean}
 */
export const checkConflictingPlan = (grid, planned) => {
    let hasConflict = false;
    for (const outer of planned) {
        for (const inner of planned) {
            if (isSameTalent(outer.start, inner.start) && isSameTalent(outer.end, inner.end)) {
                continue;
            }

            if (!isIntersectingLine(outer.path, inner.path)) {
                continue;
            }

            if (!isOverlappingPath(outer.path, inner.path)) {
                if (!isIntersectingPath(outer.path, inner.path)) {
                    continue;
                }
            }

            if ((outer.path.length === 3) && (inner.path.length === 3)) {
                continue;
            }

            hasConflict = true;

            const planGrid = [[outer, inner], [inner, outer]];
            for (const plans of planGrid) {
                const firstPlan = plans.at(0);
                const secondPlan = plans.at(1);

                resetPlan(grid, firstPlan);
                resetPlan(grid, secondPlan);

                const isFirstSuccess = setUpBestPath(grid, firstPlan);
                drawPlan(grid, firstPlan);

                const isSecondSuccess = setUpBestPath(grid, secondPlan);
                drawPlan(grid, secondPlan);

                if (isFirstSuccess && isSecondSuccess) {
                    break;
                }
            }
        }
    }

    return hasConflict;
};

/**
 * @param {GridPoint[][]} grid
 * @param {TalentNode[]} nodePool
 * @returns {Plan[]}
 */
export const planAllRoutes = (grid, nodePool) => {
    /** @type {Plan[]} */
    const planned = [];

    const sortedNodes = nodePool.toSorted((a, b) => b.neighbors.length - a.neighbors.length);
    for (const talent of sortedNodes) {
        for (const neighbor of talent.neighbors) {
            if (planned.some(item => (isSameTalent(item.start, talent) && isSameTalent(item.end, neighbor)) || (isSameTalent(item.start, neighbor) && isSameTalent(item.end, talent)))) {
                continue;
            }

            const line = setUpConnection(grid, talent, neighbor);
            planned.push({ start: talent, end: neighbor, path: line });
        }
    }

    return planned;
};
