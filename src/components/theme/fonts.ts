import { Nunito, Nunito_Sans } from "next/font/google";

// Fonts for the backup "warm" theme. Not preloaded: the browser only downloads them when that
// theme is on.
const nunito = Nunito({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-nunito", display: "swap", preload: false });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-nunito-sans", display: "swap", preload: false });

export const themeFontVars = [nunito, nunitoSans].map((f) => f.variable).join(" ");
