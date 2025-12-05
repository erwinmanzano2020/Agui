import type { SVGProps } from "react";

function makeIcon(path: string) {
  return function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...props}>
        <path d={path} />
      </svg>
    );
  };
}

export const OverviewIcon = makeIcon("M4 5h16v4H4Zm0 5h9v4H4Zm0 5h16v4H4Z");
export const OpsIcon = makeIcon("M4 4h16v4H4Zm0 6h10v4H4Zm0 6h7v4H4Z");
export const CashIcon = makeIcon("M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2v10h12V7Zm5 2h2v2h-2Zm0 4h2v2h-2Z");
export const HrIcon = makeIcon("M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 7v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1Z");
export const FinanceIcon = makeIcon("M5 5h14v3h2v2h-2v9H5v-3H3v-2h2V5Zm2 2v12h10V7Zm2 3h2v2h-2Zm0 4h2v2h-2Z");
export const GearIcon = makeIcon("M12 6a2 2 0 1 0 2 2 2 2 0 0 0-2-2Zm-1.94 12a7.77 7.77 0 0 1-1.37-.8l-2.01 1.16-1.5-2.6 2.02-1.17a7.87 7.87 0 0 1 0-1.59L5.18 11.8l1.5-2.6 2.01 1.16a7.77 7.77 0 0 1 1.37-.8L10.3 6h3l.23 2.56a7.77 7.77 0 0 1 1.37.8l2.01-1.16 1.5 2.6-2.02 1.17a7.87 7.87 0 0 1 0 1.59l2.02 1.17-1.5 2.6-2.01-1.16a7.77 7.77 0 0 1-1.37.8L13.3 18h-3Z");
