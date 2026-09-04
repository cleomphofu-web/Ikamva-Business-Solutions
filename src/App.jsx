import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import PageNotFound from './lib/PageNotFound';
import Home from './pages/Home';
import Contact from './pages/Contact';
import ServicesPage from './pages/Services';
import Onboarding from './pages/Onboarding';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import VerifyEmail from './pages/VerifyEmail';
import { ApplicationPendingPage, ApplicationRejectedPage, ProvisioningPage } from './pages/StatusNotice';
import AccessGate from '@/components/AccessGate';
import { MissionControlLayout } from '@/components/ikamva/MissionControlLayout';
import MissionControlOverview from './pages/client/MissionControl/Overview';
import MissionControlContext from './pages/client/MissionControl/context';
import MissionControlRules from './pages/client/MissionControl/rules';
import MissionControlSchedule from './pages/client/MissionControl/schedule';
import MissionControlSkills from './pages/client/MissionControl/skills';
import MissionControlHours from './pages/client/MissionControl/hours';
import MissionControlTokens from './pages/client/MissionControl/tokens';
import MissionControlTools from './pages/client/MissionControl/tools';
import MissionControlApprovals from './pages/client/MissionControl/approvals';
import MissionControlLogs from './pages/client/MissionControl/logs';
import MissionControlAccount from './pages/client/MissionControl/account';
import MissionControlOnboarding from './pages/client/MissionControl/onboarding';
import AdminDashboard from './pages/admin/Dashboard';
import AdminApplications from './pages/admin/Applications';
import Inquiries from './pages/admin/Inquiries';
import Subscribers from './pages/admin/Subscribers';
import AdminTasks from './pages/admin/Tasks';
import AdminInvoices from './pages/admin/Invoices';
import AdminDocuments from './pages/admin/Documents';
import AdminReferrals from './pages/admin/Referrals';
import AdminProjects from './pages/admin/Projects';
import AdminQuoteCalculator from './pages/admin/QuoteCalculator';
import AutoReports from './pages/admin/AutoReports';
import AdminCRM from './pages/admin/CRM';

const withMissionControl = page => <MissionControlLayout>{page}</MissionControlLayout>;

const AuthenticatedApp = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/login" element={<SignIn />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/application-pending" element={<ApplicationPendingPage />} />
      <Route path="/application-rejected" element={<ApplicationRejectedPage />} />
      <Route path="/provisioning" element={<ProvisioningPage />} />

      <Route element={<AccessGate scope="client" />}>
        <Route path="/dashboard" element={withMissionControl(<MissionControlOverview />)} />
        <Route path="/dashboard/context" element={withMissionControl(<MissionControlContext />)} />
        <Route path="/dashboard/rules" element={withMissionControl(<MissionControlRules />)} />
        <Route path="/dashboard/schedule" element={withMissionControl(<MissionControlSchedule />)} />
        <Route path="/dashboard/skills" element={withMissionControl(<MissionControlSkills />)} />
        <Route path="/dashboard/hours" element={withMissionControl(<MissionControlHours />)} />
        <Route path="/dashboard/tokens" element={withMissionControl(<MissionControlTokens />)} />
        <Route path="/dashboard/tools" element={withMissionControl(<MissionControlTools />)} />
        <Route path="/dashboard/approvals" element={withMissionControl(<MissionControlApprovals />)} />
        <Route path="/dashboard/logs" element={withMissionControl(<MissionControlLogs />)} />
        <Route path="/dashboard/account" element={withMissionControl(<MissionControlAccount />)} />
        <Route path="/dashboard/onboarding" element={withMissionControl(<MissionControlOnboarding />)} />
      </Route>

      <Route element={<AccessGate scope="admin" />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/applications" element={<AdminApplications />} />
        <Route path="/admin/inquiries" element={<Inquiries />} />
        <Route path="/admin/subscribers" element={<Subscribers />} />
        <Route path="/admin/tasks" element={<AdminTasks />} />
        <Route path="/admin/invoices" element={<AdminInvoices />} />
        <Route path="/admin/documents" element={<AdminDocuments />} />
        <Route path="/admin/referrals" element={<AdminReferrals />} />
        <Route path="/admin/projects" element={<AdminProjects />} />
        <Route path="/admin/quote-calculator" element={<AdminQuoteCalculator />} />
        <Route path="/admin/auto-reports" element={<AutoReports />} />
        <Route path="/admin/crm" element={<AdminCRM />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
