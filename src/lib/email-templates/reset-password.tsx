import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  render,
  Section,
  Text,
} from "react-email";

import { EmailMessage } from "../email";
import { EMAIL_THEME } from "./theme";

interface ResetPasswordEmailProps {
  url: string;
  username: string;
}

const GRIFFY_FONT_FACE = `@font-face {
  font-family: "Griffy";
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/griffy/v23/FwZa7-ox2FQh9kfAT96F4s6jpQ.woff2) format("woff2");
}`;

const paragraph = {
  color: EMAIL_THEME.foreground,
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const smallPrint = {
  color: EMAIL_THEME.mutedForeground,
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0 0 12px",
};

export function ResetPasswordEmail({ url, username }: ResetPasswordEmailProps) {
  // The logo is served by the same deployment that built the link, so a preview's email points at that preview.
  const logoUrl = `${new URL(url).origin}/LogoAdvientea.png`;

  return (
    <Html lang="es">
      <Head>
        {/* Not react-email's <Font>: it sets the family on every element, and Griffy is only for the wordmark. */}
        <style>{GRIFFY_FONT_FACE}</style>
      </Head>
      <Preview>Elige una contraseña nueva para Advienté. El enlace caduca en una hora.</Preview>
      <Body
        style={{ backgroundColor: EMAIL_THEME.background, fontFamily: EMAIL_THEME.font, margin: 0, padding: "32px 0" }}
      >
        <Container style={{ margin: "0 auto", maxWidth: "520px", padding: "0 16px" }}>
          <Section style={{ paddingBottom: "16px", textAlign: "center" }}>
            <Img alt="" height="64" src={logoUrl} style={{ display: "inline-block" }} width="64" />
            <Text
              style={{
                color: EMAIL_THEME.brand,
                fontFamily: EMAIL_THEME.displayFont,
                fontSize: "32px",
                lineHeight: "40px",
                margin: "8px 0 0",
              }}
            >
              Advienté
            </Text>
          </Section>

          <Section
            style={{
              backgroundColor: EMAIL_THEME.card,
              border: `1px solid ${EMAIL_THEME.border}`,
              borderRadius: "16px",
              padding: "32px 28px",
            }}
          >
            <Heading
              as="h1"
              style={{ color: EMAIL_THEME.brand, fontSize: "24px", lineHeight: "32px", margin: "0 0 16px" }}
            >
              ¡Hola, {username}!
            </Heading>
            <Text style={paragraph}>
              Nos has pedido cambiar la contraseña de tu cuenta de Advienté. Pulsa el botón para elegir una nueva:
            </Text>
            <Section style={{ padding: "8px 0 24px", textAlign: "center" }}>
              <Button
                href={url}
                style={{
                  backgroundColor: EMAIL_THEME.brand,
                  borderRadius: "10px",
                  color: EMAIL_THEME.brandForeground,
                  fontSize: "16px",
                  fontWeight: 600,
                  padding: "14px 28px",
                  textDecoration: "none",
                }}
              >
                Elegir contraseña nueva
              </Button>
            </Section>
            <Text style={smallPrint}>El enlace caduca en una hora y solo sirve una vez.</Text>
            <Text style={smallPrint}>
              Si el botón no funciona, copia esta dirección en el navegador:
              <br />
              <Link href={url} style={{ color: EMAIL_THEME.link, wordBreak: "break-all" }}>
                {url}
              </Link>
            </Text>
            <Hr style={{ borderColor: EMAIL_THEME.border, margin: "24px 0" }} />
            <Text style={{ ...smallPrint, margin: 0 }}>
              ¿No has sido tú? No te preocupes: tu contraseña no cambia y puedes borrar este correo tranquilamen
              <i>Té</i>.
            </Text>
          </Section>

          <Text style={{ ...smallPrint, margin: "16px 0 0", textAlign: "center" }}>Advienté</Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function toResetPasswordEmail({
  url,
  username,
}: ResetPasswordEmailProps): Promise<Omit<EmailMessage, "to">> {
  const emailComponent = <ResetPasswordEmail url={url} username={username} />;
  return {
    html: await render(emailComponent),
    subject: "Recuperar tu contraseña de Advienté",
    // html-to-text upper-cases headings by default, which turns the greeting into shouting in the plain-text part.
    text: await render(emailComponent, {
      htmlToTextOptions: { selectors: [{ options: { uppercase: false }, selector: "h1" }] },
      plainText: true,
    }),
  };
}
