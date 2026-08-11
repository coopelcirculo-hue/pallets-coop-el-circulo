-- ============================================================================
--  ETAPA 2 · Esquema base
--  Correr ESTE PRIMERO en el SQL Editor de Supabase.
--  Es idempotente: se puede volver a correr sin romper nada.
-- ============================================================================

-- gen_random_uuid() es nativo de Postgres desde la v13, no hace falta pgcrypto.
create extension if not exists pg_trgm;   -- para buscar "458" adentro de "P-000458"

-- ----------------------------------------------------------------------------
--  OJO CON LA HORA: el servidor de Supabase corre en UTC.
--  Si dejáramos los defaults en current_date / localtime, un pallet cargado a
--  las 21:30 en Argentina quedaría guardado con la fecha del día siguiente
--  (00:30 UTC), y el turno noche aparecería en el día equivocado.
--  Por eso la fecha y la hora se calculan siempre en hora argentina.
-- ----------------------------------------------------------------------------

create or replace function ahora_argentina()
returns timestamp
language sql
stable
as $$
  select timezone('America/Argentina/Buenos_Aires', now());
$$;

-- ----------------------------------------------------------------------------
--  Tablas maestras (ABM de la pantalla de Configuración)
--  Se borran con "activo = false" en vez de DELETE, para no perder el
--  historial de los pallets que ya apuntan a ellas.
-- ----------------------------------------------------------------------------

create table if not exists clientes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- Sin duplicados, sin importar mayúsculas: "Flowi" y "FLOWI" son el mismo.
create unique index if not exists clientes_nombre_unico
  on clientes (lower(nombre));

create table if not exists operarios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  iniciales  text not null,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create unique index if not exists operarios_nombre_unico
  on operarios (lower(nombre));

create table if not exists maquinas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create unique index if not exists maquinas_nombre_unico
  on maquinas (lower(nombre));

-- ----------------------------------------------------------------------------
--  Pallets
--  Las FK a las tablas maestras son RESTRICT a propósito: si alguien intenta
--  borrar un cliente que tiene pallets, Postgres lo frena. El historial de
--  producción no se puede quedar huérfano.
-- ----------------------------------------------------------------------------

create table if not exists pallets (
  id                uuid primary key default gen_random_uuid(),
  numero_pallet     text not null unique,              -- "P-000458"
  cliente_id        uuid not null references clientes  (id) on delete restrict,
  operario_id       uuid not null references operarios (id) on delete restrict,
  maquina_id        uuid not null references maquinas  (id) on delete restrict,
  fecha             date not null default (ahora_argentina())::date,
  hora              time not null default (ahora_argentina())::time,
  turno             text not null,
  -- Lo mantiene al día un trigger sumando productos_pallet. No escribirlo a mano.
  peso_total        numeric(10,2) not null default 0,
  observaciones     text,
  estado_impresion  text not null default 'pendiente',
  zpl_generado      text,                              -- se guarda para reimprimir igual
  creado_en         timestamptz not null default now(),

  constraint estado_impresion_valido
    check (estado_impresion in ('pendiente', 'imprimiendo', 'impreso', 'error'))
);

create index if not exists pallets_fecha_idx    on pallets (fecha desc);
create index if not exists pallets_cliente_idx  on pallets (cliente_id);
create index if not exists pallets_estado_idx   on pallets (estado_impresion);
create index if not exists pallets_creado_idx   on pallets (creado_en desc);

-- Para que el buscador del historial encuentre "458" escribiendo solo eso.
-- Tiene que ser un índice trigram (GIN): un índice común solo sirve cuando la
-- búsqueda empieza desde el principio del texto ("P-0004..."), y acá el
-- encargado va a escribir el pedacito del medio.
create index if not exists pallets_numero_busqueda_idx
  on pallets using gin (numero_pallet gin_trgm_ops);

-- ----------------------------------------------------------------------------
--  Contenido del pallet
--  Acá sí va CASCADE: los productos no tienen sentido sin su pallet.
-- ----------------------------------------------------------------------------

