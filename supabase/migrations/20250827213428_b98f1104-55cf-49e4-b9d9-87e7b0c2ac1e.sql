-- Update the function to search by name instead of username
CREATE OR REPLACE FUNCTION get_user_email_by_username(username_input text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email text;
BEGIN
    SELECT email INTO user_email
    FROM profiles
    WHERE name = username_input OR email = username_input
    LIMIT 1;
    
    RETURN user_email;
END;
$$;