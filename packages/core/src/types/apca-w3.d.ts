declare module 'apca-w3' {
  export function APCAcontrast(
    textY: number,
    backgroundY: number,
    places?: number,
  ): number | string;
  export function sRGBtoY(rgb: [number, number, number]): number;
  export function displayP3toY(rgb: [number, number, number]): number;
  export function adobeRGBtoY(rgb: [number, number, number]): number;
  export function alphaBlend(
    rgbaFG: [number, number, number, number],
    rgbBG: [number, number, number],
    isRound?: boolean,
  ): [number, number, number];
  export function calcAPCA(
    textColor: string | number[],
    backgroundColor: string | number[],
    places?: number,
    round?: boolean,
  ): number | string;
}
