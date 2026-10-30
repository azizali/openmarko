import { HashRouter, Navigate, Route, Routes, useParams, useSearchParams } from "react-router";
import Layout from "./components/Layout";
import Onboarding from "./pages/Onboarding";
import CommandCenter from "./pages/CommandCenter";
import Rankings from "./pages/Rankings";
import Todo from "./pages/Todo";
import Competitors from "./pages/Competitors";
import CompetitorDetail from "./pages/CompetitorDetail";
import Factors from "./pages/Factors";
import Audit from "./pages/Audit";
import AuditIssue from "./pages/AuditIssue";
import Keywords from "./pages/Keywords";
import Profile from "./pages/Profile";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Prospects from "./pages/Prospects";
import ProspectAudit from "./pages/ProspectAudit";
import AiVisibility from "./pages/AiVisibility";
import Citations from "./pages/Citations";
import PublicAudit from "./pages/PublicAudit";
import Content from "./pages/Content";
import SocialScanner from "./pages/SocialScanner";
import SwipeFile from "./pages/SwipeFile";
import SocialPosts from "./pages/SocialPosts";

// Rank pack now lives inside Rankings (Map pack view); keep old links working.
function GridRedirect() {
  const [params] = useSearchParams();
  const kw = params.get("kw");
  return <Navigate replace to={`/rankings?view=local${kw ? `&kw=${kw}` : ""}`} />;
}

// The Action plan merged into To-do; keep old links working.
function ActionRedirect() {
  const { id } = useParams();
  return <Navigate replace to={id ? `/todo?task=${id}` : "/todo"} />;
}

// HashRouter keeps the mock deployable as static files anywhere.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        {/* Shared audit links open on their own, without the app around them. */}
        <Route path="/a/:token" element={<PublicAudit />} />
        <Route element={<Layout />}>
          <Route index element={<CommandCenter />} />
          <Route path="rankings" element={<Rankings />} />
          <Route path="rankings/:id" element={<Rankings />} />
          <Route path="grid" element={<GridRedirect />} />
          <Route path="todo" element={<Todo />} />
          <Route path="competitors" element={<Competitors />} />
          <Route path="competitors/:id" element={<CompetitorDetail />} />
          <Route path="factors" element={<Factors />} />
          <Route path="audit" element={<Audit />} />
          <Route path="audit/:id" element={<AuditIssue />} />
          <Route path="keywords" element={<Keywords />} />
          <Route path="content" element={<Content />} />
          <Route path="actions" element={<ActionRedirect />} />
          <Route path="actions/:id" element={<ActionRedirect />} />
          <Route path="profile" element={<Profile />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Navigate replace to="/settings/brand" />} />
          <Route path="settings/:section" element={<Settings />} />
          <Route path="prospects" element={<Prospects />} />
          <Route path="prospects/:id" element={<ProspectAudit />} />
          <Route path="runs" element={<Navigate replace to="/settings/activity" />} />
          <Route path="ai" element={<AiVisibility />} />
          <Route path="citations" element={<Citations />} />
          <Route path="social" element={<Navigate replace to="/social/scanner" />} />
          <Route path="social/scanner" element={<SocialScanner />} />
          <Route path="social/trends" element={<Navigate replace to="/social/scanner?tab=trending" />} />
          <Route path="social/swipe" element={<SwipeFile />} />
          <Route path="social/posts" element={<SocialPosts />} />
          <Route path="social/voice" element={<Navigate replace to="/settings/brand" />} />
          {/* Brand voice, Skills and Activity moved into Settings; keep old links working. */}
          <Route path="brand" element={<Navigate replace to="/settings/brand" />} />
          <Route path="skills" element={<Navigate replace to="/settings/skills" />} />
          <Route path="*" element={<CommandCenter />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
