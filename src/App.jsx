import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Home from './pages/Home';
import Contact from './pages/Contact';
import AdminDashboard from './pages/admin/Dashboard';
import Inquiries from './pages/admin/Inquiries';
import Subscribers from './pages/admin/Subscribers';
import ClientOverview from './pages/client/Overview';
import ServiceHours from './pages/client/ServiceHours';
import UsageReports from './pages/client/UsageReports';
import Documents from './pages/client/Documents';
import ClientTasks from './pages/client/Tasks';
import AdminTasks from './pages/admin/Tasks';
import AdminInvoices from './pages/admin/Invoices';
import AdminDocuments from './pages/admin/Documents';
import AdminReferrals from './pages/admin/Referrals';
import AdminProjects from './pages/admin/Projects';
import AdminQuoteCalculator from './pages/admin/QuoteCalculator';
import ClientBilling from './pages/client/Billing';
import ClientReferral from './pages/client/Referral';
import ClientProjects from './pages/client/Projects';
import ServicesPage from './pages/Services';
import Onboarding from './pages/Onboarding';
import AutoReports from './pages/admin/AutoReports';
import AdminCRM from './pages/admin/CRM';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/inquiries" element={<Inquiries />} />
      <Route path="/admin/subscribers" element={<Subscribers />} />
      <Route path="/dashboard" element={<ClientOverview />} />
      <Route path="/dashboard/hours" element={<ServiceHours />} />
      <Route path="/dashboard/reports" element={<UsageReports />} />
      <Route path="/dashboard/documents" element={<Documents />} />
      <Route path="/dashboard/tasks" element={<ClientTasks />} />
      <Route path="/admin/tasks" element={<AdminTasks />} />
      <Route path="/admin/invoices" element={<AdminInvoices />} />
      <Route path="/admin/documents" element={<AdminDocuments />} />
      <Route path="/admin/referrals" element={<AdminReferrals />} />
      <Route path="/admin/projects" element={<AdminProjects />} />
      <Route path="/admin/quote-calculator" element={<AdminQuoteCalculator />} />
      <Route path="/dashboard/billing" element={<ClientBilling />} />
      <Route path="/dashboard/referrals" element={<ClientReferral />} />
      <Route path="/dashboard/projects" element={<ClientProjects />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/admin/auto-reports" element={<AutoReports />} />
      <Route path="/admin/crm" element={<AdminCRM />} />
      {/* Add your page Route elements here */}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App