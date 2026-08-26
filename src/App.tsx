import { Navigate, Route, Routes } from "react-router";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminLoginPage } from "@/pages/admin/AdminLoginPage";
import { AdminsPage } from "@/pages/admin/AdminsPage";
import { SubmissionDetailPage } from "@/pages/admin/SubmissionDetailPage";
import { SubmissionsPage } from "@/pages/admin/SubmissionsPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { SurveyPage } from "@/pages/SurveyPage";
import { ThankYouPage } from "@/pages/ThankYouPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<SurveyPage />} />
      <Route path="/hvala" element={<ThankYouPage />} />
      <Route path="/privatnost" element={<PrivacyPage />} />

      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<Navigate to="/admin/submissions" replace />} />
        <Route path="/admin/submissions" element={<SubmissionsPage />} />
        <Route path="/admin/submissions/:id" element={<SubmissionDetailPage />} />
        <Route path="/admin/admins" element={<AdminsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
