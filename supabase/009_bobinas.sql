-- ============================================================================
--  ETAPA 8 · Bobinas: la unidad que sale de las extrusoras
--  Correr DESPUÉS de 008_dpi_de_la_impresora.sql
--
--  Qué cambia respecto de lo que había:
--  El pallet era "una lista de productos sueltos". Ahora la unidad real de
--  producción es la BOBINA: una medida, un peso, una máquina, un operario.
--  Los pallets pasan a ser conjuntos de bobinas (eso se arma en la Etapa 9;
--  acá ya queda el campo preparado para no migrar dos veces).
--
--  Es seguro correrlo más de una vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Las máquinas se identifican por número
--  Con 10+ extrusoras, el número es lo que dice la gente en planta ("la 6") y
--  lo que va impreso en la etiqueta. Además ordena bien: 6, 8, 10 y no 10, 6, 8.
-- ----------------------------------------------------------------------------

alter table maquinas add column if not exists numero integer;

create unique index if not exists maquinas_numero_unico
  on maquinas (numero) where numero is not null;

-- ----------------------------------------------------------------------------
--  Horarios de los turnos
--
--  Sirven para dos cosas: que el sistema detecte solo qué turno es (un toque
--  menos por bobina) y para calcular la JORNADA DE PRODUCCIÓN.
--
--  La jornada importa: si el turno noche entra 18:00 y sale 06:00, una bobina
--  hecha a las 02:00 pertenece al turno que arrancó el día ANTERIOR. Sin esto,
--  el resumen del turno noche queda partido entre dos fechas y nunca cierra.
-- ----------------------------------------------------------------------------

alter table configuracion
  add column if not exists hora_inicio_turno_dia time not null default '06:00';

alter table configuracion
  add column if not exists hora_inicio_turno_noche time not null default '18:00';

/**
 * Dado un momento en hora argentina, dice a qué turno y a qué jornada pertenece.
 */
create or replace function turno_y_jornada(p_momento timestamp)
returns table (turno text, jornada date)
language plpgsql
stable
as $$
declare
  v_inicio_dia   time;
  v_inicio_noche time;
  v_hora         time := p_momento::time;
  v_fecha        date := p_momento::date;
begin
  select hora_inicio_turno_dia, hora_inicio_turno_noche
    into v_inicio_dia, v_inicio_noche
    from configuracion where id = 1;

  v_inicio_dia   := coalesce(v_inicio_dia, '06:00'::time);
  v_inicio_noche := coalesce(v_inicio_noche, '18:00'::time);

  if v_hora >= v_inicio_dia and v_hora < v_inicio_noche then
    return query select 'Día'::text, v_fecha;
  elsif v_hora >= v_inicio_noche then
    -- Noche que arranca hoy: la jornada es hoy.
    return query select 'Noche'::text, v_fecha;
  else
    -- Madrugada: es la continuación del turno noche que arrancó ayer.
    return query select 'Noche'::text, (v_fecha - 1);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
--  Corridas: qué está haciendo cada máquina AHORA
--
--  Con más de diez extrusoras, cada una produce una medida distinta al mismo
--  tiempo. Que la medida la recuerde la máquina —y no la pantalla— hace que:
--    - al elegir la máquina, el ancho y los micrones ya vengan cargados
--    - sobreviva a recargar la página, cambiar de tablet o cambiar de turno
--    - quede solo el historial de qué produjo cada máquina y cuándo
-- ----------------------------------------------------------------------------

create table if not exists corridas_maquina (
  id             uuid primary key default gen_random_uuid(),
  maquina_id     uuid not null references maquinas (id) on delete cascade,
  ancho_cm       numeric(7,2) not null,
  micrones       numeric(6,2) not null,
  observaciones  text,
  iniciada_en    timestamptz not null default now(),
  finalizada_en  timestamptz,               -- null = es la corrida activa
  creada_por     uuid references auth.users (id) on delete set null default auth.uid(),

  constraint corrida_ancho_ok    check (ancho_cm > 0),
  constraint corrida_micrones_ok check (micrones > 0)
);

-- Una sola corrida activa por máquina. El índice parcial lo garantiza:
-- puede haber muchas cerradas, pero una sola sin finalizar.
create unique index if not exists corridas_una_activa_por_maquina
  on corridas_maquina (maquina_id) where finalizada_en is null;

create index if not exists corridas_maquina_idx
  on corridas_maquina (maquina_id, iniciada_en desc);

