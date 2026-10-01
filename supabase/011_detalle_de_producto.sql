-- ============================================================================
--  ETAPA 8c · Detalle del producto: fuelle, material, color, aditivos y metros
--  Correr DESPUÉS de 010_numeracion_por_maquina.sql
--
--  Dónde va cada cosa, que es la decisión importante:
--
--    EN LA CORRIDA (se carga una vez por máquina y vale para todas sus
--    bobinas): ancho de fuelle, material, color y los aditivos con su dosis.
--
--    EN LA BOBINA (cambia de rollo a rollo): los kilos y los METROS.
--
--  Así el operario sigue cargando dos números por bobina y el resto sale
--  solo. Si estuviera todo en la bobina habría que repetir cinco datos por
--  cada rollo, y en un turno eso son cientos de toques al pedo.
--
--  Es seguro correrlo más de una vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Catálogos configurables
--
--  Van como tablas y no como texto libre para que el mismo material no termine
--  escrito de tres formas ("BD transparente", "bd transp", "B.D.") y se pueda
--  preguntar cuántos kilos de cada material se hicieron en el mes.
-- ----------------------------------------------------------------------------

create table if not exists materiales (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

create unique index if not exists materiales_nombre_unico on materiales (lower(nombre));

create table if not exists colores (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

create unique index if not exists colores_nombre_unico on colores (lower(nombre));

create table if not exists aditivos (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  -- master de color, protección UV, aditivo genérico (deslizante, antiblock)
  -- o carga (carbonato y similares).
  tipo      text not null default 'aditivo',
  activo    boolean not null default true,
  creado_en timestamptz not null default now(),

  constraint aditivo_tipo_valido check (tipo in ('master', 'uv', 'aditivo', 'carga'))
);

create unique index if not exists aditivos_nombre_unico on aditivos (lower(nombre));

-- ----------------------------------------------------------------------------
--  La corrida gana el detalle del producto
-- ----------------------------------------------------------------------------

alter table corridas_maquina
  add column if not exists ancho_fuelle_cm numeric(6,2);   -- null = sin fuelle

alter table corridas_maquina
  add column if not exists material_id uuid references materiales (id) on delete restrict;

alter table corridas_maquina
  add column if not exists color_id uuid references colores (id) on delete restrict;

alter table corridas_maquina drop constraint if exists corrida_fuelle_ok;
alter table corridas_maquina
  add constraint corrida_fuelle_ok check (ancho_fuelle_cm is null or ancho_fuelle_cm > 0);

-- ----------------------------------------------------------------------------
--  Aditivos de cada corrida, con su dosis
--
--  Es una tabla aparte porque una corrida puede llevar varios a la vez: master
--  de color más protección UV más carga, cada uno con sus gramos por kilo.
-- ----------------------------------------------------------------------------

create table if not exists corridas_aditivos (
  id              uuid primary key default gen_random_uuid(),
  corrida_id      uuid not null references corridas_maquina (id) on delete cascade,
  aditivo_id      uuid not null references aditivos (id) on delete restrict,
  gramos_por_kilo numeric(8,2) not null,

  constraint dosis_valida check (gramos_por_kilo > 0),
  constraint aditivo_una_vez_por_corrida unique (corrida_id, aditivo_id)
);

create index if not exists corridas_aditivos_idx on corridas_aditivos (corrida_id);

-- ----------------------------------------------------------------------------
--  La bobina gana los metros y una copia del detalle
--
--  El fuelle, el material y el color se COPIAN igual que ya se copian el ancho
--  y los micrones: si mañana alguien corrige la corrida, la bobina tiene que
--  seguir diciendo lo que realmente se produjo y se imprimió.
-- ----------------------------------------------------------------------------

alter table bobinas add column if not exists metros numeric(10,2);
alter table bobinas add column if not exists ancho_fuelle_cm numeric(6,2);
alter table bobinas
  add column if not exists material_id uuid references materiales (id) on delete restrict;
alter table bobinas
  add column if not exists color_id uuid references colores (id) on delete restrict;
-- Resumen de los aditivos tal como estaban al crear la bobina.
alter table bobinas add column if not exists aditivos_texto text;

alter table bobinas drop constraint if exists bobina_metros_ok;
alter table bobinas
  add constraint bobina_metros_ok check (metros is null or metros > 0);

create index if not exists bobinas_material_idx on bobinas (material_id);

-- ----------------------------------------------------------------------------
--  Resumen de aditivos en texto: "Master azul 20 g/kg · UV 10 g/kg"
-- ----------------------------------------------------------------------------

create or replace function texto_aditivos(p_corrida_id uuid)
returns text
language sql
stable
as $$
  -- El rtrim del punto no es un capricho: to_char con FM saca los ceros
  -- sobrantes pero deja el punto colgando, y quedaba "20. g/kg".
  select nullif(
    string_agg(
      a.nombre || ' '
        || rtrim(trim(to_char(ca.gramos_por_kilo, 'FM9999990.99')), '.')
        || ' g/kg',
      ' · ' order by a.nombre),
    '')
    from corridas_aditivos ca
    join aditivos a on a.id = ca.aditivo_id
   where ca.corrida_id = p_corrida_id;
$$;

-- ----------------------------------------------------------------------------
--  Definir qué está haciendo una máquina, ahora con todo el detalle
--
--  Cambia la firma, así que se borra la versión vieja de 3 datos: si quedaran
--  las dos, Postgres tendría dos funciones con el mismo nombre y la app podría
--  llamar sin querer a la que ignora el material y el color.
-- ----------------------------------------------------------------------------

drop function if exists definir_corrida(uuid, numeric, numeric, text);

create or replace function definir_corrida(
  p_maquina_id      uuid,
  p_ancho_cm        numeric,
  p_micrones        numeric,
  p_ancho_fuelle_cm numeric default null,
  p_material_id     uuid default null,
  p_color_id        uuid default null,
  p_observaciones   text default null
)
returns corridas_maquina
language plpgsql
security invoker
as $$
declare
  v_actual corridas_maquina;
  v_nueva  corridas_maquina;
begin
  if p_ancho_cm is null or p_ancho_cm <= 0 then
    raise exception 'El ancho tiene que ser mayor a cero.';
  end if;
  if p_micrones is null or p_micrones <= 0 then
    raise exception 'Los micrones tienen que ser mayores a cero.';
  end if;
  if p_ancho_fuelle_cm is not null and p_ancho_fuelle_cm <= 0 then
    raise exception 'El fuelle tiene que ser mayor a cero, o quedar vacío si no lleva.';
  end if;

  select * into v_actual
    from corridas_maquina
   where maquina_id = p_maquina_id and finalizada_en is null;

  -- Si está produciendo exactamente lo mismo no se abre una corrida nueva:
  -- solo se actualizan las observaciones, que no definen el producto.
  if found
     and v_actual.ancho_cm = p_ancho_cm
     and v_actual.micrones = p_micrones
     and v_actual.ancho_fuelle_cm is not distinct from p_ancho_fuelle_cm
     and v_actual.material_id is not distinct from p_material_id
     and v_actual.color_id is not distinct from p_color_id then

    update corridas_maquina
       set observaciones = nullif(btrim(coalesce(p_observaciones, '')), '')
     where id = v_actual.id
    returning * into v_actual;

    return v_actual;
  end if;

  if found then
    update corridas_maquina set finalizada_en = now() where id = v_actual.id;
  end if;

  insert into corridas_maquina (
    maquina_id, ancho_cm, micrones, ancho_fuelle_cm, material_id, color_id, observaciones
  )
  values (
    p_maquina_id, p_ancho_cm, p_micrones, p_ancho_fuelle_cm, p_material_id, p_color_id,
    nullif(btrim(coalesce(p_observaciones, '')), '')
  )
  returning * into v_nueva;

  return v_nueva;
end;
$$;

-- ----------------------------------------------------------------------------
--  Reemplazar los aditivos de una corrida de una sola vez
--  p_aditivos: [{"aditivo_id":"...","gramos_por_kilo":20}, ...]
-- ----------------------------------------------------------------------------

create or replace function definir_aditivos_corrida(
  p_corrida_id uuid,
  p_aditivos   jsonb
)
returns text
language plpgsql
security invoker
as $$
declare
  v_item jsonb;
  v_g    numeric;
begin
  delete from corridas_aditivos where corrida_id = p_corrida_id;

  if p_aditivos is not null then
    for v_item in select * from jsonb_array_elements(p_aditivos)
    loop
      v_g := nullif(btrim(coalesce(v_item ->> 'gramos_por_kilo', '')), '')::numeric;

      if v_g is null or v_g <= 0 then
        raise exception 'La dosis tiene que ser mayor a cero (en gramos por kilo).';
      end if;

      insert into corridas_aditivos (corrida_id, aditivo_id, gramos_por_kilo)
      values (p_corrida_id, (v_item ->> 'aditivo_id')::uuid, v_g);
    end loop;
  end if;

  return texto_aditivos(p_corrida_id);
end;
$$;

-- ----------------------------------------------------------------------------
--  Crear una bobina, ahora con metros y copiando el detalle de la corrida
--
--  Se simplifica: ya no se le pasan medidas. Cambiar el producto es una acción
--  aparte (definir_corrida), porque ahora son seis datos y pasarlos en cada
--  bobina sería un despropósito.
-- ----------------------------------------------------------------------------

drop function if exists crear_bobina(uuid, uuid, numeric, numeric, numeric, text);

create or replace function crear_bobina(
  p_maquina_id    uuid,
  p_operario_id   uuid,
  p_kilos         numeric,
  p_metros        numeric default null,
  p_observaciones text default null
)
returns bobinas
language plpgsql
security invoker
as $$
declare
  v_corrida    corridas_maquina;
  v_momento    timestamp;
  v_turno      text;
  v_jornada    date;
  v_numero_maq integer;
  v_conteo     integer;
  v_bobina     bobinas;
begin
  if p_kilos is null or p_kilos <= 0 then
    raise exception 'Los kilos tienen que ser mayores a cero.';
  end if;
  if p_metros is not null and p_metros <= 0 then
    raise exception 'Los metros tienen que ser mayores a cero, o quedar vacíos.';
  end if;

  select numero into v_numero_maq from maquinas where id = p_maquina_id;

  if v_numero_maq is null then
    raise exception 'Esa máquina no tiene número cargado. Ponéselo en Configuración: el número es parte del número de bobina.';
  end if;

  select * into v_corrida
    from corridas_maquina
   where maquina_id = p_maquina_id and finalizada_en is null;

  if v_corrida.id is null then
    raise exception 'Esa máquina todavía no tiene cargado qué está produciendo.';
  end if;

  -- Bloquea la fila de la máquina mientras incrementa: dos bobinas
  -- simultáneas de la misma máquina no pueden repetir número.
  update maquinas
     set contador_bobinas = contador_bobinas + 1
   where id = p_maquina_id
  returning contador_bobinas into v_conteo;

  v_momento := ahora_argentina();
  select t.turno, t.jornada into v_turno, v_jornada from turno_y_jornada(v_momento) t;

  insert into bobinas (
    numero_bobina, numero_en_maquina, maquina_id, operario_id, corrida_id,
    ancho_cm, micrones, ancho_fuelle_cm, material_id, color_id, aditivos_texto,
    kilos, metros,
    turno, fecha, hora, fecha_produccion, observaciones
  )
  values (
    lpad(v_numero_maq::text, 2, '0') || '-' || lpad(v_conteo::text, 5, '0'),
    v_conteo,
    p_maquina_id, p_operario_id, v_corrida.id,
    v_corrida.ancho_cm, v_corrida.micrones, v_corrida.ancho_fuelle_cm,
    v_corrida.material_id, v_corrida.color_id, texto_aditivos(v_corrida.id),
    p_kilos, p_metros,
    v_turno, v_momento::date, v_momento::time, v_jornada,
    nullif(btrim(coalesce(p_observaciones, '')), '')
  )
  returning * into v_bobina;

  return v_bobina;
end;
$$;

-- ----------------------------------------------------------------------------
--  Row Level Security y permisos
-- ----------------------------------------------------------------------------

alter table materiales        enable row level security;
alter table colores           enable row level security;
alter table aditivos          enable row level security;
alter table corridas_aditivos enable row level security;

drop policy if exists materiales_autenticado on materiales;
create policy materiales_autenticado on materiales
  for all to authenticated using (true) with check (true);

drop policy if exists colores_autenticado on colores;
create policy colores_autenticado on colores
  for all to authenticated using (true) with check (true);

drop policy if exists aditivos_autenticado on aditivos;
create policy aditivos_autenticado on aditivos
  for all to authenticated using (true) with check (true);

drop policy if exists corridas_aditivos_autenticado on corridas_aditivos;
create policy corridas_aditivos_autenticado on corridas_aditivos
  for all to authenticated using (true) with check (true);

revoke execute on function crear_bobina(uuid, uuid, numeric, numeric, text) from public, anon;
grant  execute on function crear_bobina(uuid, uuid, numeric, numeric, text) to authenticated;

revoke execute on function definir_corrida(uuid, numeric, numeric, numeric, uuid, uuid, text)
  from public, anon;
grant execute on function definir_corrida(uuid, numeric, numeric, numeric, uuid, uuid, text)
  to authenticated;

revoke execute on function definir_aditivos_corrida(uuid, jsonb) from public, anon;
grant  execute on function definir_aditivos_corrida(uuid, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
--  Valores de arranque, para que las listas no queden vacías.
--  SON DE EJEMPLO: borralos o cambialos por los que usan de verdad.
-- ----------------------------------------------------------------------------

insert into materiales (nombre) values
  ('BD'), ('AD'), ('BDL'), ('PP'), ('Recuperado')
on conflict do nothing;

insert into colores (nombre) values
  ('Transparente'), ('Natural'), ('Negro'), ('Blanco')
on conflict do nothing;

insert into aditivos (nombre, tipo) values
  ('Master de color', 'master'),
  ('Protección UV',   'uv'),
  ('Deslizante',      'aditivo'),
  ('Carbonato',       'carga')
on conflict do nothing;

select (select count(*) from materiales) materiales,
       (select count(*) from colores)    colores,
       (select count(*) from aditivos)   aditivos;
