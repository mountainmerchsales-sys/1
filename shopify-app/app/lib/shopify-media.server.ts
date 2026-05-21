type AdminGraphql = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type StagedTarget = {
  url: string;
  resourceUrl: string;
  parameters: { name: string; value: string }[];
};

export async function stageUpload(
  admin: AdminGraphql,
  filename: string,
  mimeType: string,
  bytes: Buffer,
): Promise<string> {
  const stagedRes = await admin.graphql(
    `#graphql
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters { name value }
          }
          userErrors { field message }
        }
      }`,
    {
      variables: {
        input: [
          {
            filename,
            mimeType,
            httpMethod: "POST",
            resource: "IMAGE",
            fileSize: String(bytes.length),
          },
        ],
      },
    },
  );
  const stagedJson = (await stagedRes.json()) as {
    data?: {
      stagedUploadsCreate?: {
        stagedTargets?: StagedTarget[];
        userErrors?: { field: string[]; message: string }[];
      };
    };
  };
  const errors = stagedJson.data?.stagedUploadsCreate?.userErrors ?? [];
  if (errors.length) {
    throw new Error(`stagedUploadsCreate: ${errors.map((e) => e.message).join("; ")}`);
  }
  const target = stagedJson.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target) throw new Error("stagedUploadsCreate returned no target");

  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: mimeType }),
    filename,
  );

  const uploadRes = await fetch(target.url, { method: "POST", body: form });
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");
    throw new Error(`staged upload failed (${uploadRes.status}): ${text.slice(0, 500)}`);
  }
  return target.resourceUrl;
}

export type MockupMedia = {
  resourceUrl: string;
  alt: string;
};

export async function attachMediaToProduct(
  admin: AdminGraphql,
  productId: string,
  media: MockupMedia[],
): Promise<{ mediaCount: number }> {
  const res = await admin.graphql(
    `#graphql
      mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
        productCreateMedia(productId: $productId, media: $media) {
          media { id alt mediaContentType status }
          mediaUserErrors { field message code }
        }
      }`,
    {
      variables: {
        productId,
        media: media.map((m) => ({
          alt: m.alt,
          mediaContentType: "IMAGE",
          originalSource: m.resourceUrl,
        })),
      },
    },
  );
  const json = (await res.json()) as {
    data?: {
      productCreateMedia?: {
        media?: { id: string }[];
        mediaUserErrors?: { field: string[]; message: string; code: string }[];
      };
    };
  };
  const errors = json.data?.productCreateMedia?.mediaUserErrors ?? [];
  if (errors.length) {
    throw new Error(
      `productCreateMedia: ${errors.map((e) => `${e.code}: ${e.message}`).join("; ")}`,
    );
  }
  return { mediaCount: json.data?.productCreateMedia?.media?.length ?? 0 };
}
