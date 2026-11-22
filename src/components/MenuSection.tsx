import { useMemo, useState } from 'react';
import { Minus, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { CATEGORY_DETAILS, MENU_CATEGORIES, MENU_ITEMS, formatKES } from '../data/menu.ts';
import type { CartItem, DietaryTag, MenuCategory, MenuItem } from '../types.ts';
import { DishImage } from './DishImage.tsx';

interface MenuSectionProps {
  cart: CartItem[];
  onQuickAdd: (item: MenuItem) => void;
  onUpdateItemQty: (menuItemId: string, delta: number) => void;
  onSelectDish: (item: MenuItem) => void;
}

type CategoryFilter = 'All' | MenuCategory;
type DietaryFilter = 'All' | DietaryTag;

const DIETARY_FILTERS: { id: DietaryFilter; label: string }[] = [
  { id: 'All', label: 'All Plates' },
  { id: 'Vegetarian', label: 'Vegetarian' },
  { id: 'Coastal', label: 'Coastal Swahili' },
  { id: 'Grill', label: 'Charcoal Grill' },
  { id: 'Chef Special', label: 'House Favorites' },
];

export function MenuSection({
  cart,
  onQuickAdd,
  onUpdateItemQty,
  onSelectDish,
}: MenuSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return MENU_ITEMS.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (dietaryFilter !== 'All' && !item.dietaryTags.includes(dietaryFilter)) return false;
      if (q) {
        const hay = `${item.name} ${item.description} ${item.subLabel} ${item.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [selectedCategory, dietaryFilter, searchQuery]);

  const categoriesToRender = useMemo(() => {
    if (selectedCategory !== 'All') return [selectedCategory];
    return MENU_CATEGORIES.filter((cat) => filteredItems.some((item) => item.category === cat));
  }, [selectedCategory, filteredItems]);

  const getCartQuantityForDish = (menuItemId: string): number => {
    return cart
      .filter((c) => c.menuItemId === menuItemId)
      .reduce((sum, c) => sum + c.quantity, 0);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Filter & Search Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Category Segmented Tabs */}
          <div
            className="flex items-center gap-1.5 p-1 rounded-xl bg-[#191410] border border-[#2D241C] overflow-x-auto"
            role="tablist"
            aria-label="Menu categories"
          >
            {(['All', ...MENU_CATEGORIES] as CategoryFilter[]).map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(cat)}
                  className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C99A4E] ${
                    active
                      ? 'bg-[#C99A4E] text-[#14100C] font-semibold'
                      : 'text-[#C8B9A6] hover:text-[#F6EFE4] hover:bg-[#231C16]'
                  }`}
                >
                  {cat === 'All' ? 'All Menu' : cat}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-80 shrink-0">
            <Search className="w-4 h-4 text-[#9E8B73] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pilau, ugali, chai..."
              aria-label="Search menu dishes"
              className="w-full min-h-[44px] pl-10 pr-9 py-2 rounded-xl bg-[#191410] border border-[#2D241C] text-sm text-[#F6EFE4] placeholder-[#8A7965] focus:outline-none focus:border-[#C99A4E] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#9E8B73] hover:text-[#F6EFE4]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dietary / Style Sub-Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#9E8B73] mr-1 shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#C99A4E]" />
              <span>Filter:</span>
            </span>
            {DIETARY_FILTERS.map((df) => {
              const active = dietaryFilter === df.id;
              return (
                <button
                  key={df.id}
                  type="button"
                  onClick={() => setDietaryFilter(df.id)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
                    active
                      ? 'bg-[#261E17] border-[#C99A4E] text-[#E3BC78]'
                      : 'bg-transparent border-[#2A2119] text-[#B4A693] hover:text-[#F6EFE4] hover:border-[#3E3125]'
                  }`}
                >
                  {df.label}
                </button>
              );
            })}
          </div>

          <p className="text-xs font-mono tabular-nums text-[#9E8B73]">
            Showing {filteredItems.length} of {MENU_ITEMS.length} dishes
          </p>
        </div>
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 ? (
        <div className="rounded-xl bg-[#191410] border border-[#2D241C] p-12 text-center space-y-3">
          <p className="font-display text-xl text-[#F6EFE4]">No dishes match your filter</p>
          <p className="text-sm text-[#B4A693] max-w-md mx-auto">
            Try clearing your search or switching back to all Kenyan and Swahili plates.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('All');
              setDietaryFilter('All');
              setSearchQuery('');
            }}
            className="mt-2 inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-lg bg-[#C99A4E] text-[#14100C] text-xs font-semibold hover:bg-[#D7AA60] transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {categoriesToRender.map((category) => {
            const items = filteredItems.filter((i) => i.category === category);
            const meta = CATEGORY_DETAILS[category];

            return (
              <div key={category} id={`section-${category.toLowerCase()}`} className="space-y-6">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-4 border-b border-[#2A2119]">
                  <div className="space-y-1">
                    <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#F6EFE4] tracking-tight">
                      {category}
                    </h2>
                    <p className="text-sm text-[#B4A693]">{meta.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-[#9E8B73] shrink-0">
                    <span>{meta.hours}</span>
                    <span aria-hidden="true">·</span>
                    <span>{items.length} plates</span>
                  </div>
                </div>

                {/* Dish Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map((item) => {
                    const qty = getCartQuantityForDish(item.id);
                    return (
                      <article
                        key={item.id}
                        className="group rounded-xl bg-[#191410] border border-[#2D241C] overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#423428]"
                      >
                        {/* Dish Image (clickable to customize) */}
                        <button
                          type="button"
                          onClick={() => onSelectDish(item)}
                          className="relative w-full aspect-[4/3] overflow-hidden bg-[#14100C] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C99A4E]"
                          aria-label={`Customize and view ${item.name}`}
                        >
                          <DishImage
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        </button>

                        {/* Card Body */}
                        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                          <div className="space-y-2">
                            {/* Zero-pill quiet metadata line */}
                            <div className="flex items-center gap-1.5 text-xs text-[#9E8B73] truncate">
                              <span>{item.subLabel}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{item.prepMinutes} min</span>
                            </div>

                            {/* Title & Price baseline */}
                            <div className="flex items-baseline justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => onSelectDish(item)}
                                className="font-display text-lg font-semibold text-[#F6EFE4] text-left hover:text-[#E3BC78] transition-colors"
                              >
                                {item.name}
                              </button>
                              <span className="font-mono tabular-nums text-sm font-semibold text-[#E3BC78] whitespace-nowrap shrink-0">
                                {formatKES(item.price)}
                              </span>
                            </div>

                            {/* Description */}
                            <p className="text-sm text-[#B4A693] leading-relaxed line-clamp-2">
                              {item.description}
                            </p>
                          </div>

                          {/* Card Footer Actions */}
                          <div className="pt-3 border-t border-[#261E17] flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => onSelectDish(item)}
                              className="min-h-[40px] px-2 -ml-2 text-xs font-medium text-[#B4A693] hover:text-[#F6EFE4] transition-colors whitespace-nowrap"
                            >
                              Customize
                            </button>

                            {qty === 0 ? (
                              <button
                                type="button"
                                onClick={() => onQuickAdd(item)}
                                className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 rounded-lg bg-[#C99A4E] text-[#14100C] text-xs font-semibold hover:bg-[#D7AA60] active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                                <span>Add to Order</span>
                              </button>
                            ) : (
                              <div className="inline-flex items-center rounded-lg bg-[#231C16] border border-[#C99A4E]/50 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => onUpdateItemQty(item.id, -1)}
                                  aria-label={`Decrease quantity of ${item.name}`}
                                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#E3BC78] hover:bg-[#2F251D] transition-colors"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="px-2.5 font-mono tabular-nums text-xs font-semibold text-[#F6EFE4]">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onUpdateItemQty(item.id, 1)}
                                  aria-label={`Increase quantity of ${item.name}`}
                                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#E3BC78] hover:bg-[#2F251D] transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
