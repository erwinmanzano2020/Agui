// src/components/me/icons.tsx
import type { SVGProps } from "react";

export function LoyaltyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...props}>
      <path d="M12 21l-1.9-1.73C6 15.36 3 12.28 3 8.5A4.5 4.5 0 0 1 12 6.09 4.5 4.5 0 0 1 21 8.5c0 3.78-3 6.86-7.1 10.77L12 21z" />
    </svg>
  );
}

export function EmployeeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...props}>
      <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm7 9v-1a5 5 0 0 0-5-5H10a5 5 0 0 0-5 5v1Z" />
    </svg>
  );
}

export function BizIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...props}>
      <path d="M3 21V7l9-4 9 4v14H3Zm9-13-6 2.67V19h12v-8.33L12 8Z" />
    </svg>
  );
}

export function GMIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...props}>
      <path d="M12 2l3 7h7l-5.5 4.1 2.1 7-6.6-4.8-6.6 4.8 2.1-7L2 9h7Z" />
    </svg>
  );
}
