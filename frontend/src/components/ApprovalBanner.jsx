import { useAuth } from '../context/AuthContext';

// Farmers can't list products or take orders until an admin approves the account.
export default function ApprovalBanner() {
  const { user } = useAuth();
  const status = user?.farmerProfile?.approvalStatus;
  if (!status || status === 'approved') return null;
  return (
    <p className={`alert ${status === 'suspended' ? 'alert-error' : 'alert-info'}`}>
      {status === 'pending'
        ? 'Your account is waiting for admin approval. You can complete your profile now; products and orders unlock once approved.'
        : 'Your account is suspended. Please contact support.'}
    </p>
  );
}
