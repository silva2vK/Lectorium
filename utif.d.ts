declare module 'utif' {
  export interface IFD {
    width: number;
    height: number;
    data?: Uint8Array;     // buffer raw comprimido (antes de decodeImage)
    rgba?: Uint8Array;     // buffer RGBA decodificado (após decodeImage + toRGBA8)
    t262?: number[];       // PhotometricInterpretation
    t258?: number[];       // BitsPerSample
    [key: string]: any;
  }

  export function decode(buffer: ArrayBuffer): IFD[];
  export function decodeImage(buffer: ArrayBuffer, ifd: IFD): void;
  export function toRGBA8(ifd: IFD): Uint8Array;
}
