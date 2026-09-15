import { OAuth2Client } from "google-auth-library";

export function createGoogleIdentityVerifier({ clientId = process.env.GOOGLE_CLIENT_ID, client } = {}) {
  const normalizedClientId = String(clientId || "").trim();
  const oauthClient = client || (normalizedClientId ? new OAuth2Client(normalizedClientId) : null);

  return {
    configured: Boolean(normalizedClientId),

    async verify(credential) {
      const token = String(credential || "").trim();
      if (!normalizedClientId) {
        const error = new Error("acesso com Google ainda não configurado");
        error.status = 503;
        error.code = "GOOGLE_LOGIN_NOT_CONFIGURED";
        throw error;
      }
      if (!token || token.length > 8192) {
        const error = new Error("credencial do Google inválida");
        error.status = 400;
        error.code = "INVALID_GOOGLE_CREDENTIAL";
        throw error;
      }

      try {
        const ticket = await oauthClient.verifyIdToken({ idToken: token, audience: normalizedClientId });
        const payload = ticket.getPayload() || {};
        if (!payload.sub) throw new Error("identidade ausente");
        return {
          subject: String(payload.sub),
          displayName: String(payload.given_name || payload.name || "Jogador"),
          avatarUrl: String(payload.picture || ""),
        };
      } catch (cause) {
        const error = new Error("não foi possível confirmar esta conta Google", { cause });
        error.status = 401;
        error.code = "INVALID_GOOGLE_CREDENTIAL";
        throw error;
      }
    },
  };
}
