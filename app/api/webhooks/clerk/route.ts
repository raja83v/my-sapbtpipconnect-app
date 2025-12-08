import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { convex, api } from "@/lib/convex";

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occurred -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "");

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occurred", {
      status: 400,
    });
  }

  // Handle the webhook
  const eventType = evt.type;

  if (eventType === "user.created") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    // Check if this is the first user
    const existingUsers = await convex.query(api.users.list, { limit: 1 });
    const isFirstUser = existingUsers.length === 0;

    // Create user in database
    await convex.mutation(api.userMutations.create, {
      clerkId: id,
      email: email_addresses[0].email_address,
      name: `${first_name || ""} ${last_name || ""}`.trim() || undefined,
      emailVerified: email_addresses[0].verification?.status === "verified",
      image: image_url || undefined,
      role: isFirstUser ? "admin" : "user", // First user becomes admin
    });

    console.log(`User created: ${id}`);
  }

  if (eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    // Find user by Clerk ID
    const user = await convex.query(api.users.getByClerkId, { clerkId: id });
    
    if (user) {
      await convex.mutation(api.userMutations.update, {
        id: user._id,
        email: email_addresses[0].email_address,
        name: `${first_name || ""} ${last_name || ""}`.trim() || undefined,
        emailVerified: email_addresses[0].verification?.status === "verified",
        image: image_url || undefined,
      });
    }

    console.log(`User updated: ${id}`);
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;

    // Find user by Clerk ID
    const user = await convex.query(api.users.getByClerkId, { clerkId: id! });
    
    if (user) {
      // Soft delete by updating status
      await convex.mutation(api.userMutations.update, {
        id: user._id,
        status: "DELETED",
      });
    }

    console.log(`User deleted: ${id}`);
  }

  return new Response("", { status: 200 });
}
