// Wraps canvas.getContext once: the browser returns null when it cannot draw (and jsdom always does).
export const getCanvasContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D | undefined =>
    canvas.getContext('2d') ?? undefined;
