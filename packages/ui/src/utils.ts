// The class-name helper every copied component shares (design D1): clsx
// joins the conditional classes, and tailwind-merge keeps the last of two
// conflicting utilities, so a caller's `class` prop wins over the defaults.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// The prop types the shadcn-svelte components declare (their registry's
// utils file). Each one drops the child snippet a native element would not
// accept, and each ref is bindable.

// `any` is shadcn-svelte's own helper signature: every component's props may
// carry a `child` snippet, and `unknown` would break the conditional type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any }
  ? Omit<T, "children">
  : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};
