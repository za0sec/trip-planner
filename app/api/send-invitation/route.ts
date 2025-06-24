import { type NextRequest, NextResponse } from "next/server"
import { sendInvitationEmail, type InvitationEmailData } from "@/lib/email"

export async function POST(request: NextRequest) {
  try {
    const data: InvitationEmailData = await request.json()

    // Validate required fields
    if (!data.to || !data.tripTitle || !data.invitationUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Send the email
    const result = await sendInvitationEmail(data)

    return NextResponse.json({
      success: true,
      messageId: result.messageId || result.id,
      message: result.message || "Email sent successfully",
    })
  } catch (error) {
    console.error("Error in send-invitation API:", error)
    return NextResponse.json(
      {
        error: "Failed to send invitation email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
