import "@/envConfig"
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: true,
        input: true
      },
      role: {
        type: "string",
        required: true,
        input: false,
        defaultValue: "USER"
      }
    }
  },
  // socialProviders: {
  //   google: {
  //     prompt: "select_account",
  //     clientId: process.env.GOOGLE_CLIENT_ID as string,
  //     clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
  //   }
  // },
  rateLimit: {
    window: 10,
    max: 100
  },
  session: {
    expiresIn: 60 * 60 * 24 * 31,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    cookiePrefix: "advientea"
  },
  // trustedOrigins: ["http://localhost:3000", "https://adviente.netlify.app/"],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  plugins: [nextCookies()]
});