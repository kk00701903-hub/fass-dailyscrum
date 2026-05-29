import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import FindId from "@/pages/FindId";
import FindPassword from "@/pages/FindPassword";
import JiraSync from "@/pages/JiraSync";
import JiraWbs from "@/pages/JiraWbs";
import JiraDependencies from "@/pages/JiraDependencies";
import DailyScrum from "@/pages/DailyScrum";
import DailyScrumHistory from "@/pages/DailyScrumHistory";
import ScrumDbLog from "@/pages/ScrumDbLog";
import ScrumNotes from "@/pages/ScrumNotes";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import { ROUTES } from "@/lib/index";
import { Toaster } from "@/components/ui/toaster";
import { ChatWidget } from "@/components/ChatWidget";

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      {/* GitHub Pages: Vite `base`만 쓰고 Hash 경로는 `#/scrum` 형태. HashRouter basename 은 라우트 불일치·빈 화면 유발 */}
      <HashRouter>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<Login />} />
          <Route path={ROUTES.SIGNUP} element={<Signup />} />
          <Route path={ROUTES.FIND_ID} element={<FindId />} />
          <Route path={ROUTES.FIND_PASSWORD} element={<FindPassword />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to={ROUTES.DAILY_SCRUM} replace />} />
              <Route path={ROUTES.JIRA_SYNC} element={<JiraSync />} />
              <Route path={ROUTES.JIRA_WBS} element={<JiraWbs />} />
              <Route path={ROUTES.JIRA_DEPENDENCIES} element={<JiraDependencies />} />
              <Route path={ROUTES.DAILY_SCRUM} element={<DailyScrum />} />
              <Route path={ROUTES.SCRUM_HISTORY} element={<DailyScrumHistory />} />
              <Route path={ROUTES.SCRUM_DB_LOG} element={<ScrumDbLog />} />
              <Route path={ROUTES.SCRUM_NOTES} element={<ScrumNotes />} />
              <Route path={ROUTES.ANALYTICS} element={<Analytics />} />
              <Route path={ROUTES.SETTINGS} element={<Settings />} />
            </Route>
          </Route>
        </Routes>
        <Toaster />
        <ChatWidget />
      </HashRouter>
    </MotionConfig>
  );
}
