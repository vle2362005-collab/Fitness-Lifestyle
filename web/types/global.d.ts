declare module "@mediapipe/pose" {
  export const POSE_CONNECTIONS: unknown;
  export class Pose {
    constructor(options?: { locateFile?: (file: string) => string });
    setOptions(options: Record<string, unknown>): void;
    onResults(callback: (results: any) => void): void;
    send(input: { image: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement }): Promise<void>;
    close?: () => void;
  }
}
