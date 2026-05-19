import AdminCampaigns from '../Admin/AdminCampaigns';

export default function AgencyAdminCampaigns() {
  return (
    <AdminCampaigns
      apiBasePath="/agency-admin/campaigns"
      pageTitle="Đại lý - Chiến dịch"
      managementLabel="Đại lý"
    />
  );
}