-- ----------------------------------------------------------------------------
--  Bobinas
-- ----------------------------------------------------------------------------

create table if not exists bobinas (
  id                uuid primary key default gen_random_uuid(),
  numero_bobina     text not null unique,              -- "B-001234"

  maquina_id        uuid not null references maquinas  (id) on delete restrict,
  operario_id       uuid not null references operarios (id) on delete restrict,
  corrida_id        uuid references corridas_maquina (id) on delete set null,

  -- El ancho y los micrones se COPIAN de la corrida en el momento de crearla,
  -- a propósito. Si mañana alguien corrige la corrida, la bobina tiene que
  -- seguir diciendo lo que realmente se produjo y lo que se imprimió.
  ancho_cm          numeric(7,2) not null,
  micrones          numeric(6,2) not null,
  kilos             numeric(10,2) not null,

  turno             text not null,
  fecha             date not null,                     -- cuándo se hizo, real
  hora              time not null,
  fecha_produccion  date not null,                     -- a qué jornada pertenece

  observaciones     text,

  -- Se completa en la Etapa 9, cuando las bobinas se agrupen en pallets.
  pallet_id         uuid references pallets (id) on delete set null,

  estado_impresion  text not null default 'pendiente',
  zpl_generado      text,
  creado_por        uuid references auth.users (id) on delete set null default auth.uid(),
  creado_en         timestamptz not null default now(),

  constraint bobina_kilos_ok    check (kilos > 0),
  constraint bobina_ancho_ok    check (ancho_cm > 0),
  constraint bobina_micrones_ok check (micrones > 0),
  constraint bobina_turno_ok    check (turno in ('Día', 'Noche')),
  constraint bobina_estado_ok
    check (estado_impresion in ('pendiente', 'imprimiendo', 'impreso', 'error'))
);

create index if not exists bobinas_jornada_idx  on bobinas (fecha_produccion desc, turno);
create index if not exists bobinas_maquina_idx  on bobinas (maquina_id, creado_en desc);
create index if not exists bobinas_operario_idx on bobinas (operario_id);
create index if not exists bobinas_pallet_idx   on bobinas (pallet_id);
create index if not exists bobinas_estado_idx   on bobinas (estado_impresion);
create index if not exists bobinas_creado_idx   on bobinas (creado_en desc);

-- Buscar "1234" adentro de "B-001234" necesita índice trigram, igual que pallets.
create index if not exists bobinas_numero_busqueda_idx
  on bobinas using gin (numero_bobina gin_trgm_ops);

-- Las impresiones ahora pueden ser de una bobina o de un pallet.
alter table impresiones
  add column if not exists bobina_id uuid references bobinas (id) on delete cascade;

alter table impresiones alter column pallet_id drop not null;

create index if not exists impresiones_bobina_idx
  on impresiones (bobina_id, creado_en desc);

-- Un registro de impresión tiene que ser de algo: o de una bobina o de un pallet.
alter table impresiones drop constraint if exists impresion_tiene_dueno;
alter table impresiones add constraint impresion_tiene_dueno
  check (pallet_id is not null or bobina_id is not null);

-- ----------------------------------------------------------------------------
--  Numerador de bobinas
-- ----------------------------------------------------------------------------

create sequence if not exists secuencia_bobina start with 1 increment by 1 no cycle;

create or replace function siguiente_numero_bobina()
returns text
language sql
volatile
as $$
  select 'B-' || lpad(nextval('secuencia_bobina')::text, 6, '0');
$$;

-- ----------------------------------------------------------------------------
--  Definir qué está haciendo una máquina
--
--  Si ya viene produciendo lo mismo, no hace nada: devuelve la corrida que hay.
--  Si cambia, cierra la anterior y abre una nueva. Así el historial queda solo.
-- ----------------------------------------------------------------------------

