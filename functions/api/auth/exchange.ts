
interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

export const onRequestPost = async (context: any) => {
  try {
    const { code, redirect_uri } = await context.request.json() as { code: string, redirect_uri: string };

    if (!code) {
      return new Response(JSON.stringify({ error: "Código não fornecido" }), { status: 400 });
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: context.env.GOOGLE_CLIENT_ID,
        client_secret: context.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirect_uri, // Deve corresponder exatamente à origem da chamada
        grant_type: "authorization_code",
      }),
    });

    const tokens: any = await tokenResponse.json();

    if (tokens.error) {
      return new Response(JSON.stringify(tokens), { status: 400 });
    }

    // O Refresh Token é o segredo que permite acesso eterno.
    // Salvamos ele em um Cookie HttpOnly (invisível para o JS do navegador).
    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    if (tokens.refresh_token) {
      // Secure; HttpOnly; SameSite=Strict -> Segurança Máxima
      const cookieValue = `drive_refresh_token=${tokens.refresh_token}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=31536000`; // 1 ano
      headers.append("Set-Cookie", cookieValue);
    }

    return new Response(JSON.stringify({ 
      access_token: tokens.access_token, 
      expires_in: tokens.expires_in 
    }), { headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};