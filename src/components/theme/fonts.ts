import { Cormorant_Garamond, Crimson_Pro, Lato, Marcellus, Nunito, Nunito_Sans } from "next/font/google";

// Fonts for the concept themes. Not preloaded: the browser only downloads the ones a theme uses.
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-cormorant", display: "swap", preload: false });
const crimson = Crimson_Pro({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-crimson", display: "swap", preload: false });
const marcellus = Marcellus({ subsets: ["latin"], weight: "400", variable: "--font-marcellus", display: "swap", preload: false });
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-lato", display: "swap", preload: false });
const nunito = Nunito({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-nunito", display: "swap", preload: false });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-nunito-sans", display: "swap", preload: false });

export const themeFontVars = [cormorant, crimson, marcellus, lato, nunito, nunitoSans].map((f) => f.variable).join(" ");
