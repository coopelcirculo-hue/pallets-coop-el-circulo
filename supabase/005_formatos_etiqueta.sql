-- ============================================================================
--  ETAPA 2b · Formatos de etiqueta
--  Correr DESPUÉS de 004_seed.sql
--
--  Reemplaza al tamaño único que estaba en la tabla configuracion.
--  Ahora se cargan todos los formatos de etiqueta que haya en planta y se
--  elige cuál usar en cada pallet.
--
--  Es seguro correrlo hayas corrido o no los scripts anteriores.
-- ============================================================================

create table if not exists formatos_etiqueta (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,                 -- "Grande 100x150", "Chica 100x50"
  ancho_mm        numeric(6,2) not null,
  alto_mm         numeric(6,2) not null,

  -- Resolución del cabezal. El ZD421 viene en 203 o 300 dpi; sale impreso en
  -- el reporte de configuración de la impresora (FEED 2 segundos).
  dpi             integer not null default 203,

  -- El que viene marcado en la pantalla de Nuevo pallet sin tocar nada.
  predeterminado  boolean not null default false,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),

  constraint formato_dpi_valido    check (dpi in (203, 300)),
  constraint formato_medidas_ok    check (ancho_mm > 0 and alto_mm > 0)
);

create unique index if not exists formatos_etiqueta_nombre_unico
  on formatos_etiqueta (lower(nombre));

-- Solo puede haber UN formato predeterminado a la vez.
-- El índice parcial deja tener muchos en false, pero un único true.
create unique index if not exists formatos_etiqueta_un_predeterminado
  on formatos_etiqueta (predeterminado)
  where predeterminado;

-- ----------------------------------------------------------------------------
--  El pallet guarda con qué formato se imprimió.
--  Es RESTRICT: no se puede borrar un formato que ya se usó, porque entonces
--  no se sabría con qué medidas reimprimir un pallet viejo.
--  Para sacar uno de circulación se usa activo = false.
-- ----------------------------------------------------------------------------

alter table pallets
  add column if not exists formato_etiqueta_id uuid
  references formatos_etiqueta (id) on delete restrict;

create index if not exists pallets_formato_idx on pallets (formato_etiqueta_id);

-- ----------------------------------------------------------------------------
--  El tamaño sale de configuracion: ahora vive en formatos_etiqueta.
--  La marca se queda ahí, que sigue siendo una sola para todo el sistema.
-- ----------------------------------------------------------------------------

alter table configuracion drop column if exists etiqueta_ancho_mm;
alter table configuracion drop column if exists etiqueta_alto_mm;
alter table configuracion drop column if exists etiqueta_dpi;

-- ----------------------------------------------------------------------------
--  RLS (mismo criterio que el resto: solo usuarios logueados)
-- ----------------------------------------------------------------------------

alter table formatos_etiqueta enable row level security;

drop policy if exists formatos_autenticado on formatos_etiqueta;
create policy formatos_autenticado on formatos_etiqueta
  for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
--  Dos formatos de arranque para que la pantalla no quede vacía.
--  SON INVENTADOS: reemplazalos por las medidas reales de las etiquetas que
--  tienen en planta, desde la pantalla de Configuración.
-- ----------------------------------------------------------------------------

insert into formatos_etiqueta (nombre, ancho_mm, alto_mm, dpi, predeterminado) values
  ('Grande 100x150', 100, 150, 203, true),
  ('Chica 100x50',   100,  50, 203, false)
on conflict do nothing;

select nombre, ancho_mm, alto_mm, dpi, predeterminado from formatos_etiqueta order by nombre;
