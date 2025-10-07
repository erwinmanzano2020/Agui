"use client";

import {
  ReactNode,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
} from "react";

export function FormRow({
  label,
  required,
  help,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="form-row items-start">
      <div className="pt-2">
        <label className="label">
          {label} {required && <span className="text-danger">*</span>}
        </label>
        {help && <div className="help mt-0.5">{help}</div>}
      </div>
      <div>
        {children}
        {error && <div className="error mt-1">{error}</div>}
      </div>
    </div>
  );
}

/* Inputs */
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ""}`} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={`textarea ${props.className ?? ""}`} />
  );
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`select ${props.className ?? ""}`} />;
}
export function Checkbox({
  label,
  ...rest
}: { label?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        {...rest}
        className={`checkbox ${rest.className ?? ""}`}
      />
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}
