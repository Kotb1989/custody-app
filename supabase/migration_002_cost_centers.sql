-- مراكز التكلفة (تحديث لقاعدة بيانات قائمة)
-- شغّل هذا الملف مرة واحدة من: Supabase > SQL Editor > New query > Run
-- لمن ينشئ مشروعاً جديداً: هذا الجزء موجود أيضاً في نهاية schema.sql، فلا حاجة لتشغيله منفصلاً.

create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  code text not null default '',
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.entries
  add column if not exists cost_center_id uuid references public.cost_centers(id) on delete restrict;
create index if not exists entries_cc_idx on public.entries (cost_center_id);

-- المدير وأمناء العهد النشطون يقرؤون مراكز التكلفة (يحتاجونها عند تسجيل السند)
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active and role in ('admin', 'custodian')
  );
$$;

alter table public.cost_centers enable row level security;

drop policy if exists cost_centers_select on public.cost_centers;
create policy cost_centers_select on public.cost_centers
  for select to authenticated using (public.is_member());

drop policy if exists cost_centers_insert on public.cost_centers;
create policy cost_centers_insert on public.cost_centers
  for insert to authenticated with check (public.is_admin());

drop policy if exists cost_centers_update on public.cost_centers;
create policy cost_centers_update on public.cost_centers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists cost_centers_delete on public.cost_centers;
create policy cost_centers_delete on public.cost_centers
  for delete to authenticated using (public.is_admin());

revoke all on public.cost_centers from anon;
grant select, insert, update, delete on public.cost_centers to authenticated;
revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;
