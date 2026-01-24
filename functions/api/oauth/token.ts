

interface Env {
  CLIENT_SECRET: string;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  
  // 1. Ler o 'code' enviado pelo Frontend
  const formData = await request.formData();
  const code = formData.get('code');
  const redirectUri = formData.get('redirect_uri');
  const clientId = formData.get('client_id'); // Opcional, ou pode vir do env também

  if (!code || !redirectUri || !clientId) {
    return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400 });
  }

  // 2. O Segredo é lido aqui, no servidor, longe dos olhos do usuário
  const clientSecret = env.CLIENT_SECRET;

  if (!clientSecret) {
    return new Response(JSON.stringify({ error: "Server misconfiguration: Missing Secret" }), { status: 500 });
  }

  // 3. Montar a requisição para o Google
  const params = new URLSearchParams();
  params.append('client_id', clientId as string);
  params.append('client_secret', clientSecret);
  params.append('code', code as string);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', redirectUri as string);

  try {
    const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const data = await googleResponse.json();
    
    // 4. Retornar a resposta do Google para o Frontend
    return new Response(JSON.stringify(data), {
      status: googleResponse.status,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to exchange token" }), { status: 500 });
  }
}