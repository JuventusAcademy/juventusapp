import { createClient } from "@supabase/supabase-js";
const env = import.meta.env;
export const configured = Boolean(
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const supabase = configured
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export const designPreview =
  env.DEV && env.VITE_ENABLE_DESIGN_PREVIEW === "true";
export function db() {
  if (!supabase)
    throw new Error("Conecte o projeto Supabase para utilizar esta função.");
  return supabase;
}
export function friendlyError(error: unknown) {
  const e = error as { message?: string; code?: string };
  if (e.code === "23505")
    return "Já existe um registro com esses dados. Confira a matrícula, competência ou e-mail.";
  if (e.code === "23503")
    return "O registro está vinculado a outro cadastro. Confira os campos selecionados.";
  if (e.code === "42501")
    return "Seu perfil não tem permissão para esta operação.";
  if (e.message?.includes("Failed to fetch"))
    return "Não foi possível acessar o servidor. Confira sua conexão.";
  if (e.message === "Invalid login credentials")
    return "E-mail ou senha incorretos.";
  return e.message || "Não foi possível concluir. Tente novamente.";
}
