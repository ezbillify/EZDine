import type { Branch } from "../../lib/supabaseTypes";

type BranchCardProps = {
  branch: Branch;
  onSelect: (id: string) => void;
};

export function BranchCard({ branch, onSelect }: BranchCardProps) {
  return (
    <button
      onClick={() => onSelect(branch.id)}
      className="flex w-full flex-col rounded-3xl border border-white/60 bg-white/80 p-6 text-left shadow-sm transition hover:shadow-md"
    >
      <h3 className="text-lg font-semibold text-slate-900">{branch.name}</h3>
      <p className="mt-2 text-xs text-slate-500">
        {branch.city ?? ""} {branch.state ?? ""}
      </p>
    </button>
  );
}
