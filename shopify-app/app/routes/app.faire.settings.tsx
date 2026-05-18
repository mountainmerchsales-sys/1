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
  InlineStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { getBrand } from "../faire.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const config = await db.faireConfig.findUnique({ where: { shop: session.shop } });
  return { connected: !!config, maskedToken: config ? `...${config.accessToken.slice(-6)}` : null };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "disconnect") {
    await db.faireConfig.deleteMany({ where: { shop: session.shop } });
    return { success: true, message: "Disconnected from Faire." };
  }

  const accessToken = (form.get("accessToken") as string)?.trim();
  if (!accessToken) return { error: "API token is required." };

  try {
    await getBrand(accessToken);
  } catch {
    return { error: "Could not connect to Faire. Check your API token and try again." };
  }

  await db.faireConfig.upsert({
    where: { shop: session.shop },
    create: { shop: session.shop, accessToken },
    update: { accessToken },
  });

  return { success: true, message: "Connected to Faire successfully." };
};

export default function FaireSettings() {
  const { connected, maskedToken } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const saving = nav.state === "submitting";

  return (
    <Page>
      <TitleBar title="Faire — Connection Settings" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {actionData && "error" in actionData && (
              <Banner tone="critical">{actionData.error}</Banner>
            )}
            {actionData && "message" in actionData && (
              <Banner tone="success">{actionData.message}</Banner>
            )}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Faire API Connection</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Get your app token from the Faire developer portal. It starts with <strong>apa_</strong>.
                </Text>

                {connected ? (
                  <BlockStack gap="300">
                    <Banner tone="success">
                      Connected · token ending in <strong>{maskedToken}</strong>
                    </Banner>
                    <Form method="post">
                      <input type="hidden" name="intent" value="disconnect" />
                      <InlineStack gap="300">
                        <Button submit loading={saving} tone="critical" variant="plain">
                          Disconnect
                        </Button>
                      </InlineStack>
                    </Form>
                    <Form method="post">
                      <BlockStack gap="300">
                        <TextField
                          label="Replace API token"
                          name="accessToken"
                          type="password"
                          autoComplete="off"
                          placeholder="apa_..."
                        />
                        <Button submit loading={saving} variant="primary">Update token</Button>
                      </BlockStack>
                    </Form>
                  </BlockStack>
                ) : (
                  <Form method="post">
                    <BlockStack gap="300">
                      <TextField
                        label="Faire API token"
                        name="accessToken"
                        type="password"
                        autoComplete="off"
                        placeholder="apa_..."
                      />
                      <Button submit loading={saving} variant="primary">Connect to Faire</Button>
                    </BlockStack>
                  </Form>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
