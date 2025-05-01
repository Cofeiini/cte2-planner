export const CELL_SIZE = 50.0;
export const CELL_HALF = CELL_SIZE * 0.5;

/** @type {Map<string, string>} */
export const colorMap = new Map([
    ["0", "#000000"],
    ["1", "#0000AA"],
    ["2", "#00AA00"],
    ["3", "#00AAAA"],
    ["4", "#AA0000"],
    ["5", "#AA00AA"],
    ["6", "#FFAA00"],
    ["7", "#AAAAAA"],
    ["8", "#555555"],
    ["9", "#5555FF"],
    ["a", "#55FF55"],
    ["b", "#55FFFF"],
    ["c", "#FF5555"],
    ["d", "#FF55FF"],
    ["e", "#FFFF55"],
    ["f", "#FFFFFF"],
]);

export const controls = {
    x: 0.0,
    y: 0.0,
    zoom: 1.0,
    panning: false,
    hovering: false,
    shouldRedraw: false,
    clickTarget: undefined,
};

export const viewport = {
    width: 0,
    height: 0,
    max: 0,
};
