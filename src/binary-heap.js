export class BinaryHeap {
    values = [];

    constructor() {
        this.values = [];
    }

    push = (node) => {
        this.values.push(node);
        this.sinkDown(this.values.length - 1);
    };

    pop = () => {
        const result = this.values.at(0);
        const end = this.values.pop();

        if (this.values.length > 0) {
            this.values[0] = end;
            this.bubbleUp(0);
        }

        return result;
    };

    size = () => {
        return this.values.length;
    };

    rescore = (node) => {
        let index = -1;
        for (let i = 0; i < this.values.length; ++i) {
            if (this.values.at(i).identifier.number === node.identifier.number) {
                index = i;
                break;
            }
        }

        this.sinkDown(index);
    };

    bubbleUp = (n) => {
        const element = this.values.at(n);
        const elemScore = element.travel.cost.total;

        while (true) {
            const child2N = (n + 1) << 1;
            const child1N = child2N - 1;

            let swap = undefined;
            let child1Score = Number.MAX_VALUE;
            if (child1N < this.values.length) {
                const child1 = this.values[child1N];
                child1Score = child1.travel.cost.total;

                if (child1Score < elemScore) {
                    swap = child1N;
                }
            }

            if (child2N < this.values.length) {
                const child2 = this.values[child2N];
                const child2Score = child2.travel.cost.total;
                if (child2Score < (swap ? child1Score : elemScore)) {
                    swap = child2N;
                }
            }

            if (!swap) {
                break;
            }

            this.values[n] = this.values[swap];
            this.values[swap] = element;
            n = swap;
        }
    };

    sinkDown = (index) => {
        const element = this.values.at(index);

        while (index > 0) {
            const parentN = ((index + 1) >> 1) - 1;
            const parent = this.values.at(parentN);

            if (element.travel.cost.total >= parent.travel.cost.total) {
                break;
            }

            this.values[parentN] = element;
            this.values[index] = parent;
            index = parentN;
        }
    };
}
