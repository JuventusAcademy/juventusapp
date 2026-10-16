import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { related, saveRow } from "../lib/data";
import { friendlyError } from "../lib/supabase";
import { today } from "../domain";
import type { Row } from "../domain";
import {
  UserRound,
  Contact,
  Shirt,
  ShieldCheck,
  ArrowLeft,
  Save,
} from "lucide-react";
import { isDemoStudent, demoStudentPhoto } from "../lib/studentDemo";
import type { Module, Field } from "../modules";
import { Modal } from "./ui";
export default function RecordForm({
  module,
  school,
  row,
  onClose,
  onSaved,
  embedded = false,
}: {
  module: Module;
  school: string;
  row?: Row;
  onClose: () => void;
  onSaved: (s: string) => void;
  embedded?: boolean;
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
        if (f.required)
          s = s.min(
            f.key === "name" && module.id === "students" ? 2 : 1,
            f.key === "name" && module.id === "students"
              ? "Informe pelo menos 2 caracteres."
              : "Preencha este campo.",
          );
        if (f.type === "email")
          shape[f.key] = f.required
            ? z.email("Informe um e-mail válido.")
            : z.union([z.email("Informe um e-mail válido."), z.literal("")]);
        else if (f.key === "cpf")
          shape[f.key] = s.regex(
            /^$|^\d{11}$/,
            "Informe 11 números, sem pontos ou traços.",
          );
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
      if (
        v.min_age !== null &&
        v.max_age !== null &&
        Number(v.max_age) < Number(v.min_age)
      )
        ctx.addIssue({
          code: "custom",
          path: ["max_age"],
          message: "A idade máxima deve ser igual ou maior que a mínima.",
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
              ? f.key === "competence"
                ? today().slice(0, 7) + "-01"
                : f.key === "birth_date" || !f.required
                  ? ""
                  : today()
              : f.type === "number"
                ? !f.required
                  ? ""
                  : f.key === "capacity"
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
        value = new Intl.DateTimeFormat("sv-SE", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        })
          .format(date)
          .replace(" ", "T");
      }
      return [f.key, value];
    }),
  );
  const {
    register,
    watch,
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
              ? new Date(String(values[f.key]) + ":00-03:00").toISOString()
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
  const renderField = (f: Field) => (
    <label
      key={f.key}
      className={
        f.type === "textarea" || (embedded && f.key === "address")
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
                .filter((r) => r.active !== false || r.id === row?.[f.key])
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
          type={f.key === "phone" ? "tel" : f.type || "text"}
          autoComplete={
            f.key === "name"
              ? "name"
              : f.key === "phone"
                ? "tel"
                : f.key === "address"
                  ? "street-address"
                  : undefined
          }
          aria-invalid={!!errors[f.key]}
          min={f.min}
          max={f.type === "date" && f.key === "birth_date" ? today() : f.max}
          step={f.step}
        />
      )}
      <small>{(errors[f.key]?.message as string) || f.hint}</small>
    </label>
  );
  const sections = [
    {
      id: "student-personal",
      title: "Dados do atleta",
      description: "Identificação e nascimento do aluno.",
      Icon: UserRound,
      keys: ["name", "birth_date"],
    },
    {
      id: "student-contact",
      title: "Contato e endereço",
      description: "Informações para contato e localização.",
      Icon: Contact,
      keys: ["phone", "address"],
    },
    {
      id: "student-sport",
      title: "Perfil esportivo",
      description: "Posição e identificação dentro de campo.",
      Icon: Shirt,
      keys: ["position", "shirt_number"],
    },
    {
      id: "student-registration",
      title: "Cadastro e autorizações",
      description: "Situação do aluno e registro da autorização de imagem.",
      Icon: ShieldCheck,
      keys: ["status", "joined_on", "image_consent"],
    },
  ];
  const blocked = options.some((q) => q.isPending || q.isError);
  return (
    <RecordFrame
      title={(row ? "Editar " : "Cadastrar ") + module.singular}
      onClose={onClose}
      embedded={embedded}
    >
      <form
        className={embedded ? "student-editor-form" : ""}
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
      >
        {embedded ? (
          <div className="student-editor-layout">
            <aside className="student-editor-sidebar">
              <div className="panel editor-identity">
                {row && isDemoStudent(row) ? (
                  <img
                    src={demoStudentPhoto(row)}
                    alt="Foto de exemplo do atleta"
                  />
                ) : (
                  <span className="editor-avatar">
                    <UserRound size={32} />
                  </span>
                )}
                <strong>{String(watch("name") || "Novo atleta")}</strong>
                <small>
                  {row
                    ? "Matrícula " + row.registration_code
                    : "A matrícula será gerada ao salvar"}
                </small>
              </div>
              <nav
                className="panel editor-section-nav"
                aria-label="Seções do cadastro"
              >
                <strong>Neste cadastro</strong>
                {sections.map(({ id, title, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      document.getElementById(id)?.scrollIntoView({
                        behavior: window.matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches
                          ? "instant"
                          : "smooth",
                        block: "start",
                      })
                    }
                  >
                    <Icon size={17} />
                    {title}
                  </button>
                ))}
              </nav>
              <p className="editor-help">
                Campos com * são obrigatórios. Os dados serão vinculados à
                Juventus Academy São Carlos.
              </p>
            </aside>
            <div className="student-editor-sections">
              {sections.map(({ id, title, description, Icon }) => (
                <section
                  id={id}
                  key={id}
                  className="panel student-editor-section"
                >
                  <header>
                    <span>
                      <Icon size={20} />
                    </span>
                    <div>
                      <h2>{title}</h2>
                      <p>{description}</p>
                    </div>
                  </header>
                  <div className="form-grid">
                    {sections
                      .find((section) => section.id === id)!
                      .keys.map((key) =>
                        module.fields.find((f) => f.key === key),
                      )
                      .filter((f): f is Field => !!f)
                      .map(renderField)}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="form-grid">{module.fields.map(renderField)}</div>
        )}
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
        <div className={embedded ? "student-editor-actions" : "modal-actions"}>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            disabled={mutation.isPending || blocked}
            className="btn primary"
          >
            <Save size={16} />
            {mutation.isPending
              ? "Salvando…"
              : embedded
                ? row
                  ? "Salvar alterações"
                  : "Cadastrar aluno"
                : "Salvar " + module.singular}
          </button>
        </div>
      </form>
    </RecordFrame>
  );
}

function RecordFrame({
  title,
  onClose,
  embedded,
  children,
}: {
  title: string;
  onClose: () => void;
  embedded: boolean;
  children: React.ReactNode;
}) {
  return embedded ? (
    <div className="student-editor">
      <div className="page-title">
        <div>
          <button type="button" className="text-btn" onClick={onClose}>
            <ArrowLeft size={16} />
            Voltar aos alunos
          </button>
          <h1>{title}</h1>
          <p>Informações do atleta, contato e participação na escola.</p>
        </div>
        <span className="editor-school-label">
          <ShieldCheck size={16} />
          Juventus Academy São Carlos
        </span>
      </div>
      {children}
    </div>
  ) : (
    <Modal title={title} onClose={onClose} wide>
      {children}
    </Modal>
  );
}
