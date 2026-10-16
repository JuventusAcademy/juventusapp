import { useEffect, useState, lazy, Suspense } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Contact,
  Goal,
  GraduationCap,
  ClipboardCheck,
  Wallet,
  CalendarDays,
  Newspaper,
  BarChart3,
  Settings as SettingsIcon,
  Bell,
  Search,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Sun,
  Moon,
  ArrowUpRight,
  Plus,
  ShieldCheck,
  Home,
  UserRound,
  MoreHorizontal,
  Trophy,
  Activity,
  Database,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { configured, db, supabase, friendlyError } from "./lib/supabase";
import type { Role, Row } from "./domain";
import { roles, dateLabel } from "./domain";
import { modules } from "./modules";
import Auth from "./components/Auth";
const Dashboard = lazy(() => import("./components/Dashboard"));
const Records = lazy(() => import("./components/Records"));
const Attendance = lazy(() => import("./components/Attendance"));
const Portal = lazy(() => import("./components/Portal"));
const Calendar = lazy(() => import("./components/Calendar"));
const Reports = lazy(() => import("./components/Reports"));
const Settings = lazy(() => import("./components/Settings"));
import { Brand, Loading, ErrorState, Modal, Empty } from "./components/ui";
type Membership = {
  school_id: string;
  role: Role;
  schools: { name: string } | null;
};
const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  students: Users,
  guardians: Contact,
  coaches: GraduationCap,
  teams: Goal,
  attendance: ClipboardCheck,
  finance: Wallet,
  calendar: CalendarDays,
  news: Newspaper,
  reports: BarChart3,
  settings: SettingsIcon,
  portal: Home,
  training: Activity,
  competitions: Trophy,
};
const mainNav = [
  "dashboard",
  "students",
  "guardians",
  "coaches",
  "teams",
  "attendance",
  "finance",
  "calendar",
  "news",
  "reports",
];
const moreNav = [
  "enrollments",
  "links",
  "categories",
  "units",
  "plans",
  "student-plans",
  "training",
  "announcements",
  "events",
  "criteria",
  "evaluations",
  "competitions",
  "matches",
  "callups",
];
const titles: Record<string, string> = {
  dashboard: "Visão geral",
  attendance: "Chamada",
  calendar: "Agenda",
  reports: "Relatórios",
  settings: "Configurações",
  portal: "Início",
  profile: "Meu perfil",
};
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [authLoading, setAuthLoading] = useState(configured),
    [recovery, setRecovery] = useState(
      /type=(recovery|invite)/.test(window.location.hash) ||
        new URLSearchParams(location.search).get("setup") === "1",
    ),
    [preview, setPreview] = useState(false),
    [schoolChoice, setSchoolChoice] = useState(""),
    [page, setPage] = useState("dashboard"),
    [mobile, setMobile] = useState(false),
    [more, setMore] = useState(false),
    [toast, setToast] = useState(""),
    [dark, setDark] = useState(
      localStorage.getItem("futgestao-theme") === "dark",
    ),
    [online, setOnline] = useState(navigator.onLine),
    [notifications, setNotifications] = useState(false),
    [search, setSearch] = useState(false),
    [searchText, setSearchText] = useState("");
  const client = useQueryClient();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("futgestao-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setAuthLoading(false);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") {
        client.clear();
        setSchoolChoice("");
        setPage("dashboard");
      }
    });
    return () => data.subscription.unsubscribe();
  }, [client]);
  useEffect(() => {
    const handler = () => setOnline(navigator.onLine);
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const membership = useQuery({
    queryKey: ["memberships", session?.user.id],
    enabled: !!session && !preview,
    queryFn: async () => {
      const { data, error } = await db()
        .from("school_memberships")
        .select("school_id,role,schools(name)")
        .eq("user_id", session!.user.id)
        .eq("active", true);
      if (error) throw error;
      return data as unknown as Membership[];
    },
  });
  const member =
    membership.data?.find((m) => m.school_id === schoolChoice) ||
    membership.data?.[0];
  const role: Role = preview ? "admin" : member?.role || "guardian";
  const school = preview ? "preview" : member?.school_id || "";
  const schoolName = preview
    ? "Juventus Academy São Carlos"
    : member?.schools?.name || "Minha escola";
  const parent = role === "guardian" || role === "student";
  const notif = useQuery({
    queryKey: ["notifications", school, session?.user.id],
    enabled: !!school && !preview,
    queryFn: async () => {
      const { data, error } = await db()
        .from("notifications")
        .select("*")
        .eq("school_id", school)
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as Row[];
    },
  });
  function canAccess(id: string) {
    if (id === "dashboard") return !parent;
    if (id === "portal" || id === "profile") return true;
    if (id === "settings") return role === "admin";
    if (id === "reports") return ["admin", "secretary"].includes(role);
    if (id === "attendance")
      return ["admin", "secretary", "coach"].includes(role);
    if (id === "calendar") return true;
    return modules.find((m) => m.id === id)?.read.includes(role) || false;
  }
  function navigate(id: string) {
    if (!canAccess(id)) return;
    setPage(id);
    setMobile(false);
    setSearch(false);
  }
  const actualPage =
    page === "dashboard" && parent
      ? "portal"
      : canAccess(page)
        ? page
        : parent
          ? "portal"
          : "dashboard";
  async function logout() {
    if (preview) {
      setPreview(false);
      setPage("dashboard");
      client.clear();
      return;
    }
    const { error } = await db().auth.signOut();
    if (error) setToast(friendlyError(error));
  }
  const title = (id: string) =>
    titles[id] || modules.find((m) => m.id === id)?.title || id;
  if (authLoading) return <Loading />;
  if ((!session && !preview) || recovery)
    return (
      <Auth
        recovery={recovery}
        onRecovered={() => {
          setRecovery(false);
          history.replaceState(null, "", location.pathname);
        }}
        onPreview={
          import.meta.env.DEV
            ? () => {
                setPreview(true);
                client.clear();
              }
            : undefined
        }
      />
    );
  if (!preview && (membership.isPending || membership.isError || !member))
    return (
      <div className="onboarding">
        <Brand />
        {membership.isPending ? (
          <Loading />
        ) : membership.isError ? (
          <ErrorState
            message={friendlyError(membership.error)}
            retry={() => membership.refetch()}
          />
        ) : (
          <>
            <ShieldCheck size={42} />
            <h1>Seu acesso está pronto para ser vinculado.</h1>
            <p>
              A administração precisa vincular sua conta a uma escola e definir
              seu perfil. Se você é o primeiro administrador, siga o roteiro de
              ativação no README.
            </p>
          </>
        )}
        <button className="btn secondary" onClick={logout}>
          Sair da conta
        </button>
        {import.meta.env.DEV && (
          <button className="btn primary" onClick={() => setPreview(true)}>
            Ver prévia de design
          </button>
        )}
      </div>
    );
  const nav = parent
    ? ["portal", "calendar", "finance", "news", "profile"]
    : mainNav.filter(canAccess);
  const module = modules.find((m) => m.id === actualPage);
  const name =
    session?.user.user_metadata?.full_name ||
    session?.user.email?.split("@")[0] ||
    (preview ? "Equipe da escola" : "Minha conta");
  return (
    <div className={"app " + (parent ? "parent-app" : "")}>
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <div className="sidebar-top">
          <Brand />
          <button
            className="icon-btn mobile-only"
            aria-label="Fechar menu"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="school-switch">
          <span className="school-emblem">
            <Goal size={21} />
          </span>
          <div>
            <strong>{schoolName}</strong>
            {membership.data && membership.data.length > 1 ? (
              <select
                aria-label="Selecionar escola"
                value={school}
                onChange={(e) => {
                  client.removeQueries({
                    predicate: (q) => q.queryKey[0] !== "memberships",
                  });
                  setSchoolChoice(e.target.value);
                  setPage("dashboard");
                }}
              >
                {membership.data.map((m) => (
                  <option key={m.school_id} value={m.school_id}>
                    {m.schools?.name}
                  </option>
                ))}
              </select>
            ) : (
              <small>{parent ? "Portal da família" : "Gestão da escola"}</small>
            )}
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="sidebar-label">
          {parent ? "Sua família" : "Sua escola"}
        </div>
        <nav>
          {nav.map((id) => {
            const Icon = icons[id] || UserRound;
            return (
              <button
                key={id}
                className={actualPage === id ? "active" : ""}
                onClick={() => navigate(id)}
              >
                <Icon size={19} />
                <span>{title(id)}</span>
                {actualPage === id && <i />}
              </button>
            );
          })}
          {!parent && (
            <>
              <button
                className={more ? "expanded" : ""}
                onClick={() => setMore(!more)}
              >
                <MoreHorizontal size={19} />
                <span>Mais módulos</span>
                <ChevronDown size={14} />
              </button>
              {more && (
                <div className="more-nav">
                  {moreNav.filter(canAccess).map((id) => (
                    <button
                      key={id}
                      className={actualPage === id ? "active" : ""}
                      onClick={() => navigate(id)}
                    >
                      {title(id)}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          {!parent && (
            <div className="sidebar-note">
              <span className="note-ball">⚽</span>
              <strong>
                Formar atletas.
                <br />
                Conectar pessoas.
              </strong>
              <small>A gestão também faz parte do jogo.</small>
            </div>
          )}
          {canAccess("settings") && (
            <button
              className={
                "sidebar-setting " + (actualPage === "settings" ? "active" : "")
              }
              onClick={() => navigate("settings")}
            >
              <SettingsIcon size={18} />
              Configurações
            </button>
          )}
          <button
            className="profile-switch"
            onClick={() => navigate("profile")}
          >
            <span className="avatar">{name.slice(0, 2).toUpperCase()}</span>
            <span>
              <strong>{name}</strong>
              <small>{roles[role]}</small>
            </span>
            <MoreHorizontal size={17} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          aria-label="Fechar menu"
          className="sidebar-overlay"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-only"
              aria-label="Abrir menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span>{parent ? "Portal da família" : "Painel da escola"}</span>
            <span>/</span>
            <strong>{title(actualPage)}</strong>
          </div>
          <div className="top-actions">
            <button className="search-shortcut" onClick={() => setSearch(true)}>
              <Search size={16} />
              <span>Encontrar módulo</span>
              <kbd>⌕</kbd>
            </button>
            <button
              className="icon-btn"
              aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              className="icon-btn notification-btn"
              aria-label="Abrir notificações"
              onClick={() => setNotifications(true)}
            >
              <Bell size={20} />
              {notif.data?.some((n) => !n.read_at) && <i />}
            </button>
            <span className="top-divider" />
            <button
              className="top-avatar avatar"
              aria-label="Meu perfil"
              onClick={() => navigate("profile")}
            >
              {name.slice(0, 2).toUpperCase()}
            </button>
          </div>
        </header>
        {preview && (
          <div className="preview-banner">
            <Database size={15} />
            <span>
              Prévia de design · Dados fictícios · Alterações e cobranças
              desabilitadas
            </span>
            <button
              onClick={() => {
                setPreview(false);
                client.clear();
              }}
            >
              Voltar ao acesso real
            </button>
          </div>
        )}
        {!online && (
          <div className="offline-banner">
            Você está sem conexão. Reconecte para consultar e salvar
            informações.
          </div>
        )}
        <main key={school + actualPage}>
          <Suspense fallback={<Loading />}>
            {actualPage === "dashboard" ? (
              <Dashboard
                school={school}
                role={role}
                preview={preview}
                navigate={navigate}
              />
            ) : actualPage === "portal" ? (
              <Portal school={school} navigate={navigate} notify={setToast} />
            ) : actualPage === "attendance" ? (
              <Attendance school={school} preview={preview} notify={setToast} />
            ) : actualPage === "calendar" ? (
              <Calendar school={school} preview={preview} />
            ) : actualPage === "reports" ? (
              <Reports school={school} preview={preview} />
            ) : actualPage === "settings" ? (
              <Settings school={school} preview={preview} notify={setToast} />
            ) : actualPage === "profile" ? (
              <>
                <div className="page-title">
                  <div>
                    <h1>Meu perfil</h1>
                    <p>Seu acesso à escola.</p>
                  </div>
                </div>
                <section className="panel padded">
                  <div className="student-summary">
                    <span className="avatar large">
                      {name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <h2>{name}</h2>
                      <p>
                        {session?.user.email || "Prévia de desenvolvimento"}
                      </p>
                      <strong>{roles[role]}</strong>
                    </div>
                  </div>
                  <p>
                    Para alterar seus dados ou vínculos, entre em contato com a
                    administração.
                  </p>
                  <button className="btn secondary" onClick={logout}>
                    <LogOut size={17} />
                    Sair da conta
                  </button>
                </section>
              </>
            ) : module ? (
              <Records
                key={module.id}
                module={module}
                school={school}
                role={role}
                preview={preview}
                notify={setToast}
              />
            ) : null}
          </Suspense>
          <footer className="app-footer">
            <span>FutGestão</span>
            <span>Dentro e fora de campo.</span>
            <small>{dateLabel(new Date().toISOString())}</small>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav">
        {(parent
          ? ["portal", "calendar", "finance", "news", "profile"]
          : ["dashboard", "students", "attendance", "finance"]
        )
          .filter(canAccess)
          .map((id) => {
            const Icon = icons[id] || UserRound;
            return (
              <button
                key={id}
                className={actualPage === id ? "active" : ""}
                onClick={() => navigate(id)}
              >
                <Icon size={21} />
                <span>{title(id)}</span>
              </button>
            );
          })}
        {!parent && (
          <button onClick={() => setMobile(true)}>
            <Menu size={21} />
            <span>Menu</span>
          </button>
        )}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button aria-label="Fechar aviso" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {notifications && (
        <Modal title="Notificações" onClose={() => setNotifications(false)}>
          {notif.isPending && !preview ? (
            <Loading />
          ) : notif.isError ? (
            <ErrorState
              message={friendlyError(notif.error)}
              retry={() => notif.refetch()}
            />
          ) : !notif.data?.length ? (
            <Empty
              title="Nenhuma novidade por aqui"
              text="Os próximos avisos da sua escola aparecem aqui."
            />
          ) : (
            <div className="detail-list">
              {notif.data.map((n) => (
                <div key={n.id}>
                  <div>
                    <strong>{n.name}</strong>
                    <p>{String(n.content || "")}</p>
                    <small>{dateLabel(n.created_at, true)}</small>
                  </div>
                  {!n.read_at && (
                    <button
                      className="text-btn"
                      onClick={async () => {
                        const { error } = await db().rpc(
                          "mark_notification_read",
                          { nid: n.id },
                        );
                        if (error) setToast(friendlyError(error));
                        else
                          client.invalidateQueries({
                            queryKey: ["notifications"],
                          });
                      }}
                    >
                      Marcar como lida
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
      {search && (
        <Modal title="O que você quer fazer?" onClose={() => setSearch(false)}>
          <label className="search">
            <Search size={18} />
            <input
              autoFocus
              placeholder="Alunos, financeiro, treinos…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </label>
          <div className="module-search">
            {[...mainNav, ...moreNav, "settings", "portal", "profile"]
              .filter(canAccess)
              .filter((id) =>
                title(id).toLowerCase().includes(searchText.toLowerCase()),
              )
              .map((id) => (
                <button key={id} onClick={() => navigate(id)}>
                  <span>{title(id)}</span>
                  <ArrowUpRight size={17} />
                </button>
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
