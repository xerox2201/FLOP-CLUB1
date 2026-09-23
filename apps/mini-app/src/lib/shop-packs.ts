export interface ShopPack {
  id: string;
  name: string;
  priceUsd: number;
  priceTon: number;
  chips: number;
  voucher: number;
  xp: number;
  priceUsdDiscounted?: number;
  priceTonDiscounted?: number;
}

export const FALLBACK_PACKS: ShopPack[] = [
  { id: 'starter', name: 'Starter', priceUsd: 1,   priceTon: 0.25,  chips: 10_000,    voucher: 0,    xp: 200   },
  { id: 'value',   name: 'Value',   priceUsd: 3,   priceTon: 0.75,  chips: 40_000,    voucher: 0.5,  xp: 500   },
  { id: 'premium', name: 'Premium', priceUsd: 8,   priceTon: 2.00,  chips: 120_000,   voucher: 1.5,  xp: 1200  },
  { id: 'mega',    name: 'Mega',    priceUsd: 20,  priceTon: 5.00,  chips: 350_000,   voucher: 4,    xp: 3000  },
  { id: 'ultra',   name: 'Ultra',   priceUsd: 50,  priceTon: 12.50, chips: 1_000_000, voucher: 10,   xp: 8000  },
  { id: 'whale',   name: 'Whale',   priceUsd: 100, priceTon: 25.00, chips: 2_500_000, voucher: 20,   xp: 18000 },
];