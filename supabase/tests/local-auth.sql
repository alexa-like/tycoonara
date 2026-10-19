-- Minimal Supabase Auth contract for an isolated PostgreSQL CI service only.
-- NEVER run this against a hosted Supabase project.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub')::uuid $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
