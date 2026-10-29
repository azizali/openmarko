import { HashRouter, Route, Routes } from "react-router";
import Layout from "./components/Layout";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Rankings from "./pages/Rankings";
import KeywordDetail from "./pages/KeywordDetail";
import RankPack from "./pages/RankPack";
import Competitors from "./pages/Competitors";
import CompetitorDetail from "./pages/CompetitorDetail";
import Factors from "./pages/Factors";
import Audit from "./pages/Audit";
import AuditIssue from "./pages/AuditIssue";
import Keywords from "./pages/Keywords";
import Actions from "./pages/Actions";
import Profile from "./pages/Profile";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

// HashRouter keeps the mock deployable as static files anywhere.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="rankings" element={<Rankings />} />
          <Route path="rankings/:id" element={<KeywordDetail />} />
          <Route path="grid" element={<RankPack />} />
          <Route path="competitors" element={<Competitors />} />
          <Route path="competitors/:id" element={<CompetitorDetail />} />
          <Route path="factors" element={<Factors />} />
          <Route path="audit" element={<Audit />} />
          <Route path="audit/:id" element={<AuditIssue />} />
          <Route path="keywords" element={<Keywords />} />
          <Route path="actions" element={<Actions />} />
          <Route path="actions/:id" element={<Actions />} />
          <Route path="profile" element={<Profile />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
