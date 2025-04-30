import { CELL_SIZE, CELL_HALF } from "./constants.js";

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
    update = undefined;
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
