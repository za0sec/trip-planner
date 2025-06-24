export interface InvitationEmailData {
  to: string
  tripTitle: string
  tripDestination: string
  tripDescription?: string
  inviterName: string
  inviterEmail: string
  invitationUrl: string
  role: string
}

// Simplificar para usar solo Resend o simulación
export async function sendInvitationEmail(data: InvitationEmailData) {
  try {
    // Option 1: Use Resend (recommended for production)
    if (process.env.RESEND_API_KEY) {
      return await sendWithResend(data)
    }

    // Option 2: Simulation for development (no external calls)
    return await sendWithSimulation(data)
  } catch (error) {
    console.error("Error sending invitation email:", error)
    throw error
  }
}

// Remove the Supabase function call that's causing CORS
async function sendWithResend(data: InvitationEmailData) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Trip Planner <invitations@your-domain.com>",
      to: [data.to],
      subject: `Invitación a viaje: ${data.tripTitle}`,
      html: generateInvitationEmailHTML(data),
    }),
  })

  if (!response.ok) {
    throw new Error(`Resend API error: ${response.statusText}`)
  }

  return await response.json()
}

// Simulation for development - no external calls
async function sendWithSimulation(data: InvitationEmailData) {
  console.log("📧 EMAIL SIMULATION - INVITATION SENT!")
  console.log("=".repeat(50))
  console.log(`📬 To: ${data.to}`)
  console.log(`📝 Subject: Invitación a viaje: ${data.tripTitle}`)
  console.log(`🌍 Trip: ${data.tripTitle} → ${data.tripDestination}`)
  console.log(`👤 Inviter: ${data.inviterName} (${data.inviterEmail})`)
  console.log(`🔗 Invitation URL: ${data.invitationUrl}`)
  console.log(`👥 Role: ${data.role}`)
  console.log("=".repeat(50))

  // Simulate successful email sending
  return {
    success: true,
    messageId: "simulated-" + Date.now(),
    message: "Email simulado enviado exitosamente",
  }
}

function generateInvitationEmailHTML(data: InvitationEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invitación a viaje</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .trip-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✈️ Invitación a Viaje</h1>
          <p>Te han invitado a colaborar en un viaje</p>
        </div>
        
        <div class="content">
          <p>¡Hola!</p>
          
          <p><strong>${data.inviterName}</strong> (${data.inviterEmail}) te ha invitado a colaborar en su viaje:</p>
          
          <div class="trip-card">
            <h2>🌍 ${data.tripTitle}</h2>
            <p><strong>Destino:</strong> ${data.tripDestination}</p>
            ${data.tripDescription ? `<p><strong>Descripción:</strong> ${data.tripDescription}</p>` : ""}
            <p><strong>Tu rol:</strong> ${data.role === "editor" ? "Editor (puedes agregar y editar elementos)" : "Visualizador (solo puedes ver el viaje)"}</p>
          </div>
          
          <p>Para unirte al viaje, haz clic en el siguiente botón:</p>
          
          <div style="text-align: center;">
            <a href="${data.invitationUrl}" class="button">🎒 Unirme al Viaje</a>
          </div>
          
          <p><small>Si no tienes una cuenta en Trip Planner, podrás crear una usando este mismo email.</small></p>
          
          <div class="footer">
            <p>Este enlace expira en 7 días.</p>
            <p>Si no esperabas esta invitación, puedes ignorar este email.</p>
            <hr>
            <p>Trip Planner - Planifica viajes increíbles</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}
