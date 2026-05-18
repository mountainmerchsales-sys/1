const FAIRE_API_BASE = "https://www.faire.com/api/v2";

export interface FaireBrand {
  token: string;
  name: string;
  description: string;
  website: string;
  instagram_handle: string;
  minimum_order_amount_cents: number;
}

export interface FairePromotion {
  token: string;
  name: string;
  type: string;
  discount_percentage: number;
  start_at: string;
  end_at: string;
  active: boolean;
}

async function faireRequest<T>(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${FAIRE_API_BASE}${path}`, {
    ...options,
    headers: {
      "X-FAIRE-ACCESS-TOKEN": accessToken,
      "X-FAIRE-ACCESS-TOKEN-TYPE": "APP_TOKEN",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Faire API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function getBrand(accessToken: string): Promise<FaireBrand> {
  return faireRequest<FaireBrand>(accessToken, "/brand");
}

export async function updateBrand(
  accessToken: string,
  data: Partial<Pick<FaireBrand, "description" | "website" | "instagram_handle" | "minimum_order_amount_cents">>
): Promise<FaireBrand> {
  return faireRequest<FaireBrand>(accessToken, "/brand", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function listPromotions(
  accessToken: string
): Promise<{ promotions: FairePromotion[] }> {
  return faireRequest(accessToken, "/promotions");
}

export async function createPromotion(
  accessToken: string,
  data: { name: string; type: string; discount_percentage: number; start_at: string; end_at: string }
): Promise<FairePromotion> {
  return faireRequest<FairePromotion>(accessToken, "/promotions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePromotion(
  accessToken: string,
  promotionToken: string,
  data: Partial<Pick<FairePromotion, "discount_percentage" | "start_at" | "end_at" | "active" | "name">>
): Promise<FairePromotion> {
  return faireRequest<FairePromotion>(accessToken, `/promotions/${promotionToken}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
