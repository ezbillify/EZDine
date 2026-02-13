import type { Restaurant } from "../../lib/supabaseTypes";

type RestaurantCardProps = {
  restaurant: Restaurant;
  branchCount: number;
  onSelect: (id: string) => void;
};

export function RestaurantCard({ restaurant, branchCount, onSelect }: RestaurantCardProps) {
  return (
    <button
      onClick={() => onSelect(restaurant.id)}
      className="flex w-full flex-col rounded-3xl border border-white/60 bg-white/80 p-6 text-left shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-center gap-4">
        {restaurant.logo ? (
          <img
            src={restaurant.logo}
            alt={restaurant.name}
            className="h-12 w-12 rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            {restaurant.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{restaurant.name}</h3>
          <p className="text-xs text-slate-500">{branchCount} branches</p>
        </div>
      </div>
    </button>
  );
}
