-- Create email templates and functions for trip invitations

-- First, let's create a function to send invitation emails
CREATE OR REPLACE FUNCTION send_trip_invitation_email()
RETURNS TRIGGER AS $$
DECLARE
  trip_info RECORD;
  inviter_info RECORD;
  invitation_url TEXT;
BEGIN
  -- Get trip information
  SELECT t.title, t.destination, t.description, p.full_name, p.email as inviter_email
  INTO trip_info
  FROM trips t
  JOIN profiles p ON t.created_by = p.id
  WHERE t.id = NEW.trip_id;

  -- Create invitation URL
  invitation_url := 'https://your-domain.com/invitations/' || NEW.token::text;

  -- Send email using Supabase Edge Function or external service
  -- For now, we'll log the email details
  RAISE NOTICE 'SEND EMAIL TO: %', NEW.email;
  RAISE NOTICE 'SUBJECT: Invitación a viaje: %', trip_info.title;
  RAISE NOTICE 'INVITATION URL: %', invitation_url;
  RAISE NOTICE 'INVITER: %', trip_info.full_name;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to send email when invitation is created
DROP TRIGGER IF EXISTS trigger_send_invitation_email ON trip_invitations;
CREATE TRIGGER trigger_send_invitation_email
  AFTER INSERT ON trip_invitations
  FOR EACH ROW
  EXECUTE FUNCTION send_trip_invitation_email();

-- Update the trip_invitations table to ensure we have all needed fields
ALTER TABLE trip_invitations 
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed'));
