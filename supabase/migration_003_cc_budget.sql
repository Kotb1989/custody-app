-- ميزانية اختيارية لكل مركز تكلفة (شغّل مرة واحدة من SQL Editor)
alter table public.cost_centers add column if not exists budget numeric(14,2) not null default 0;
