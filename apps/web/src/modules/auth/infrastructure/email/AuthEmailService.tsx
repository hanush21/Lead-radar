import { render } from "@react-email/render";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { ResendEmailProvider } from "@/modules/campaigns/infrastructure/ResendEmailProvider";
import { getConfiguredAppBaseUrl } from "@/modules/auth/infrastructure/passwordReset";

interface AuthEmailLayoutProps {
  preview: string;
  eyebrow: string;
  title: string;
  intro: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  note?: string;
}

function LeadRadarAuthEmail(props: AuthEmailLayoutProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{props.preview}</Preview>
      <Body
        style={{
          margin: 0,
          backgroundColor: "#eef4ff",
          fontFamily: "Arial, Helvetica, sans-serif",
          color: "#0f172a",
        }}
      >
        <Container
          style={{
            maxWidth: "640px",
            margin: "24px auto",
            padding: "0 16px",
          }}
        >
          <Section
            style={{
              background:
                "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #38bdf8 100%)",
              borderRadius: "24px 24px 0 0",
              padding: "28px 32px",
            }}
          >
            <Text
              style={{
                margin: 0,
                color: "#bfdbfe",
                fontSize: "12px",
                letterSpacing: "1.6px",
                textTransform: "uppercase",
              }}
            >
              {props.eyebrow}
            </Text>
            <Heading
              as="h1"
              style={{
                margin: "12px 0 0 0",
                color: "#ffffff",
                fontSize: "30px",
                lineHeight: "38px",
              }}
            >
              {props.title}
            </Heading>
          </Section>

          <Section
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #dbeafe",
              borderTop: "0",
              borderRadius: "0 0 24px 24px",
              padding: "32px",
              boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
            }}
          >
            <Text style={{ margin: 0, fontSize: "16px", lineHeight: "28px", color: "#334155" }}>
              {props.intro}
            </Text>
            <Text style={{ margin: "16px 0 0 0", fontSize: "16px", lineHeight: "28px", color: "#334155" }}>
              {props.body}
            </Text>

            {props.actionLabel && props.actionUrl ? (
              <Section style={{ marginTop: "28px", marginBottom: "8px" }}>
                <Link
                  href={props.actionUrl}
                  style={{
                    display: "inline-block",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontWeight: "bold",
                    padding: "14px 22px",
                    borderRadius: "12px",
                  }}
                >
                  {props.actionLabel}
                </Link>
              </Section>
            ) : null}

            {props.note ? (
              <Section
                style={{
                  marginTop: "24px",
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "16px",
                  padding: "18px 20px",
                }}
              >
                <Text style={{ margin: 0, fontSize: "14px", lineHeight: "22px", color: "#1e3a8a" }}>
                  {props.note}
                </Text>
              </Section>
            ) : null}

            <Hr style={{ margin: "28px 0", borderColor: "#e2e8f0" }} />

            <Text style={{ margin: 0, fontSize: "14px", lineHeight: "22px", color: "#64748b" }}>
              LeadRadar
            </Text>
            <Text style={{ margin: "8px 0 0 0", fontSize: "14px", lineHeight: "22px", color: "#64748b" }}>
              Si necesitas ayuda, puedes responder a este correo.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

async function renderWelcomeEmail(input: { name: string }) {
  const displayName = input.name || "equipo";
  const appBaseUrl = getConfiguredAppBaseUrl() || "http://localhost:3000";
  return render(
    <LeadRadarAuthEmail
      preview="Tu cuenta de LeadRadar ya esta lista"
      eyebrow="Bienvenida"
      title={`Hola ${displayName}, tu cuenta ya esta activa`}
      intro="Confirmamos que tu cuenta de LeadRadar se ha creado correctamente."
      body="Ya puedes entrar al dashboard, buscar negocios por zona, enriquecer leads y lanzar campanas con seguimiento desde un mismo panel."
      actionLabel="Entrar en LeadRadar"
      actionUrl={`${appBaseUrl}/login`}
      note="Te recomendamos revisar la configuracion de busqueda, el token de Mapbox y tus claves de Resend antes de lanzar campanas."
    />
  );
}

async function renderPasswordResetEmail(input: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}) {
  const displayName = input.name || "equipo";
  return render(
    <LeadRadarAuthEmail
      preview="Restablece tu contrasena de LeadRadar"
      eyebrow="Seguridad"
      title={`Hola ${displayName}, restablece tu acceso`}
      intro="Recibimos una solicitud para cambiar la contrasena de tu cuenta de LeadRadar."
      body="Si fuiste tu, usa el enlace de abajo para definir una nueva contrasena y recuperar el acceso a tu panel."
      actionLabel="Restablecer contrasena"
      actionUrl={input.resetUrl}
      note={`Este enlace caduca en ${input.expiresInMinutes} minutos. Si no solicitaste este cambio, puedes ignorar este mensaje.`}
    />
  );
}

export class AuthEmailService {
  private readonly emailProvider = new ResendEmailProvider();

  async sendWelcomeEmail(input: { name: string; email: string }) {
    const html = await renderWelcomeEmail({ name: input.name });
    return this.emailProvider.sendEmail({
      to: input.email,
      subject: "Bienvenido a LeadRadar",
      html,
    });
  }

  async sendPasswordResetEmail(input: {
    name: string;
    email: string;
    resetUrl: string;
    expiresInMinutes: number;
  }) {
    const html = await renderPasswordResetEmail({
      name: input.name,
      resetUrl: input.resetUrl,
      expiresInMinutes: input.expiresInMinutes,
    });
    return this.emailProvider.sendEmail({
      to: input.email,
      subject: "Recupera tu acceso a LeadRadar",
      html,
    });
  }
}