create or replace function definir_corrida(
  p_maquina_id    uuid,
  p_ancho_cm      numeric,
  p_micrones      numeric,
  p_observaciones text default null
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

  select * into v_actual
    from corridas_maquina
   where maquina_id = p_maquina_id and finalizada_en is null;

  -- Ya está haciendo exactamente eso: no se ensucia el historial.
  if found
     and v_actual.ancho_cm = p_ancho_cm
     and v_actual.micrones = p_micrones then
    return v_actual;
  end if;

  if found then
    update corridas_maquina set finalizada_en = now() where id = v_actual.id;
  end if;

  insert into corridas_maquina (maquina_id, ancho_cm, micrones, observaciones)
  values (p_maquina_id, p_ancho_cm, p_micrones,
          nullif(btrim(coalesce(p_observaciones, '')), ''))
  returning * into v_nueva;

  return v_nueva;
end;
$$;

-- ----------------------------------------------------------------------------
--  Crear una bobina
--
--  Si no se le pasan ancho y micrones, los toma de la corrida activa de esa
--  máquina, que es el caso normal: el operario solo pone los kilos.
-- ----------------------------------------------------------------------------

create or replace function crear_bobina(
  p_maquina_id    uuid,
  p_operario_id   uuid,
  p_kilos         numeric,
  p_ancho_cm      numeric default null,
  p_micrones      numeric default null,
  p_observaciones text default null
)
returns bobinas
language plpgsql
security invoker
as $$
declare
  v_corrida  corridas_maquina;
  v_ancho    numeric;
  v_micrones numeric;
  v_momento  timestamp;
  v_turno    text;
  v_jornada  date;
  v_bobina   bobinas;
begin
  if p_kilos is null or p_kilos <= 0 then
    raise exception 'Los kilos tienen que ser mayores a cero.';
  end if;

  select * into v_corrida
    from corridas_maquina
   where maquina_id = p_maquina_id and finalizada_en is null;

  -- Si vienen medidas explícitas, mandan esas y se actualiza la corrida:
  -- quiere decir que la máquina cambió de producto.
  if p_ancho_cm is not null and p_micrones is not null then
    v_corrida  := definir_corrida(p_maquina_id, p_ancho_cm, p_micrones, null);
    v_ancho    := p_ancho_cm;
    v_micrones := p_micrones;
  elsif v_corrida.id is not null then
    v_ancho    := v_corrida.ancho_cm;
    v_micrones := v_corrida.micrones;
  else
    raise exception 'Esa máquina todavía no tiene cargado qué está produciendo.';
  end if;

  -- Hora argentina, no la UTC del servidor (ver 001_schema.sql).
  v_momento := ahora_argentina();
  select t.turno, t.jornada into v_turno, v_jornada from turno_y_jornada(v_momento) t;

  insert into bobinas (
    numero_bobina, maquina_id, operario_id, corrida_id,
    ancho_cm, micrones, kilos,
    turno, fecha, hora, fecha_produccion, observaciones
  )
  values (
    siguiente_numero_bobina(), p_maquina_id, p_operario_id, v_corrida.id,
    v_ancho, v_micrones, p_kilos,
    v_turno, v_momento::date, v_momento::time, v_jornada,
    nullif(btrim(coalesce(p_observaciones, '')), '')
  )
  returning * into v_bobina;

  return v_bobina;
end;
$$;

-- ----------------------------------------------------------------------------
--  Row Level Security: mismo criterio que el resto
--  Las bobinas no se borran (son historial de producción); las corridas sí se
--  pueden corregir, porque son el estado actual de la máquina.
-- ----------------------------------------------------------------------------

alter table bobinas           enable row level security;
alter table corridas_maquina  enable row level security;

drop policy if exists bobinas_lectura on bobinas;
create policy bobinas_lectura on bobinas
  for select to authenticated using (true);

drop policy if exists bobinas_alta on bobinas;
create policy bobinas_alta on bobinas
  for insert to authenticated with check (true);

drop policy if exists bobinas_edicion on bobinas;
create policy bobinas_edicion on bobinas
  for update to authenticated using (true) with check (true);

drop policy if exists corridas_autenticado on corridas_maquina;
create policy corridas_autenticado on corridas_maquina
  for all to authenticated using (true) with check (true);

revoke execute on function crear_bobina(uuid, uuid, numeric, numeric, numeric, text)
  from public, anon;
grant execute on function crear_bobina(uuid, uuid, numeric, numeric, numeric, text)
  to authenticated;

revoke execute on function definir_corrida(uuid, numeric, numeric, text) from public, anon;
grant execute on function definir_corrida(uuid, numeric, numeric, text) to authenticated;

-- ----------------------------------------------------------------------------
--  Números de ejemplo para las máquinas que ya estaban cargadas.
--  Cambialos por los reales desde Configuración.
-- ----------------------------------------------------------------------------

update maquinas set numero = 6 where lower(nombre) = 'rollera 6' and numero is null;
update maquinas set numero = 8 where lower(nombre) = 'rollera 8' and numero is null;

select m.numero, m.nombre from maquinas m order by m.numero nulls last, m.nombre;
