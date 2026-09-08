import type { ReactNode } from "react";

import styles from "./agui-mobile-shell.module.css";

type AguiMobileShellProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AguiMobileShell({
  eyebrow = "AGUI · VVS OPERATIONS",
  title,
  subtitle,
  badge,
  children,
  footer,
}: AguiMobileShellProps) {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.eyebrow}>{eyebrow}</div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {badge ? <div className={styles.badgeSlot}>{badge}</div> : null}
      </header>
      <div className={styles.content}>{children}</div>
      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </main>
  );
}
