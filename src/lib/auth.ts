import "@/envConfig";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// The app calls better-auth only through auth.api from the server, so its HTTP routes would be a second door
// past the app's rate limit and validation (POST /update-user let a signed-in user write any image or username
// on their row). Every static path better-auth 1.7.27 routes with this config is closed except GET /ok,
// GET /error and GET /reset-password/:token, the reset link. disabledPaths matches the exact path, so the other
// parameterised route, /callback/:id, cannot be listed; it is inert without social providers. An upgrade can add
// endpoints, and the integration test catches them.
const DISABLED_AUTH_PATHS = [
  "/account-info",
  "/change-email",
  "/change-password",
  "/delete-user",
  "/delete-user/callback",
  "/get-access-token",
  "/get-session",
  "/link-social",
  "/list-accounts",
  "/list-sessions",
  "/refresh-token",
  "/request-password-reset",
  "/reset-password",
  "/revoke-other-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/send-verification-email",
  "/sign-in/email",
  "/sign-in/social",
  "/sign-out",
  "/sign-up/email",
  "/unlink-account",
  "/update-session",
  "/update-user",
  "/verify-email",
  "/verify-password",
];

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  disabledPaths: DISABLED_AUTH_PATHS,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        defaultValue: Role.USER,
        input: false,
        required: true,
        type: Object.values(Role),
      },
      username: {
        input: true,
        required: true,
        type: "string",
      },
    },
  },
  // socialProviders: {
  //   google: {
  //     prompt: "select_account",
  //     clientId: process.env.GOOGLE_CLIENT_ID as string,
  //     clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
  //   }
  // },
  advanced: {
    cookiePrefix: "advientea",
  },
  rateLimit: {
    max: 100,
    window: 10,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 31,
    updateAge: 60 * 60 * 24,
  },
  // trustedOrigins: ["http://localhost:3000", "https://adviente.netlify.app/"],
  baseURL: process.env.BETTER_AUTH_URL,
  plugins: [nextCookies()],
  secret: process.env.BETTER_AUTH_SECRET,
});
