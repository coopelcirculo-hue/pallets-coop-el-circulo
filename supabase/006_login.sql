-- ============================================================================
--  ETAPA 2c · Login
--  Correr DESPUÉS de 005_formatos_etiqueta.sql
--
--  Login obligatorio: sin sesión iniciada no se ve ni se carga nada.
--  Lo usan solo los encargados, así que no hay roles ni permisos por nivel:
--  el que entra, trabaja.
--
--  Es seguro correrlo hayas corrido o no los scripts anteriores.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Los usuarios los crea Supabase en su propia tabla (auth.users), que no se
--  toca. Esta tabla solo le cuelga el nombre para mostrar en pantalla.
-- ----------------------------------------------------------------------------

create table if not exists usuarios (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
--  Cuando se crea un usuario en Supabase, su fila acá aparece sola.
--  Sin esto habría que acordarse de cargarlo a mano cada vez.
-- ----------------------------------------------------------------------------

create or replace function manejar_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into usuarios (id, nombre)
  values (
    new.id,
    -- Si al crearlo se le puso un nombre, se usa ese.
    -- Si no, la parte del mail antes del @ (ej: "encargado1").
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nombre', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists usuario_nuevo_crea_perfil on auth.users;
create trigger usuario_nuevo_crea_perfil
  after insert on auth.users
  for each row execute function manejar_usuario_nuevo();

-- Para los usuarios que ya existan de antes del trigger.
insert into usuarios (id, nombre)
select u.id,
       coalesce(nullif(u.raw_user_meta_data ->> 'nombre', ''), split_part(u.email, '@', 1))
  from auth.users u
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
--  Quién hizo qué.
--
--  Ojo con la diferencia, que no es lo mismo:
--    operario_id → quién PRODUJO el material (se elige en el dropdown)
--    creado_por  → quién CARGÓ el pallet en el sistema (el que está logueado)
--
--  auth.uid() devuelve el usuario de la sesión, así que se completa solo.
-- ----------------------------------------------------------------------------

alter table pallets
  add column if not exists creado_por uuid
  references auth.users (id) on delete set null
  default auth.uid();

alter table impresiones
  add column if not exists usuario_id uuid
  references auth.users (id) on delete set null
  default auth.uid();

create index if not exists pallets_creado_por_idx on pallets (creado_por);

-- ----------------------------------------------------------------------------
--  RLS de usuarios: todos los logueados pueden ver la lista (para mostrar
--  "cargado por Fulano" en el historial). Nadie la modifica desde la app:
--  las altas y bajas se hacen desde el panel de Supabase.
-- ----------------------------------------------------------------------------

alter table usuarios enable row level security;

drop policy if exists usuarios_lectura on usuarios;
create policy usuarios_lectura on usuarios
  for select to authenticated using (true);

-- ============================================================================
--  IMPORTANTE — un paso que NO es SQL y sin el cual el login no sirve:
--
--  En el panel de Supabase → Authentication → Sign In / Providers,
--  DESACTIVAR el registro público ("Allow new users to sign up").
--
--  Si queda activado, cualquiera que encuentre la URL puede crearse una
--  cuenta solo y entrar al sistema. Con el registro cerrado, los usuarios
--  los creás vos a mano en Authentication → Users.
--
--  Al crear cada encargado, en "User Metadata" poné:  { "nombre": "Juan Pérez" }
--  y ese nombre es el que va a aparecer en el historial.
-- ============================================================================

select u.nombre, u.activo from usuarios u order by u.nombre;
