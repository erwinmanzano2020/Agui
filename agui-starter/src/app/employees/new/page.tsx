"use client";

import { useState } from "react";
import { PageHeader } from "../../../components/ui/page-header";
import {
  FormRow,
  Input,
  Select,
  Textarea,
  Checkbox,
} from "../../../components/ui/form";

export default function NewEmployeePage() {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ [k: string]: string | null }>({});

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);

    // very light client-side validation
    const name = String(fd.get("full_name") || "").trim();
    const code = String(fd.get("code") || "").trim();
    const rate = Number(fd.get("rate_per_day") || 0);

    const err: typeof errors = {};
    if (!name) err.full_name = "Required.";
    if (!code) err.code = "Required.";
    if (!(rate > 0)) err.rate_per_day = "Must be greater than 0.";
    setErrors(err);
    if (Object.keys(err).length) return;

    setSaving(true);
    // TODO: wire to Supabase (employees insert)
    setTimeout(() => {
      setSaving(false);
      alert("Employee saved (demo).");
    }, 600);
  }

  return (
    <PageHeader
      title="Add Employee"
      subtitle="Create a new employee record"
      actions={
        <>
          <button
            form="empForm"
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="btn btn-ghost" onClick={() => history.back()}>
            Cancel
          </button>
        </>
      }
    >
      <form id="empForm" className="card p-5 space-y-5" onSubmit={onSubmit}>
        <FormRow
          label="Full Name"
          required
          help="As it appears on payroll."
          error={errors.full_name}
        >
          <Input name="full_name" placeholder="e.g., Juan Dela Cruz" />
        </FormRow>

        <FormRow
          label="Employee Code"
          required
          help="Unique short code (e.g., E-0001)"
          error={errors.code}
        >
          <Input name="code" placeholder="E-0001" />
        </FormRow>

        <FormRow label="Rate Per Day (₱)" required error={errors.rate_per_day}>
          <Input
            name="rate_per_day"
            type="number"
            min={0}
            step="1"
            inputMode="numeric"
            placeholder="500"
          />
        </FormRow>

        <FormRow label="Role">
          <Select name="role" defaultValue="cashier">
            <option value="cashier">Cashier</option>
            <option value="stocker">Stocker</option>
            <option value="utility">Utility</option>
          </Select>
        </FormRow>

        <FormRow label="Notes">
          <Textarea name="notes" rows={3} placeholder="Optional notes…" />
        </FormRow>

        <div className="flex items-center gap-4">
          <Checkbox name="is_active" defaultChecked label="Active" />
          <Checkbox name="can_cashier" label="Can operate cashier" />
        </div>
      </form>
    </PageHeader>
  );
}
