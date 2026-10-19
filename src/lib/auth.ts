import "@/envConfig";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
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
