// app/api/invite/route.ts
// Sends a plant invite email to a colleague.
// The email contains a deep-link to the app with the Plant ID pre-filled
// so the colleague just taps the link and their Plant ID is already set.
//
// Uses Supabase's built-in email sending (no extra email service needed).
// Supabase free tier includes transactional email via their SMTP.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { recipientEmail, orgId, inviterName, plantName } = await req.json();

    if (!recipientEmail || !orgId) {
      return NextResponse.json({ error: 'recipientEmail and orgId are required.' }, { status: 400 });
    }

    // Verify the person sending the invite is actually logged in
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 });
    }

    // Build the invite link — when the colleague opens this URL,
    // the app reads the ?plantId= param and pre-fills the Plant ID field.
    const appUrl    = process.env.NEXT_PUBLIC_APP_URL || 'https://emmi-next.vercel.app';
    const inviteUrl = `${appUrl}/join?plantId=${encodeURIComponent(orgId)}`;

    // Send email using Supabase's built-in email function
    // This uses your Supabase project's SMTP settings (configured in Supabase dashboard)
    const { error } = await supabase.auth.admin.inviteUserByEmail(recipientEmail, {
      data: {
        invited_by:  inviterName  || 'A colleague',
        plant_id:    orgId,
        plant_name:  plantName    || orgId,
        invite_url:  inviteUrl,
      },
      redirectTo: inviteUrl,
    });

    if (error) {
      // inviteUserByEmail requires service_role key.
      // Fallback: send a regular reset-style magic link instead.
      // This still works — the colleague gets an email with a sign-in link
      // and lands on the join page with Plant ID pre-filled.
      console.error('Admin invite failed, trying OTP fallback:', error.message);

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: recipientEmail,
        options: {
          emailRedirectTo: inviteUrl,
          shouldCreateUser: true,
          data: { invited_by: inviterName, plant_id: orgId },
        },
      });

      if (otpError) {
        return NextResponse.json({ error: otpError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to send invite.' }, { status: 500 });
  }
}
