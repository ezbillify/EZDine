import { AuthGate } from "../../components/auth/AuthGate";
import { OwnerGate } from "../../components/auth/OwnerGate";
import { AppShell } from "../../components/layout/AppShell";
import { StaffManager } from "../../components/owner/StaffManager";

export default function StaffPage() {
  return (
    <AuthGate>
      <OwnerGate>
        <AppShell title="Staff Management" subtitle="Invite and assign roles">
          <StaffManager />
        </AppShell>
      </OwnerGate>
    </AuthGate>
  );
}
