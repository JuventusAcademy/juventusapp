import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { related, saveRow } from "../lib/data";
import { friendlyError } from "../lib/supabase";
import { today } from "../domain";
import type { Row } from "../domain";
import type { Module } from "../modules";
import { Modal } from "./ui";
export default function RecordForm({
  module,
  school,
  row,
  onClose,
  onSaved,
}: {
  module: Module;
  school: string;
  row?: Row;
  onClose: () => void;
  onSaved: (s: string) => void;
}) {
  const refs = [
    ...new Set(module.fields.flatMap((f) => (f.ref ? [f.ref] : []))),
  ];
  const options = useQueries({
    queries: refs.map((table) => ({
      queryKey: ["related", school, table],
      queryFn: () => related(table, school),
    })),
  });
  const schema = useMemo(() => {
    const shape: Record<string, z.ZodType> = {};
    module.fields.forEach((f) => {
      if (f.type === "checkbox") shape[f.key] = z.boolean();
      else if (f.type === "number")
        shape[f.key] = z
          .union([z.string(), z.number()])
          .transform((v) => (v === "" ? null : Number(v)))
          .refine(
            (v) =>
              v === null
                ? !f.required
                : Number.isFinite(v) &&
                  (f.min === undefined || v >= f.min) &&
                  (f.max === undefined || v <= f.max),
            {
              message: `Informe um número válido${f.min !== undefined ? " a partir de " + f.min : ""}.`,
            },
          );
      else {
        let s = z.string().trim();
        if (f.required) s = s.min(1, "Preencha este campo.");
        if (f.type === "email")
          shape[f.key] = f.required
            ? z.email("Informe um e-mail válido.")
            : z.union([z.email("Informe um e-mail válido."), z.literal("")]);
        else
          shape[f.key] = s.max(
            f.type === "textarea" ? 10000 : 500,
            "Texto muito longo.",
          );
      }
    });
    return z.object(shape).superRefine((v, ctx) => {
      if (v.ends_at && v.starts_at && String(v.ends_at) <= String(v.starts_at))
        ctx.addIssue({
          code: "custom",
          path: ["ends_at"],
          message: "O fim deve ser posterior ao início.",
        });
      if (v.birth_date && String(v.birth_date) > today())
        ctx.addIssue({
          code: "custom",
          path: ["birth_date"],
          message: "Nascimento não pode estar no futuro.",
        });
      if (
        v.original_amount !== undefined &&
        Number(v.discount) > Number(v.original_amount)
      )
        ctx.addIssue({
          code: "custom",
          path: ["discount"],
          message: "O desconto não pode superar o valor original.",
        });
      if (v.competence && String(v.competence).slice(-2) !== "01")
        ctx.addIssue({
          code: "custom",
          path: ["competence"],
          message: "Use o primeiro dia do mês.",
        });
    });
  }, [module]);
  const defaults = Object.fromEntries(
    module.fields.map((f) => {
      let value =
        row?.[f.key] ??
        (f.type === "checkbox"
          ? f.key === "active"
          : f.type === "select"
            ? f.options?.[0]?.value || ""
            : f.type === "date"
              ? today()
              : f.type === "number"
                ? f.key === "capacity"
                  ? 20
                  : f.key === "interval_months"
                    ? 1
                    : f.key === "due_day"
                      ? 10
                      : f.key === "max_score"
                        ? 10
                        : 0
                : "");
      if (f.type === "datetime-local" && value) {
        const date = new Date(String(value));
        value = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      }
      return [f.key, value];
    }),
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const cleaned = Object.fromEntries(
        module.fields.map((f) => [
          f.key,
          values[f.key] === ""
            ? null
            : f.type === "datetime-local"
              ? new Date(String(values[f.key])).toISOString()
              : values[f.key],
        ]),
      );
      return saveRow(module.table, school, cleaned, row?.id);
    },
    onSuccess: () => {
      client.invalidateQueries();
      onSaved(row ? "Alterações salvas." : "Cadastro realizado.");
      onClose();
    },
  });
  const blocked = options.some((q) => q.isPending || q.isError);
  return (
    <Modal
      title={(row ? "Editar " : "Cadastrar ") + module.singular}
      onClose={onClose}
      wide
    >
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <div className="form-grid">
          {module.fields.map((f) => (
            <label
              key={f.key}
              className={
                f.type === "textarea"
                  ? "span-2"
                  : f.type === "checkbox"
                    ? "check-field"
                    : ""
              }
            >
              <span>
                {f.label}
                {f.required ? " *" : ""}
              </span>
              {f.type === "select" ? (
                <select {...register(f.key)}>
                  <option value="">Selecione</option>
                  {f.ref
                    ? (options[refs.indexOf(f.ref)]?.data || [])
                        .filter(
                          (r) => r.active !== false || r.id === row?.[f.key],
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name || r.id}
                          </option>
                        ))
                    : f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea rows={4} {...register(f.key)} />
              ) : (
                <input
                  {...register(f.key)}
                  type={f.type || "text"}
                  min={f.min}
                  max={
                    f.type === "date" && f.key === "birth_date"
                      ? today()
                      : f.max
                  }
                  step={f.step}
                />
              )}
              <small>{(errors[f.key]?.message as string) || f.hint}</small>
            </label>
          ))}
        </div>
        {options.some((q) => q.isError) && (
          <p className="error-text">
            Não foi possível carregar os cadastros relacionados. Feche e tente
            novamente.
          </p>
        )}
        {mutation.isError && (
          <p role="alert" className="error-text">
            {friendlyError(mutation.error)}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            disabled={mutation.isPending || blocked}
            className="btn primary"
          >
            {mutation.isPending ? "Salvando…" : "Salvar " + module.singular}
          </button>
        </div>
      </form>
    </Modal>
  );
}