create table if not exists productos_pallet (
  id         uuid primary key default gen_random_uuid(),
  pallet_id  uuid not null references pallets (id) on delete cascade,
  medida     text not null,                            -- "45x60"
  micrones   numeric(6,2),
  kilos      numeric(10,2) not null,
  orden      integer not null default 0,               -- para imprimir en el orden que se cargó

  constraint kilos_positivos check (kilos > 0)
);

create index if not exists productos_pallet_pallet_idx
  on productos_pallet (pallet_id, orden);

-- ----------------------------------------------------------------------------
--  Medidas frecuentes por cliente → los chips de autocompletado
-- ----------------------------------------------------------------------------

create table if not exists plantillas_cliente (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         uuid not null references clientes (id) on delete cascade,
  medida             text not null,
  cantidad_sugerida  integer,

  constraint plantilla_unica unique (cliente_id, medida)
);

-- ----------------------------------------------------------------------------
--  Registro de impresiones
--  Cada intento de imprimir/reimprimir deja rastro: cuándo, si salió bien y
--  desde qué dispositivo. Es lo que permite saber cuántas veces se etiquetó
--  un pallet y si alguna falló.
-- ----------------------------------------------------------------------------

create table if not exists impresiones (
  id          uuid primary key default gen_random_uuid(),
  pallet_id   uuid not null references pallets (id) on delete cascade,
  resultado   text not null,
  detalle     text,                                    -- mensaje de error, si hubo
  dispositivo text,                                    -- "Tablet planta", "PC oficina"
  es_reimpresion boolean not null default false,
  creado_en   timestamptz not null default now(),

  constraint resultado_valido check (resultado in ('ok', 'error'))
);

create index if not exists impresiones_pallet_idx
  on impresiones (pallet_id, creado_en desc);

-- ----------------------------------------------------------------------------
--  Configuración del sistema (una sola fila)
--  Todo lo editable desde la pantalla de Configuración vive acá, para no tener
--  que tocar código ni redeployar cuando cambia la marca o la etiqueta.
-- ----------------------------------------------------------------------------

create table if not exists configuracion (
  id                   integer primary key default 1,
  marca_principal      text not null default 'COOP EL CIRCULO',
  marca_secundaria     text default 'Sistema TD Studio',

  -- Medidas reales de la etiqueta. Cambiar cuando se midan las que hay en planta.
  etiqueta_ancho_mm    numeric(6,2) not null default 100,
  etiqueta_alto_mm     numeric(6,2) not null default 150,

  -- Resolución del cabezal: el ZD421 viene en 203 o 300 dpi.
  -- Sale impreso en el reporte de configuración de la impresora.
  etiqueta_dpi         integer not null default 203,

  nombre_impresora     text,                           -- el que muestra Browser Print
  actualizado_en       timestamptz not null default now(),

  constraint configuracion_fila_unica check (id = 1),
  constraint dpi_valido check (etiqueta_dpi in (203, 300))
);

insert into configuracion (id) values (1)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
--  Trigger: mantener peso_total sincronizado con los productos
--  El peso no se lo creemos al navegador: lo recalcula Postgres cada vez que
--  cambia una fila de productos_pallet. Así la etiqueta y el total nunca se
--  pueden desfasar, ni siquiera si la tablet se corta a mitad de carga.
-- ----------------------------------------------------------------------------

create or replace function actualizar_peso_pallet(p_pallet_id uuid)
returns void
language sql
as $$
  update pallets
     set peso_total = coalesce(
           (select sum(kilos) from productos_pallet where pallet_id = p_pallet_id),
           0)
   where id = p_pallet_id;
$$;

create or replace function trg_recalcular_peso_total()
returns trigger
language plpgsql
as $$
begin
  -- En un UPDATE que mueva la fila de un pallet a otro hay que recalcular los dos.
  if tg_op in ('DELETE', 'UPDATE') then
    perform actualizar_peso_pallet(old.pallet_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform actualizar_peso_pallet(new.pallet_id);
  end if;
  return null;
end;
$$;

drop trigger if exists productos_pallet_recalcula_peso on productos_pallet;
create trigger productos_pallet_recalcula_peso
  after insert or update or delete on productos_pallet
  for each row execute function trg_recalcular_peso_total();
