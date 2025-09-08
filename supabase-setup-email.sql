-- Create email_logs table to track sent emails
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  subject TEXT,
  status VARCHAR(50) DEFAULT 'sent',
  email_id VARCHAR(255), -- Resend email ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_email_logs_document_id ON email_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);

-- Add RLS policies
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view and create email logs
CREATE POLICY "Users can view email logs" ON email_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert email logs" ON email_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow service role to manage email logs (for edge functions)
CREATE POLICY "Service role can manage email logs" ON email_logs
  FOR ALL USING (auth.role() = 'service_role');