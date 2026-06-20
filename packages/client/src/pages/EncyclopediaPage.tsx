import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ALL_RECIPES,
  RESOURCE_NAMES,
  BUILDING_NAMES,
  BUILDING_TIER,
  type Recipe,
  type RecipeCategory,
} from '@merchant-realms/shared';

// ── Specialisation definitions ────────────────────────────────────────────────

const SPECIALISATIONS: { label: string; categories: RecipeCategory[] | null }[] = [
  { label: 'All',                categories: null },
  { label: 'Resource Extraction', categories: ['EXTRACTION'] },
  { label: 'Agriculture',        categories: ['FARMING'] },
  { label: 'Refined Goods',      categories: ['METALLURGY'] },
  { label: 'Food Production',    categories: ['FOOD'] },
  { label: 'Construction',       categories: ['CONSTRUCTION'] },
  { label: 'Crafting',           categories: ['CRAFTING'] },
  { label: 'Alchemy',            categories: ['ALCHEMY'] },
  { label: 'Research',           categories: ['RESEARCH'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function rName(key: string): string {
  return (RESOURCE_NAMES as Record<string, string>)[key] ?? key;
}

function bName(key: string): string {
  return (BUILDING_NAMES as Record<string, string>)[key] ?? key;
}

function bTier(key: string): number {
  return (BUILDING_TIER as Record<string, number>)[key] ?? 1;
}

function fmtTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RecipeRow({ recipe }: { recipe: Recipe }) {
  const inputs =
    recipe.inputs.length === 0
      ? 'No inputs required'
      : recipe.inputs.map(i => `${i.quantity}× ${rName(i.resource)}`).join('  ·  ');

  return (
    <div className="py-2.5 border-b border-stone-700 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-parchment-100 text-sm font-medium">
          {recipe.outputQty}× {rName(recipe.output)}
        </span>
        <span className="text-stone-400 text-xs shrink-0">{fmtTime(recipe.timeMinutes)}</span>
      </div>
      <div className="mt-0.5 text-xs text-stone-400 leading-relaxed">{inputs}</div>
      {recipe.reqTech > 0 && (
        <span className="mt-1.5 inline-block px-1.5 py-0.5 rounded text-xs bg-zinc-800 text-gold-400 border border-gold-500/20">
          Tech {recipe.reqTech}
        </span>
      )}
    </div>
  );
}

function BuildingCard({ buildingType, recipes }: { buildingType: string; recipes: Recipe[] }) {
  const tier = bTier(buildingType);

  return (
    <div className="bg-stone-800 border border-stone-700 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-stone-900 border-b border-stone-700">
        <span className="text-parchment-100 font-semibold text-sm">{bName(buildingType)}</span>
        {tier >= 2 && (
          <span className="ml-auto px-1.5 py-0.5 rounded text-xs border border-gold-500/30 text-gold-400">
            T{tier}
          </span>
        )}
      </div>
      <div className="px-4">
        {recipes.map(r => (
          <RecipeRow key={r.key} recipe={r} />
        ))}
      </div>
    </div>
  );
}

// ── Summary row ───────────────────────────────────────────────────────────────

function SummaryBar({ recipeCount, buildingCount }: { recipeCount: number; buildingCount: number }) {
  return (
    <div className="flex gap-6 text-xs text-stone-500 mb-6">
      <span><span className="text-stone-300 font-medium">{buildingCount}</span> buildings</span>
      <span><span className="text-stone-300 font-medium">{recipeCount}</span> recipes</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EncyclopediaPage() {
  const [activeSpec, setActiveSpec] = useState('All');
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const spec = SPECIALISATIONS.find(s => s.label === activeSpec)!;

  const filteredRecipes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return ALL_RECIPES.filter(recipe => {
      const matchesSpec = !spec.categories || spec.categories.includes(recipe.category);
      if (!matchesSpec) return false;
      if (!q) return true;
      return (
        rName(recipe.output).toLowerCase().includes(q) ||
        bName(recipe.buildingType).toLowerCase().includes(q) ||
        recipe.inputs.some(i => rName(i.resource).toLowerCase().includes(q))
      );
    });
  }, [spec, search]);

  const byBuilding = useMemo(() => {
    const map = new Map<string, Recipe[]>();
    for (const recipe of filteredRecipes) {
      if (!map.has(recipe.buildingType)) map.set(recipe.buildingType, []);
      map.get(recipe.buildingType)!.push(recipe);
    }
    return [...map.entries()];
  }, [filteredRecipes]);

  // Ctrl/Cmd+K to focus search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-parchment-100 text-2xl font-bold mb-1">Encyclopedia</h1>
        <p className="text-stone-400 text-sm">All buildings, items, and production chains</p>
      </div>

      {/* Specialisation filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        {SPECIALISATIONS.map(s => (
          <button
            key={s.label}
            onClick={() => setActiveSpec(s.label)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
              s.label === activeSpec
                ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                : 'border-stone-600 bg-stone-800 text-stone-400 hover:border-stone-500 hover:text-stone-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items, buildings…"
            className="w-72 bg-stone-800 border border-stone-600 rounded px-3 py-2 text-sm text-parchment-100 placeholder-stone-500 focus:outline-none focus:border-gold-500 pr-16"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 text-xs pointer-events-none">
            ⌘K
          </span>
        </div>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-xs text-stone-400 hover:text-stone-200"
          >
            Clear
          </button>
        )}
      </div>

      <SummaryBar recipeCount={filteredRecipes.length} buildingCount={byBuilding.length} />

      {/* Results */}
      {byBuilding.length === 0 ? (
        <div className="py-20 text-center text-stone-500 text-sm">No results</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {byBuilding.map(([bt, recipes]) => (
            <BuildingCard key={bt} buildingType={bt} recipes={recipes} />
          ))}
        </div>
      )}
    </div>
  );
}
