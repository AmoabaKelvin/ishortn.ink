import type * as React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "rn-banner": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        "background-color"?: string;
        "border-radius"?: string;
        margin?: string;
      };
    }
  }
}
