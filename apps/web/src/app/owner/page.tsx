import { AuthGate } from "../../components/auth/AuthGate";
import { OwnerGate } from "../../components/auth/OwnerGate";
import { AppShell } from "../../components/layout/AppShell";
import { BranchManager } from "../../components/owner/BranchManager";
import { OwnershipTransfer } from "../../components/owner/OwnershipTransfer";
import { RestaurantManager } from "../../components/owner/RestaurantManager";
import { StaffManager } from "../../components/owner/StaffManager";
import { Section } from "../../components/ui/Section";

export default function OwnerPage() {
  return (
    <AuthGate>
      <OwnerGate>
        <AppShell title="Owner Console" subtitle="Manage restaurants, branches, and staff">
          <div className="grid gap-6">
            <Section title="Restaurants" description="Add, edit, or transfer ownership.">
              <RestaurantManager />
            </Section>
            <Section title="Branches" description="Create branches and assign managers.">
              <BranchManager />
            </Section>
            <Section title="Team" description="Invite users and assign roles.">
              <StaffManager />
            </Section>
            <Section title="Ownership" description="Transfer restaurant ownership securely.">
              <OwnershipTransfer />
            </Section>
            <Section title="Cross-restaurant analytics" description="Consolidated metrics for owners.">
              <div className="rounded-2xl border border-white/60 bg-white/80 p-5 text-sm text-slate-600">
                Analytics summary will connect here.
              </div>
            </Section>
          </div>
        </AppShell>
      </OwnerGate>
    </AuthGate>
  );
}
