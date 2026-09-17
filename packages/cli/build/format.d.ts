import type { Feedback } from "@george-tools/core";
export declare const green: (s: string) => string;
export declare const red: (s: string) => string;
export declare const yellow: (s: string) => string;
export declare const dim: (s: string) => string;
export declare const bold: (s: string) => string;
/** Colours the raw reply line by line without changing its text. */
export declare function colourReply(raw: string): string;
export declare function colourSummary(fb: Feedback): string;
