import Button from "@cloudscape-design/components/button";
import Checkbox from "@cloudscape-design/components/checkbox";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { useState, type FormEvent } from "react";
import type { JsonSchema } from "../frank/client";

// Renders a form from a tool's input schema, so a new tool shows up in the
// console with no UI work (ADR-003).

type FieldKind = "enum" | "string" | "number" | "integer" | "boolean" | "json";

export function fieldKind(schema: JsonSchema): FieldKind {
  if (Array.isArray(schema.enum)) return "enum";
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== "null") : schema.type;
  switch (type) {
    case "string":
    case "number":
    case "integer":
    case "boolean":
      return type;
    default:
      return "json";
  }
}

type Values = Record<string, string | boolean>;

function initialValues(properties: Record<string, JsonSchema>): Values {
  const values: Values = {};
  for (const [key, schema] of Object.entries(properties)) {
    if (fieldKind(schema) === "boolean") {
      values[key] = schema.default === true;
    } else {
      values[key] = schema.default === undefined ? "" : typeof schema.default === "string" ? schema.default : JSON.stringify(schema.default);
    }
  }
  return values;
}

/** Turn form values into tool arguments. Returns field errors if any value is unusable. */
export function buildArgs(
  schema: JsonSchema,
  values: Values,
): { args: Record<string, unknown>; errors: Record<string, string> } {
  const args: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const required = new Set(schema.required ?? []);

  for (const [key, field] of Object.entries(schema.properties ?? {})) {
    const kind = fieldKind(field);
    const raw = values[key];

    if (kind === "boolean") {
      args[key] = raw === true;
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text === "") {
      if (required.has(key)) errors[key] = "Required.";
      continue;
    }
    if (kind === "number" || kind === "integer") {
      const n = Number(text);
      if (!Number.isFinite(n) || (kind === "integer" && !Number.isInteger(n))) {
        errors[key] = kind === "integer" ? "Enter a whole number." : "Enter a number.";
      } else {
        args[key] = n;
      }
    } else if (kind === "enum") {
      args[key] = field.enum?.find((option) => String(option) === text) ?? text;
    } else if (kind === "json") {
      try {
        args[key] = JSON.parse(text);
      } catch {
        errors[key] = "Enter valid JSON.";
      }
    } else {
      args[key] = text;
    }
  }
  return { args, errors };
}

export interface SchemaFormProps {
  schema: JsonSchema;
  submitting?: boolean;
  onSubmit: (args: Record<string, unknown>) => void;
}

export default function SchemaForm({ schema, submitting = false, onSubmit }: SchemaFormProps) {
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const [values, setValues] = useState<Values>(() => initialValues(properties));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, value: string | boolean) => setValues((v) => ({ ...v, [key]: value }));

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const result = buildArgs(schema, values);
    setErrors(result.errors);
    if (Object.keys(result.errors).length === 0) onSubmit(result.args);
  };

  return (
    <form onSubmit={submit}>
      <Form
        actions={
          <Button variant="primary" formAction="submit" loading={submitting}>
            Run
          </Button>
        }
      >
        {Object.keys(properties).length > 0 && (
          <SpaceBetween size="m">
            {Object.entries(properties).map(([key, field]) => {
              const kind = fieldKind(field);
              const label = required.has(key) ? key : `${key} (optional)`;
              const value = values[key];
              return (
                <FormField key={key} label={label} description={field.description} errorText={errors[key]}>
                  {kind === "boolean" ? (
                    <Checkbox checked={value === true} onChange={({ detail }) => set(key, detail.checked)}>
                      {key}
                    </Checkbox>
                  ) : kind === "enum" ? (
                    <Select
                      ariaLabel={key}
                      selectedOption={value ? { label: String(value), value: String(value) } : null}
                      options={(field.enum ?? []).map((option) => ({ label: String(option), value: String(option) }))}
                      onChange={({ detail }) => set(key, detail.selectedOption.value ?? "")}
                      placeholder="Choose a value"
                    />
                  ) : kind === "json" ? (
                    <Textarea
                      ariaLabel={key}
                      value={String(value ?? "")}
                      onChange={({ detail }) => set(key, detail.value)}
                      placeholder="JSON"
                    />
                  ) : (
                    <Input
                      ariaLabel={key}
                      type={kind === "string" ? "text" : "number"}
                      value={String(value ?? "")}
                      onChange={({ detail }) => set(key, detail.value)}
                    />
                  )}
                </FormField>
              );
            })}
          </SpaceBetween>
        )}
      </Form>
    </form>
  );
}
