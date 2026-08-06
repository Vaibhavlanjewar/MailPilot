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
import ForgotPassword from './pages/ForgotPassword';
import JobSearch from './pages/JobSearch';
import InterviewPrep from './pages/InterviewPrep';
import PostJob from './pages/PostJob';
import MyPostings from './pages/MyPostings';
import CareerFit from './pages/CareerFit';
import MockInterviewLobby from './pages/MockInterviewLobby';
import MockInterviewRoom from './pages/MockInterviewRoom';
import ComingSoon from './pages/ComingSoon';
import { LIVE_PRACTICE_ROOM_ENABLED } from './config/features';
import Community from './pages/Community';
import MindGames from './pages/MindGames';
import MyResume from './pages/MyResume';
import ResumeRag from './pages/ResumeRag';
import Roadmap from './pages/Roadmap';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/contact-us" element={<ContactUs />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />

          {/* Outreach */}
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/:id" element={<CampaignDetail />} />
          <Route path="campaigns/new" element={<CreateCampaign />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="templates" element={<Templates />} />
          <Route path="templates/new" element={<TemplateEditor />} />
          <Route path="templates/:id/edit" element={<TemplateEditor />} />
          <Route path="email-tracking" element={<EmailTracking />} />
          <Route path="analytics" element={<Analytics />} />

          {/* Career */}
          <Route path="resume" element={<MyResume />} />
          <Route path="resume-chat" element={<ResumeRag />} />
          <Route path="interview-prep" element={<InterviewPrep />} />
          <Route path="roadmap" element={<Roadmap />} />
          <Route path="jobs" element={<JobSearch />} />
          <Route path="post-job" element={<PostJob />} />
          <Route path="my-postings" element={<MyPostings />} />
          <Route path="career-fit" element={<CareerFit />} />
          {/* Built and signaling-verified, but gated until a real two-browser
              media call is confirmed — see client/src/config/features.js. */}
          <Route
            path="mock-interview"
            element={
              LIVE_PRACTICE_ROOM_ENABLED ? (
                <MockInterviewLobby />
              ) : (
                <ComingSoon
                  title="Live Practice Room"
                  description="1:1 video mock interviews with someone else on MailPilot — peer-to-peer, nothing recorded or stored."
                  note="We're finishing connection testing across different networks. In the meantime, Interview Prep has practice questions, a coach chat, and a live code sandbox."
                />
              )
            }
          />
          <Route
            path="mock-interview/:code"
            element={
              LIVE_PRACTICE_ROOM_ENABLED ? (
                <MockInterviewRoom />
              ) : (
                <Navigate to="/app/mock-interview" replace />
              )
            }
          />
          <Route path="community" element={<Community />} />
          <Route path="mind-games" element={<MindGames />} />

          {/* Account */}
          <Route path="settings" element={<Settings />} />
          <Route path="how-to-use" element={<HowToUse />} />
          <Route path="pricing" element={<Pricing />} />

          {/* Renamed/merged routes — keep old links working */}
          <Route path="ai-assistant" element={<Navigate to="/app/templates/new" replace />} />
          <Route path="resume-builder" element={<Navigate to="/app/resume" replace />} />
          <Route path="resume-rag" element={<Navigate to="/app/resume-chat" replace />} />
          <Route path="job-search" element={<Navigate to="/app/jobs" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
