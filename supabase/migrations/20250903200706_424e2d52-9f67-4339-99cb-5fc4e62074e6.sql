-- Update cron job to run at 17:07 for testing
UPDATE cron.job 
SET schedule = '7 17 * * *'
WHERE jobname = 'daily-whatsapp-agenda-debora';