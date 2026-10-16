import { useState } from "react";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { db, configured, friendlyError } from "../lib/supabase";
import { Brand } from "./ui";
export default function Auth({
  onPreview,
  recovery = false,
  onRecovered,
}: {
  onPreview?: () => void;
  recovery?: boolean;
  onRecovered: () => void;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [reset, setReset] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (recovery) {
        const { error } = await db().auth.updateUser({ password });
        if (error) throw error;
        onRecovered();
      } else if (reset) {
        const { error } = await db().auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setSuccess(
          "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.",
        );
      } else {
        const { error } = await db().auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="season-label">
            <span />A gestão joga junto
          </span>
          <h1>
            O futuro do futebol
            <br />
            começa na sua escola.
          </h1>
          <p>
            Das primeiras embaixadinhas às grandes conquistas. Cuide de cada
            etapa, dentro e fora de campo.
          </p>
          <div className="auth-lines" aria-hidden="true">
            <div />
            <span />
            <i />
          </div>
        </div>
        <small>
          <ShieldCheck size={16} />
          Uma plataforma para conectar escola, atletas e famílias.
        </small>
      </section>
      <section className="auth-form-side">
        <div className="auth-form">
          <span className="login-mark">
            <ShieldCheck size={25} />
          </span>
          <h2>
            {recovery
              ? "Crie sua nova senha"
              : reset
                ? "Vamos recuperar seu acesso"
                : "Bom ter você por aqui."}
          </h2>
          <p>
            {recovery
              ? "Use pelo menos 12 caracteres."
              : reset
                ? "Informe o e-mail da sua conta."
                : "Entre para acompanhar o que acontece na sua escola."}
          </p>
          {!configured ? (
            <div className="setup-box">
              <h3>Vamos conectar sua escola</h3>
              <p>
                Configure a URL e a chave pública do Supabase nas variáveis de
                ambiente. O passo a passo está no README do projeto.
              </p>
              <code>
                VITE_SUPABASE_URL
                <br />
                VITE_SUPABASE_PUBLISHABLE_KEY
              </code>
            </div>
          ) : (
            <form onSubmit={submit}>
              {!recovery && (
                <label>
                  E-mail
                  <input
                    autoComplete="email"
                    type="email"
                    placeholder="voce@suaescola.com.br"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
              {(!reset || recovery) && (
                <label>
                  Senha
                  <div className="password-input">
                    <input
                      autoComplete={
                        recovery ? "new-password" : "current-password"
                      }
                      type={show ? "text" : "password"}
                      minLength={recovery ? 12 : undefined}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Sua senha"
                    />
                    <button
                      type="button"
                      aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setShow(!show)}
                    >
                      {show ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                </label>
              )}
              {!recovery && (
                <button
                  type="button"
                  className="forgot"
                  onClick={() => {
                    setReset(!reset);
                    setError("");
                    setSuccess("");
                  }}
                >
                  {reset ? "Voltar para o login" : "Esqueci minha senha"}
                </button>
              )}
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              {success && (
                <p className="success-text" role="status">
                  {success}
                </p>
              )}
              <button className="btn primary login-submit" disabled={busy}>
                {busy
                  ? "Aguarde…"
                  : recovery
                    ? "Salvar nova senha"
                    : reset
                      ? "Enviar link de recuperação"
                      : "Entrar na escola"}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
          <div className="auth-help">
            <strong>Ainda não tem acesso?</strong>
            <p>Peça um convite à administração da sua escola.</p>
          </div>
          {onPreview && (
            <button className="text-btn" onClick={onPreview}>
              Abrir prévia de design local <ArrowUpRight size={16} />
            </button>
          )}
          <footer>FutGestão · Feito para quem forma atletas.</footer>
        </div>
      </section>
    </div>
  );
}
