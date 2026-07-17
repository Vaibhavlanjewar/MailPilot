import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import CreateCampaign from './pages/CreateCampaign';
import CampaignDetail from './pages/CampaignDetail';
import Contacts from './pages/Contacts';
import Templates from './pages/Templates';
import TemplateEditor from './pages/TemplateEditor';
import Analytics from './pages/Analytics';
import EmailTracking from './pages/EmailTracking';
import Settings from './pages/Settings';
import HowToUse from './pages/HowToUse';
import Pricing from './pages/Pricing';
import ContactUs from './pages/ContactUs';
import Login from './pages/Login';
import Register from './pages/Register';
import GoogleLoginCallback from './pages/GoogleLoginCallback';
import VerifyOtp from './pages/VerifyOtp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AiAssistant from './pages/AiAssistant';
import JobSearch from './pages/JobSearch';
import InterviewPrep from './pages/InterviewPrep';
import PostJob from './pages/PostJob';
import Community from './pages/Community';
import ResumeBuilder from './pages/ResumeBuilder';
import ResumeRag from './pages/ResumeRag';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/login/google/callback" element={<GoogleLoginCallback />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/contact-us" element={<ContactUs />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/:id" element={<CampaignDetail />} />
          <Route path="campaigns/new" element={<CreateCampaign />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="templates" element={<Templates />} />
          <Route path="templates/new" element={<TemplateEditor />} />
          <Route path="templates/:id/edit" element={<TemplateEditor />} />
           <Route path="analytics" element={<Analytics />} />
          <Route path="email-tracking" element={<EmailTracking />} />
          <Route path="ai-assistant" element={<AiAssistant />} />
          <Route path="job-search" element={<JobSearch />} />
          <Route path="interview-prep" element={<InterviewPrep />} />
          <Route path="post-job" element={<PostJob />} />
          <Route path="community" element={<Community />} />
          <Route path="resume-builder" element={<ResumeBuilder />} />
          <Route path="resume-rag" element={<ResumeRag />} />
          <Route path="settings" element={<Settings />} />
          <Route path="how-to-use" element={<HowToUse />} />
          <Route path="pricing" element={<Pricing />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
