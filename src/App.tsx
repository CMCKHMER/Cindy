import { lazy, Suspense } from "react";
import { AppProvider, useApp } from "./state/store";
import { Shell } from "./components/Shell";
import { FileDrawer } from "./components/Panels";
import { Icon } from "./components/ui";
import Dashboard from "./views/Dashboard";

const ScanView = lazy(() => import("./views/ScanView"));
const Duplicates = lazy(() => import("./views/Duplicates"));
const Broken = lazy(() => import("./views/Broken"));
const Rename = lazy(() => import("./views/Rename"));
const Organize = lazy(() => import("./views/Organize"));
const Analytics = lazy(() => import("./views/Analytics"));
const Explorer = lazy(() => import("./views/Explorer"));
const History = lazy(() => import("./views/History"));
const Settings = lazy(() => import("./views/Settings"));
const System = lazy(() => import("./views/System"));
const Desktop = lazy(() => import("./views/Desktop"));
const Live = lazy(() => import("./views/Live"));

function Loading() {
  return (
    <div className="card card-pad flex items-center gap-3">
      <span className="spin" style={{ color: "var(--teal)" }}><Icon name="cpu" size={18} /></span>
      <span className="text-[13px]" style={{ color: "var(--muted)" }}>Loading workspace…</span>
    </div>
  );
}

function Router() {
  const { s } = useApp();
  const view = s.view;
  return (
    <>
      <Shell>
        <Suspense fallback={<Loading />}>
          {view === "dashboard" && <Dashboard />}
          {view === "scan" && <ScanView />}
          {view === "duplicates" && <Duplicates />}
          {view === "broken" && <Broken />}
          {view === "rename" && <Rename />}
          {view === "organize" && <Organize />}
          {view === "analytics" && <Analytics />}
          {view === "explorer" && <Explorer />}
          {view === "history" && <History />}
          {view === "desktop" && <Desktop />}
          {view === "live" && <Live />}
          {view === "settings" && <Settings />}
          {view === "system" && <System />}
        </Suspense>
      </Shell>
      <FileDrawer />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <div className="aurora" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <Router />
    </AppProvider>
  );
}