import React, { useState } from 'react';
import CRMLayout from '@/components/crm/CRMLayout';
import CRMDashboard from '@/components/crm/CRMDashboard';
import CRMLeads from '@/components/crm/CRMLeads';
import CRMContacts from '@/components/crm/CRMContacts';
import CRMDeals from '@/components/crm/CRMDeals';
import CRMActivities from '@/components/crm/CRMActivities';
import CRMReports from '@/components/crm/CRMReports';
import CRMAccounts from '@/components/crm/CRMAccounts';
import CRMCalendar from '@/components/crm/CRMCalendar';
import CRMEmails from '@/components/crm/CRMEmails';
import CRMMarketing from '@/components/crm/CRMMarketing';
import CRMSupport from '@/components/crm/CRMSupport';
import CRMDocuments from '@/components/crm/CRMDocuments';
import CRMUsers from '@/components/crm/CRMUsers';
import CRMSettings from '@/components/crm/CRMSettings';

export default function AdminCRM() {
  const [activeModule, setActiveModule] = useState('dashboard');

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':   return <CRMDashboard onModuleChange={setActiveModule} />;
      case 'leads':       return <CRMLeads />;
      case 'contacts':    return <CRMContacts />;
      case 'accounts':    return <CRMAccounts />;
      case 'deals':       return <CRMDeals />;
      case 'activities':  return <CRMActivities />;
      case 'calendar':    return <CRMCalendar />;
      case 'emails':      return <CRMEmails />;
      case 'reports':     return <CRMReports />;
      case 'marketing':   return <CRMMarketing />;
      case 'support':     return <CRMSupport />;
      case 'documents':   return <CRMDocuments />;
      case 'users':       return <CRMUsers />;
      case 'settings':    return <CRMSettings />;
      default:            return <CRMDashboard onModuleChange={setActiveModule} />;
    }
  };

  return (
    <CRMLayout activeModule={activeModule} onModuleChange={setActiveModule}>
      {renderModule()}
    </CRMLayout>
  );
}