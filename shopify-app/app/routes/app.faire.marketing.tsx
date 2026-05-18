import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  TextField,
  Button,
  Banner,
  Divider,
  Badge,
  InlineStack,
  DataTable,
  Modal,
  FormLayout,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState } from "react";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import {
  getBrand,
  updateBrand,
  listPromotions,
  createPromotion,
  updatePromotion,
  type FaireBrand,
  type FairePromotion,
} from "../faire.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const config = await db.faireConfig.findUnique({ where: { shop: session.shop } });
  if (!config) return redirect("/app/faire/settings");

  const [brand, { promotions }] = await Promise.all([
    getBrand(config.accessToken),
    listPromotions(config.accessToken),
  ]);

  return { brand, promotions };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const config = await db.faireConfig.findUnique({ where: { shop: session.shop } });
  if (!config) return redirect("/app/faire/settings");

  const form = await request.formData();
  const intent = form.get("intent") as string;

  try {
    if (intent === "update-brand") {
      await updateBrand(config.accessToken, {
        description: form.get("description") as string,
        website: form.get("website") as string,
        instagram_handle: form.get("instagram_handle") as string,
        minimum_order_amount_cents:
          Math.round(parseFloat(form.get("minimum_order_amount") as string) * 100) || undefined,
      });
      return { success: "Brand profile updated." };
    }

    if (intent === "create-promotion") {
      await createPromotion(config.accessToken, {
        name: form.get("name") as string,
        type: form.get("type") as string,
        discount_percentage: parseFloat(form.get("discount_percentage") as string),
        start_at: new Date(form.get("start_at") as string).toISOString(),
        end_at: new Date(form.get("end_at") as string).toISOString(),
      });
      return { success: "Promotion created." };
    }

    if (intent === "toggle-promotion") {
      const token = form.get("token") as string;
      const active = form.get("active") === "true";
      await updatePromotion(config.accessToken, token, { active: !active });
      return { success: `Promotion ${active ? "paused" : "activated"}.` };
    }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "An error occurred." };
  }

  return null;
};

export default function FaireMarketing() {
  const { brand, promotions } = useLoaderData<{ brand: FaireBrand; promotions: FairePromotion[] }>();
  const actionData = useActionData<{ success?: string; error?: string }>();
  const nav = useNavigation();
  const saving = nav.state === "submitting";

  const [showPromoModal, setShowPromoModal] = useState(false);

  const promoRows = promotions.map((p) => [
    p.name,
    `${p.discount_percentage}%`,
    p.type,
    p.start_at ? new Date(p.start_at).toLocaleDateString() : "—",
    p.end_at ? new Date(p.end_at).toLocaleDateString() : "—",
    <Badge tone={p.active ? "success" : "attention"}>{p.active ? "Active" : "Paused"}</Badge>,
    <Form method="post">
      <input type="hidden" name="intent" value="toggle-promotion" />
      <input type="hidden" name="token" value={p.token} />
      <input type="hidden" name="active" value={String(p.active)} />
      <Button submit size="slim" loading={saving}>{p.active ? "Pause" : "Activate"}</Button>
    </Form>,
  ]);

  return (
    <Page>
      <TitleBar title="Faire Marketing" />
      <BlockStack gap="600">
        {actionData?.error && <Banner tone="critical">{actionData.error}</Banner>}
        {actionData?.success && <Banner tone="success">{actionData.success}</Banner>}

        {/* Brand Profile */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Brand Profile</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  This is what retailers see on your Faire brand page.
                </Text>
                <Divider />
                <Form method="post">
                  <input type="hidden" name="intent" value="update-brand" />
                  <FormLayout>
                    <TextField
                      label="Brand description"
                      name="description"
                      defaultValue={brand.description}
                      multiline={4}
                      autoComplete="off"
                    />
                    <TextField
                      label="Website"
                      name="website"
                      defaultValue={brand.website}
                      autoComplete="off"
                    />
                    <TextField
                      label="Instagram handle"
                      name="instagram_handle"
                      defaultValue={brand.instagram_handle}
                      autoComplete="off"
                      prefix="@"
                    />
                    <TextField
                      label="Minimum order amount ($)"
                      name="minimum_order_amount"
                      type="number"
                      defaultValue={brand.minimum_order_amount_cents
                        ? String(brand.minimum_order_amount_cents / 100)
                        : ""}
                      autoComplete="off"
                    />
                    <Button submit loading={saving} variant="primary">Save profile</Button>
                  </FormLayout>
                </Form>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Promotions */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Promotions</Text>
                  <Button onClick={() => setShowPromoModal(true)} variant="primary">
                    New promotion
                  </Button>
                </InlineStack>

                {promotions.length === 0 ? (
                  <Text as="p" variant="bodyMd" tone="subdued">No promotions yet.</Text>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "numeric", "text", "text", "text", "text", "text"]}
                    headings={["Name", "Discount", "Type", "Starts", "Ends", "Status", ""]}
                    rows={promoRows}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* New Promotion Modal */}
      <Modal
        open={showPromoModal}
        onClose={() => setShowPromoModal(false)}
        title="New promotion"
        primaryAction={{
          content: "Create",
          onAction: () => {
            const form = document.getElementById("new-promo-form") as HTMLFormElement;
            form?.requestSubmit();
            setShowPromoModal(false);
          },
        }}
        secondaryActions={[{ content: "Cancel", onAction: () => setShowPromoModal(false) }]}
      >
        <Modal.Section>
          <Form method="post" id="new-promo-form">
            <input type="hidden" name="intent" value="create-promotion" />
            <FormLayout>
              <TextField label="Promotion name" name="name" autoComplete="off" />
              <TextField
                label="Type"
                name="type"
                autoComplete="off"
                helpText="e.g. NEW_RETAILER, SEASONAL"
              />
              <TextField
                label="Discount %"
                name="discount_percentage"
                type="number"
                autoComplete="off"
              />
              <TextField
                label="Start date"
                name="start_at"
                type="date"
                autoComplete="off"
              />
              <TextField
                label="End date"
                name="end_at"
                type="date"
                autoComplete="off"
              />
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
