import RequestPasswordResetForm from "@/components/RequestPasswordResetForm";
import ResetPasswordForm from "@/components/ResetPasswordForm";

interface ResetPasswordPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Three states: without parameters, ask for the link; with ?token= (where better-auth's link redirects when the
 * token is valid), choose the new password; with ?error=INVALID_TOKEN (an expired or used link), ask for another.
 */
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { error, token } = await searchParams;
  return (
    <div className="flex justify-center mx-5">
      {typeof token === "string" && token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <RequestPasswordResetForm
          notice={error ? "El enlace no es válido o ha caducado. Pide uno nuevo." : undefined}
        />
      )}
    </div>
  );
}
