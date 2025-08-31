export const CELL_SIZE = 50.0;
export const CELL_HALF = CELL_SIZE * 0.5;
export const LINE_WIDTH = 10;
export const RAD_TO_DEG = 180 / Math.PI;

/** @type {{minecraft: Map<string, string>, custom: Map<string, string>}} */
export const colorMap = {
    minecraft: new Map([
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
    ]),
    custom: new Map([
        ["background", "#191821"],
        ["line", "#222222"],
        ["line_connect", "#3E3E3E"],
        ["line_select", "#1A5A1A"],
        ["line_remove", "#9F1F1F"],
        ["line_add", "#1F1F9F"],
        ["line_overflow", "#9F1F9F"],
        ["grid", "#1F1E27"],
    ]),
};

export const controls = {
    x: 0.0,
    y: 0.0,
    zoom: 1.0,
    panning: false,
    hovering: false,
    shouldRedraw: false,
    clickTarget: undefined,
    ascendancy: "none",
    editor: {
        active: false,
        action: "none",
        /** @type {TalentNode} */
        target: undefined,
        /** @type {TalentNode} */
        focus: undefined,
        /** @type {HTMLDivElement} */
        indicator: undefined,
    },
};

export const welcomeMessages = [
    "Welcome", // Remember to keep this first, so the randomization picks the correct lines
    "Welcome back, Exile",
    "Still sane, Exile?",
];
