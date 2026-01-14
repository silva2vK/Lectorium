
interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

export const onRequestPost = async (context: any) => {
  // Ler o cookie da requisição
  const cookieHeader = context.request.headers.get("Cookie");
  const refreshToken = cookieHeader
    ?.split(";")
    .find((c: string) => c.trim().startsWith("drive_refresh_token="))
    ?.split("=")[1];

  if (!refreshToken) {
    return new Response(JSON.stringify({ error: "Sessão expirada ou inválida" }), { status: 401 });
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: context.env.GOOGLE_CLIENT_ID,
        client_secret: context.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data: any = await response.json();

    if (data.error) {
      return new Response(JSON.stringify(data), { status: 401 });
    }

    return new Response(JSON.stringify({ 
      access_token: data.access_token,
      expires_in: data.expires_in 
    }), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};