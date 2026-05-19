import { HashRouter, Routes, Route } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import JiraSync from "@/pages/JiraSync";
import DailyScrum from "@/pages/DailyScrum";
import DailyScrumHistory from "@/pages/DailyScrumHistory";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import UiPreview from "@/pages/UiPreview";
import { ROUTES } from "@/lib/index";
import { Toaster } from "@/components/ui/toaster";

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path={ROUTES.JIRA_SYNC} element={<JiraSync />} />
            <Route path={ROUTES.DAILY_SCRUM} element={<DailyScrum />} />
            <Route path={ROUTES.SCRUM_HISTORY} element={<DailyScrumHistory />} />
            <Route path={ROUTES.ANALYTICS} element={<Analytics />} />
            <Route path={ROUTES.SETTINGS} element={<Settings />} />
            <Route path={ROUTES.UI_PREVIEW} element={<UiPreview />} />
          </Route>
        </Routes>
        <Toaster />
      </HashRouter>
    </MotionConfig>
  );
}
