import { lazy, Suspense, type ComponentType } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router";
import Layout from "./components/Layout";
import { SessionProvider } from "./lib/session";
import { ToastProvider } from "./components/Feedback";
import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import AcceptInvitation from "./pages/auth/AcceptInvitation";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Settings from "./pages/Settings";

/**
 * Pages of optional modules load lazily behind their build-time flag: with the flag false the whole expression folds
 * away, so the page and its code never reach the bundle (vite.config.ts).
 */
const page = (load: false | (() => Promise<{ default: ComponentType }>)) => (load ? lazy(load) : null);
const Widgets = page(__MODULE_AI__ && (() => import("./pages/Widgets")));
const Knowledge = page(__MODULE_KNOWLEDGE__ && (() => import("./pages/Knowledge")));
const Automation = page(__MODULE_AUTOMATION__ && (() => import("./pages/Automation")));
const Seo = page(__MODULE_SEO__ && (() => import("./pages/seo/Seo")));
const SeoSetup = page(__MODULE_SEO__ && (() => import("./pages/seo/Setup")));

/** Admin moved into Settings (ADR 0027); old links still land on the same section. */
function AdminRedirect() {
  const { "*": section } = useParams();
  return <Navigate replace to={`/settings/admin-${section || "users"}`} />;
}

export default function App() {
  return (
    <SessionProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/sign-in" element={<SignIn />} />
              <Route path="/sign-up" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/accept-invitation/:id" element={<AcceptInvitation />} />
              <Route path="/onboarding" element={<Onboarding />} />
              {SeoSetup && <Route path="/seo/setup" element={<SeoSetup />} />}
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                {Widgets && <Route path="widgets" element={<Widgets />} />}
                {Widgets && <Route path="widgets/:widgetId" element={<Widgets />} />}
                {Widgets && <Route path="assistant/*" element={<Navigate replace to="/widgets" />} />}
                {Knowledge && <Route path="knowledge" element={<Knowledge />} />}
                {Knowledge && <Route path="knowledge/:baseId" element={<Knowledge />} />}
                {Automation && <Route path="automation" element={<Automation />} />}
                {Seo && <Route path="seo/:tab?" element={<Seo />} />}
                {Seo && <Route path="seo/:tab/*" element={<Seo />} />}
                <Route path="team" element={<Navigate replace to="/settings/team" />} />
                <Route path="clients" element={<Navigate replace to="/settings/clients" />} />
                <Route path="whitelabel" element={<Navigate replace to="/settings/whitelabel" />} />
                <Route path="settings" element={<Settings />} />
                <Route path="settings/:section" element={<Settings />} />
                <Route path="admin/*" element={<AdminRedirect />} />
                <Route path="*" element={<Navigate replace to="/" />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </SessionProvider>
  );
}
