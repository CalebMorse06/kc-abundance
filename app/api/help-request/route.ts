import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import type { HelpBarrier, Language } from '@/types';

const resend = new Resend(process.env.RESEND_API_KEY);

const BARRIER_LABELS: Record<HelpBarrier, string> = {
  no_car: 'No car / transportation',
  language_barrier: 'Language barrier',
  disability: 'Disability',
  senior: 'Senior citizen (65+)',
  infant: 'Infant / young children',
};

interface HelpRequestBody {
  zip: string;
  barrier_type: HelpBarrier[];
  preferred_language: Language;
  contact_info?: string;
  notes?: string;
  site_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as HelpRequestBody;
    const { zip, barrier_type, preferred_language, contact_info, notes, site_id } = body;

    if (!zip || !barrier_type || !preferred_language) {
      return NextResponse.json(
        { success: false, error: 'zip, barrier_type, and preferred_language are required' },
        { status: 400 }
      );
    }

    if (!/^\d{5}$/.test(zip)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ZIP code format' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('help_requests')
      .insert({
        zip,
        barrier_type,
        preferred_language,
        contact_info: contact_info || null,
        notes: notes || null,
        status: 'open',
        site_id: site_id || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Help request insert error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create request' },
        { status: 500 }
      );
    }

    // Log analytics
    await supabase.from('analytics_events').insert({
      event_type: 'help_request_created',
      zip,
      payload: {
        barriers: barrier_type,
        language: preferred_language,
        has_contact: !!contact_info,
      },
    });

    // Send structured email notification via Resend
    const notifyEmail = process.env.NOTIFICATION_EMAIL;
    if (notifyEmail && notifyEmail !== 'your-email@gmail.com') {
      const barrierList = barrier_type
        .map((b) => `<li>${BARRIER_LABELS[b] ?? b}</li>`)
        .join('');

      const priorityFlag =
        barrier_type.includes('no_car') || barrier_type.includes('disability') || barrier_type.includes('senior')
          ? '🔴 HIGH PRIORITY'
          : '🟡 Standard';

      await resend.emails.send({
        from: 'Abundance-KC <onboarding@resend.dev>',
        to: notifyEmail,
        subject: `${priorityFlag} — New help request from ZIP ${zip}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8f6f1; border-radius: 12px;">
            <div style="background: #1B3A52; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
              <h1 style="color: white; margin: 0; font-size: 20px;">Abundance-KC Help Request</h1>
              <p style="color: rgba(255,255,255,0.65); margin: 4px 0 0; font-size: 14px;">Request ID: ${data.id}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
              <tr style="background: #f3f1ec;">
                <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; width: 140px;">Priority</td>
                <td style="padding: 10px 16px; font-size: 14px; font-weight: 700; color: ${priorityFlag.startsWith('🔴') ? '#DC2626' : '#D97706'};">${priorityFlag}</td>
              </tr>
              <tr>
                <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em;">ZIP Code</td>
                <td style="padding: 10px 16px; font-size: 14px; color: #111827;">${zip}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em;">Language</td>
                <td style="padding: 10px 16px; font-size: 14px; color: #111827;">${preferred_language === 'es' ? '🇲🇽 Spanish' : '🇺🇸 English'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: top;">Barriers</td>
                <td style="padding: 10px 16px; font-size: 14px; color: #111827;"><ul style="margin: 0; padding-left: 18px;">${barrierList}</ul></td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em;">Contact</td>
                <td style="padding: 10px 16px; font-size: 14px; color: #111827;">${contact_info || '<span style="color:#9CA3AF">Not provided</span>'}</td>
              </tr>
              ${notes ? `
              <tr>
                <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: top;">Notes</td>
                <td style="padding: 10px 16px; font-size: 14px; color: #111827;">${notes}</td>
              </tr>` : ''}
              ${site_id ? `
              <tr style="background: #f9fafb;">
                <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em;">Site</td>
                <td style="padding: 10px 16px; font-size: 14px; color: #111827;">Requesting help for site ID: ${site_id}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em;">Submitted</td>
                <td style="padding: 10px 16px; font-size: 14px; color: #111827;">${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'full', timeStyle: 'short' })} CT</td>
              </tr>
            </table>

            <div style="margin-top: 20px; padding: 16px; background: #FEF3DC; border-radius: 10px; border: 1px solid rgba(245,166,35,0.3);">
              <p style="margin: 0; font-size: 13px; color: #92400E;">
                <strong>Next step:</strong> Follow up with this resident, especially if they listed no transportation or disability barriers.
                ${contact_info ? `Contact them at: <strong>${contact_info}</strong>` : 'No contact info provided — reach via community popup in ZIP ' + zip + '.'}
              </p>
            </div>

            <p style="margin-top: 16px; font-size: 11px; color: #9CA3AF; text-align: center;">
              Abundance-KC · Kansas City, MO · This request is stored in your dashboard
            </p>
          </div>
        `,
      });
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      message: 'Your request has been received. We will connect you with resources soon.',
      message_es: 'Tu solicitud ha sido recibida. Te conectaremos con recursos pronto.',
    });
  } catch (error) {
    console.error('Help request error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
