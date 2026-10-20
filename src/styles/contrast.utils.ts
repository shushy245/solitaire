// WCAG contrast over the palette tokens in global.scss — the measurement behind the felt's contrast targets.

type RgbaModel = { readonly r: number; readonly g: number; readonly b: number; readonly a: number };

const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/gi;
const RGB_COLOR = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/g;
const COLOR_TOKEN = /^\s*(--[\w-]+):\s*(#[0-9a-f]{6}|rgb\([^)]*\));/gim;
const CHANNEL_MAX = 255;

// The first match of a global pattern, or undefined (exec would answer null).
const firstMatch = ({ pattern, text }: { pattern: RegExp; text: string }): RegExpExecArray | undefined =>
    [...text.matchAll(pattern)][0];

const parseColor = (color: string): RgbaModel => {
    const hex = firstMatch({ pattern: HEX_COLOR, text: color });

    if (hex !== undefined) {
        const [, r = '0', g = '0', b = '0'] = hex;

        return { r: parseInt(r, 16), g: parseInt(g, 16), b: parseInt(b, 16), a: 1 };
    }

    const rgb = firstMatch({ pattern: RGB_COLOR, text: color });

    if (rgb === undefined)
        throw new Error(`contrast: cannot read colour "${color}" — expected #rrggbb or rgb(r g b / a)`);

    const [, r = '0', g = '0', b = '0', a = '1'] = rgb;

    return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
};

const toHex = ({ r, g, b }: RgbaModel): string =>
    `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;

// Every `--name: colour;` declaration in a stylesheet, by name.
export const readColorTokens = (stylesheet: string): ReadonlyMap<string, string> =>
    new Map([...stylesheet.matchAll(COLOR_TOKEN)].map(([, name = '', value = '']) => [name, value]));

export const compositeOver = ({ color, background }: { color: string; background: string }): string => {
    const top = parseColor(color);
    const bottom = parseColor(background);
    const blend = (front: number, back: number): number => front * top.a + back * (1 - top.a);

    return toHex({ r: blend(top.r, bottom.r), g: blend(top.g, bottom.g), b: blend(top.b, bottom.b), a: 1 });
};

const linearChannel = (channel: number): number => {
    const value = channel / CHANNEL_MAX;

    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = (color: string): number => {
    const { r, g, b } = parseColor(color);

    return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
};

export const contrastRatio = ({ a, b }: { a: string; b: string }): number => {
    const [lighter = 0, darker = 0] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);

    return (lighter + 0.05) / (darker + 0.05);
};
