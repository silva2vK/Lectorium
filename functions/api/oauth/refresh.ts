

interface Env {
  CLIENT_SECRET: string;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  
  const formData = await request.formData();
  const refreshToken = formData.get('refresh_token');
  const clientId = formData.get('client_id');

  if (!refreshToken || !clientId) {
    return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400 });
  }

  const clientSecret = env.CLIENT_SECRET;

  const params = new URLSearchParams();
  params.append('client_id', clientId as string);
  params.append('client_secret', clientSecret);
  params.append('refresh_token', refreshToken as string);
  params.append('grant_type', 'refresh_token');

  try {
    const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const data = await googleResponse.json();
    return new Response(JSON.stringify(data), {
      status: googleResponse.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to refresh token" }), { status: 500 });
  }
}