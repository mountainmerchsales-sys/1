import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  unstable_composeUploadHandlers,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  BlockStack,
  Banner,
  Button,
  Card,
  DropZone,
  InlineStack,
  Layout,
  Page,
  Text,
  Thumbnail,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import {
  composeMockup,
  listBackgrounds,
  slugToDisplayName,
} from "../lib/mockups.server";
import {
  attachMediaToProduct,
  stageUpload,
} from "../lib/shopify-media.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const backgrounds = await listBackgrounds();
  return {
    backgrounds: backgrounds.map((b) => ({
      slug: b.slug,
      displayName: b.displayName,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const uploadHandler = unstable_composeUploadHandlers(
    unstable_createMemoryUploadHandler({ maxPartSize: 50 * 1024 * 1024 }),
  );
  const form = await unstable_parseMultipartFormData(request, uploadHandler);

  const productId = String(form.get("productId") ?? "");
  const designFile = form.get("design");
  if (!productId) {
    return { ok: false as const, error: "Pick a product first." };
  }
  if (!(designFile instanceof File)) {
    return { ok: false as const, error: "Upload a design file." };
  }

  const designBuffer = Buffer.from(await designFile.arrayBuffer());

  const backgrounds = await listBackgrounds();
  if (backgrounds.length === 0) {
    return {
      ok: false as const,
      error:
        "No background images found. Drop PNGs into shopify-app/mockups/gildan-64000/.",
    };
  }

  const baseName =
    designFile.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-") ||
    "design";

  const media: { resourceUrl: string; alt: string }[] = [];
  const failures: { slug: string; error: string }[] = [];

  for (const bg of backgrounds) {
    try {
      const composited = await composeMockup(designBuffer, bg);
      const filename = `${baseName}-${bg.slug}.jpg`;
      const resourceUrl = await stageUpload(
        admin,
        filename,
        "image/jpeg",
        composited,
      );
      media.push({
        resourceUrl,
        alt: `Mockup — ${slugToDisplayName(bg.slug)}`,
      });
    } catch (err) {
      failures.push({
        slug: bg.slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let attached = 0;
  if (media.length > 0) {
    const result = await attachMediaToProduct(admin, productId, media);
    attached = result.mediaCount;
  }

  return {
    ok: true as const,
    attached,
    totalBackgrounds: backgrounds.length,
    failures,
  };
};

type SelectedProduct = { id: string; title: string; image?: string };

export default function MockupsPage() {
  const { backgrounds } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [product, setProduct] = useState<SelectedProduct | null>(null);
  const [designFile, setDesignFile] = useState<File | null>(null);

  const isSubmitting = fetcher.state === "submitting";
  const result = fetcher.data;

  useEffect(() => {
    if (result?.ok) {
      shopify.toast.show(
        `Uploaded ${result.attached}/${result.totalBackgrounds} mockups`,
      );
    } else if (result && !result.ok) {
      shopify.toast.show(result.error, { isError: true });
    }
  }, [result, shopify]);

  const pickProduct = async () => {
    const picked = await shopify.resourcePicker({
      type: "product",
      multiple: false,
      action: "select",
    });
    if (picked && picked.length > 0) {
      const p = picked[0] as {
        id: string;
        title: string;
        images?: { originalSrc?: string }[];
      };
      setProduct({
        id: p.id,
        title: p.title,
        image: p.images?.[0]?.originalSrc,
      });
    }
  };

  const submit = () => {
    if (!product || !designFile) return;
    const fd = new FormData();
    fd.append("productId", product.id);
    fd.append("design", designFile);
    fetcher.submit(fd, { method: "POST", encType: "multipart/form-data" });
  };

  const designPreview = designFile ? URL.createObjectURL(designFile) : null;

  return (
    <Page>
      <TitleBar title="Mockup generator" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  1. Pick the product
                </Text>
                {product ? (
                  <InlineStack gap="300" blockAlign="center">
                    {product.image && (
                      <Thumbnail
                        source={product.image}
                        alt={product.title}
                        size="small"
                      />
                    )}
                    <Text as="p" variant="bodyMd">
                      {product.title}
                    </Text>
                    <Button onClick={pickProduct} variant="plain">
                      Change
                    </Button>
                  </InlineStack>
                ) : (
                  <Button onClick={pickProduct}>Select product</Button>
                )}
              </BlockStack>
            </Card>

            <div style={{ height: 16 }} />

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  2. Upload the design
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Use a transparent PNG sized for print (e.g. 4500×5400 at
                  300dpi). It will be scaled and centered on each color
                  background.
                </Text>
                <DropZone
                  accept="image/png,image/jpeg,image/webp"
                  allowMultiple={false}
                  onDrop={(_files, accepted) => {
                    if (accepted[0]) setDesignFile(accepted[0]);
                  }}
                >
                  {designPreview ? (
                    <div
                      style={{
                        padding: 16,
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={designPreview}
                        alt="Design preview"
                        style={{ maxWidth: 200, maxHeight: 200 }}
                      />
                    </div>
                  ) : (
                    <DropZone.FileUpload actionHint="Accepts .png, .jpg, .webp" />
                  )}
                </DropZone>
              </BlockStack>
            </Card>

            <div style={{ height: 16 }} />

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  3. Generate and upload
                </Text>
                {backgrounds.length === 0 ? (
                  <Banner tone="warning">
                    No background images found in{" "}
                    <code>shopify-app/mockups/gildan-64000/</code>. Add PNGs
                    there (one per color) and reload this page.
                  </Banner>
                ) : (
                  <Text as="p" variant="bodyMd">
                    {backgrounds.length} color background
                    {backgrounds.length === 1 ? "" : "s"} loaded. One mockup
                    will be generated for each.
                  </Text>
                )}
                <InlineStack>
                  <Button
                    variant="primary"
                    loading={isSubmitting}
                    disabled={
                      !product ||
                      !designFile ||
                      backgrounds.length === 0 ||
                      isSubmitting
                    }
                    onClick={submit}
                  >
                    {`Generate ${backgrounds.length} mockup${backgrounds.length === 1 ? "" : "s"}`}
                  </Button>
                </InlineStack>

                {result?.ok && (
                  <Banner tone="success">
                    Uploaded {result.attached} of {result.totalBackgrounds}{" "}
                    mockups to the product.
                    {result.failures.length > 0 && (
                      <>
                        {" "}
                        Failed: {result.failures.map((f) => f.slug).join(", ")}.
                      </>
                    )}
                  </Banner>
                )}
                {result && !result.ok && (
                  <Banner tone="critical">{result.error}</Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Detected colors
                </Text>
                {backgrounds.length === 0 ? (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    None yet.
                  </Text>
                ) : (
                  <BlockStack gap="100">
                    {backgrounds.map((b) => (
                      <Text key={b.slug} as="span" variant="bodyMd">
                        {b.displayName}
                      </Text>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
