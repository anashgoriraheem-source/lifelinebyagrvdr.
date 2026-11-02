#!/usr/bin/env bash
# Local Supabase stand-in: creates the roles and schema the Supabase images and
# this project's migrations expect. Runs once, on an empty database volume.
# The auth helper functions (auth.uid() etc.) are created by GoTrue's own
# migrations, which need to own them.
set -euo pipefail

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v auth_pw="$AUTH_DB_PASSWORD" \
  -v authenticator_pw="$AUTHENTICATOR_PASSWORD" <<'SQL'
create extension if not exists pgcrypto;
create schema if not exists auth;

select 'create role anon nologin noinherit'
where not exists (select 1 from pg_roles where rolname = 'anon')\gexec
select 'create role authenticated nologin noinherit'
where not exists (select 1 from pg_roles where rolname = 'authenticated')\gexec
select 'create role service_role nologin noinherit bypassrls'
where not exists (select 1 from pg_roles where rolname = 'service_role')\gexec
select 'create role authenticator login noinherit'
where not exists (select 1 from pg_roles where rolname = 'authenticator')\gexec
select 'create role supabase_auth_admin login createrole'
where not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin')\gexec

alter role authenticator with login password :'authenticator_pw';
alter role supabase_auth_admin with login password :'auth_pw';

grant anon, authenticated, service_role to authenticator;
grant create on database postgres to supabase_auth_admin;
grant usage, create on schema auth to supabase_auth_admin;
alter schema auth owner to supabase_auth_admin;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
SQL
