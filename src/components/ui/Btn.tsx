"use client";
import { ButtonHTMLAttributes, ReactNode } from "react";

type Kind = "primary" | "secondary" | "ghost" | "yellow" | "invGhost";
type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "px-3 py-2 text-[10px]",
  md: "px-5 py-[14px] text-[12px]",
  lg: "px-6 py-[18px] text-[13px]",
};

const KIND_CLASSES: Record<Kind, string> = {
  primary: "btn btn-primary",
  secondary: "btn btn-secondary",
  ghost: "btn btn-ghost",
  yellow: "btn btn-yellow",
  invGhost: "btn btn-inv-ghost",
};

export default function Btn({
  kind = "primary",
  size = "md",
  full = false,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: Kind;
  size?: Size;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      {...rest}
      className={[
        KIND_CLASSES[kind],
        SIZES[size],
        full ? "w-full justify-center" : "",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
