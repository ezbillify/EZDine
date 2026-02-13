import { AuthGate } from "../../components/auth/AuthGate";
import { AppShell } from "../../components/layout/AppShell";
import { PosShell } from "../../components/pos/PosShell";
import { PosHistory } from "../../components/pos/PosHistory";

export default function PosPage() {
  return (
    <AuthGate>
      <AppShell title="POS" subtitle="Touch-friendly billing and orders" fullWidth>
        <div className="h-full w-full p-4">
          <PosShell />
        </div>
      </AppShell>
    </AuthGate>
  );
}
