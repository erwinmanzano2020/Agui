import "react";

/* eslint-disable @typescript-eslint/no-unused-vars */
declare module "react" {
  interface StyleHTMLAttributes<T = unknown> {
    jsx?: boolean;
    global?: boolean;
  }
}
