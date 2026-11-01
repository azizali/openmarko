import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Service from "./pages/Service";
import Pricing from "./pages/Pricing";
import { CompareDetail, CompareIndex } from "./pages/Compare";
import { CaseStudyPage, Customers } from "./pages/Customers";

// Clean URLs for search engines. Static hosts need a rewrite of unknown paths to /index.html.
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="services" element={<Navigate to="/" replace />} />
          <Route path="services/:slug" element={<Service />} />
          <Route path="compare" element={<CompareIndex />} />
          <Route path="compare/:slug" element={<CompareDetail />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:slug" element={<CaseStudyPage />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
